import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { app } from "../app.js";
import { seed } from "../seed/seedDatabase.js";
import { Order, Product, InventoryTransaction } from "../models/index.js";
let repl, admin, cashier, customer, product;
const call = (method, path, token, body) => {
  const r = request(app)[method]("/api" + path);
  if (token) r.set("Authorization", "Bearer " + token);
  return body ? r.send(body) : r;
};
function fixture(status = "Confirmed", extra = {}) {
  return {
    number: "QUEUE-" + crypto.randomUUID(),
    user: customer.user.id,
    customerName: "Queue customer",
    source: "web",
    status,
    paymentStatus: "Pending",
    paymentMethod: "Cash",
    items: [
      {
        product: product._id,
        name: product.name,
        quantity: 2,
        unitPrice: product.price,
        subtotal: product.price * 2,
      },
    ],
    subtotal: product.price * 2,
    total: product.price * 2,
    idempotencyKey: crypto.randomUUID(),
    ...extra,
  };
}
before(async () => {
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  process.env.SEED_ADMIN_EMAIL = "queueadmin@example.com";
  process.env.SEED_ADMIN_PASSWORD = "Queue-Admin-123456";
  process.env.ORDER_ACCOUNT_LIMIT = "1000";
  process.env.ORDER_IP_LIMIT = "10000";
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(repl.getUri("amfaye_bites"));
  await seed();
  admin = (
    await call("post", "/auth/login", null, {
      login: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    })
  ).body;
  customer = (
    await call("post", "/auth/register", null, {
      name: "Queue Customer",
      email: "queuecustomer@example.com",
      username: "queuecustomer",
      phone: "09123456789",
      password: "Queue-Customer-123",
      confirmPassword: "Queue-Customer-123",
    })
  ).body;
  await call("post", "/users", admin.token, {
    name: "Queue Cashier",
    email: "queuecashier@example.com",
    username: "queuecashier",
    role: "cashier",
    password: "Queue-Cashier-123",
  });
  cashier = (
    await call("post", "/auth/login", null, {
      login: "queuecashier",
      password: "Queue-Cashier-123",
    })
  ).body;
  product = (await call("get", "/products")).body[0];
});
beforeEach(async () => {
  await Order.deleteMany({});
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});
test("Queue access is restricted to authenticated admins and cashiers", async () => {
  assert.equal((await call("get", "/preparation")).status, 401);
  assert.equal((await call("get", "/preparation", customer.token)).status, 403);
  for (const u of [admin, cashier]) {
    const r = await call("get", "/preparation", u.token);
    assert.equal(r.status, 200);
    assert.equal(r.headers["cache-control"], "no-store");
    assert.deepEqual(
      r.body.lanes.map((l) => l.items),
      [[], [], []],
    );
    assert.ok(Date.parse(r.body.serverTime));
  }
});
test("Queue contains only active online orders, with pending count separate from lanes", async () => {
  for (const status of [
    "Pending",
    "Confirmed",
    "Preparing",
    "Ready for Pickup",
    "Completed",
    "Cancelled",
  ])
    await Order.create(fixture(status));
  await Order.create(fixture("Confirmed", { source: "pos" }));
  const r = await call("get", "/preparation", cashier.token);
  assert.equal(r.body.pendingCount, 1);
  assert.deepEqual(
    r.body.lanes.map((l) => l.total),
    [1, 1, 1],
  );
  assert.deepEqual(
    r.body.lanes.map((l) => l.items[0].status),
    ["Confirmed", "Preparing", "Ready for Pickup"],
  );
  const row = r.body.lanes[0].items[0];
  assert.equal(row.user, undefined);
  assert.equal(row.idempotencyKey, undefined);
  assert.equal(row.inventoryUsage, undefined);
  assert.equal(row.items[0].quantity, 2);
});
test("Oldest-first ordering is stable; bounded independent pages do not lose old active orders behind completed history", async () => {
  const old = new Date("2025-01-01T00:00:00Z");
  const active = await Order.insertMany(
    Array.from({ length: 19 }, (_, i) =>
      fixture("Confirmed", { createdAt: new Date(old.getTime() + i * 1000) }),
    ),
  );
  await Order.insertMany(
    Array.from({ length: 205 }, () => fixture("Completed")),
  );
  await Order.create(fixture("Preparing"));
  const ids = [];
  for (const page of [1, 2, 3]) {
    const r = await call(
      "get",
      "/preparation?confirmedPage=" + page,
      admin.token,
    );
    const lane = r.body.lanes[0];
    assert.equal(lane.total, 19);
    assert.equal(lane.pages, 3);
    assert.equal(lane.items.length, page < 3 ? 8 : 3);
    ids.push(...lane.items.map((i) => i._id));
    assert.equal(r.body.lanes[1].page, 1);
  }
  assert.deepEqual(
    ids,
    active.map((x) => String(x._id)),
  );
});
test("Search is escaped, case insensitive, and counts match; invalid pagination/search is rejected", async () => {
  await Order.create(
    fixture("Confirmed", { number: "QUEUE-[VIP]-ONE", customerName: "Mira" }),
  );
  await Order.create(fixture("Preparing", { customerName: "Mira" }));
  await Order.create(fixture("Pending"));
  let r = await call("get", "/preparation?q=%5BVIP%5D", admin.token);
  assert.deepEqual(
    r.body.lanes.map((l) => l.total),
    [1, 0, 0],
  );
  r = await call("get", "/preparation?q=mira", admin.token);
  assert.deepEqual(
    r.body.lanes.map((l) => l.total),
    [1, 1, 0],
  );
  assert.equal(r.body.pendingCount, 1);
  for (const query of [
    "confirmedPage=0",
    "preparingPage=1.5",
    "readyPage=10001",
    "q=" + "x".repeat(81),
  ])
    assert.equal(
      (await call("get", "/preparation?" + query, admin.token)).status,
      400,
    );
});
test("Item snapshots, shake customizations and customer notes are available without changing stored data", async () => {
  const order = await Order.create(
    fixture("Preparing", {
      notes: "No straw, please.",
      items: [
        {
          product: product._id,
          name: "Custom shake",
          quantity: 2,
          unitPrice: 100,
          subtotal: 200,
          customization: {
            size: "Large",
            sugar: "25%",
            ice: "Less Ice",
            addons: [{ name: "Pearls", price: 10 }],
          },
        },
      ],
    }),
  );
  const before = await Order.findById(order._id).lean();
  const r = await call("get", "/preparation", admin.token);
  const item = r.body.lanes[1].items[0];
  assert.equal(item.notes, before.notes);
  assert.equal(item.items[0].customization.addons[0].name, "Pearls");
  assert.equal(item.items[0].customization.sugar, "25%");
  assert.deepEqual(await Order.findById(order._id).lean(), before);
});
test("Existing status workflow handles concurrent staff actions, payment guard and notifications without new stock changes", async () => {
  const created = await call("post", "/orders", customer.token, {
    items: [{ product: product._id, quantity: 1 }],
    paymentMethod: "Cash",
    idempotencyKey: crypto.randomUUID(),
  });
  assert.equal(created.status, 201);
  const o = created.body,
    stock = (await Product.findById(product._id)).stock,
    transactions = await InventoryTransaction.countDocuments();
  const update = (token, status) =>
    call("put", `/orders/${o._id}/status`, token, { status });
  assert.equal((await update(customer.token, "Confirmed")).status, 403);
  assert.equal((await update(admin.token, "Confirmed")).status, 200);
  const concurrent = await Promise.all([
    update(admin.token, "Preparing"),
    update(cashier.token, "Preparing"),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await call("get", "/preparation", admin.token)).body.lanes[1].total,
    1,
  );
  assert.equal((await update(cashier.token, "Ready for Pickup")).status, 200);
  assert.equal((await update(admin.token, "Completed")).status, 400);
  assert.equal(
    (
      await call("post", "/payments/cash", cashier.token, {
        order: o._id,
        amountReceived: 0,
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("get", "/preparation", admin.token)).body.lanes[2].items[0]
      .paymentStatus,
    "Pending",
  );
  assert.equal(
    (
      await call("post", "/payments/cash", cashier.token, {
        order: o._id,
        amountReceived: 10000,
      })
    ).status,
    200,
  );
  assert.equal((await update(cashier.token, "Completed")).status, 200);
  assert.deepEqual(
    (await call("get", "/preparation", admin.token)).body.lanes.map(
      (l) => l.total,
    ),
    [0, 0, 0],
  );
  assert.equal((await Product.findById(product._id)).stock, stock);
  assert.equal(await InventoryTransaction.countDocuments(), transactions);
  if (mongoose.models.Notification) {
    for (const status of ["Preparing", "Ready for Pickup", "Completed"])
      assert.equal(
        await mongoose.models.Notification.countDocuments({
          order: o._id,
          status,
        }),
        1,
      );
  }
});
