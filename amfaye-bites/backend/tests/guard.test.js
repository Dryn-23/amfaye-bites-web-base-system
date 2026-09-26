import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { app } from "../app.js";
import { seed } from "../seed/seedDatabase.js";
import {
  Product,
  User,
  Order,
  InventoryTransaction,
  Notification,
} from "../models/index.js";
import OrderGuard from "../models/OrderGuard.js";
import {
  guardConfig,
  normalizeOrderIp,
} from "../services/orderGuardService.js";
let repl, alice, bob, admin, cashier, product;
const call = (method, path, token, data, ip = "203.0.113.10") => {
  const r = request(app)
    [method]("/api" + path)
    .set("X-Forwarded-For", ip);
  if (token) r.set("Authorization", "Bearer " + token);
  return data ? r.send(data) : r;
};
const payload = () => ({
  items: [{ product: product._id, quantity: 1 }],
  paymentMethod: "Cash",
  idempotencyKey: crypto.randomUUID(),
});
before(async () => {
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  process.env.SEED_ADMIN_EMAIL = "guardadmin@example.com";
  process.env.SEED_ADMIN_PASSWORD = "Guard-Admin-Test-1234";
  process.env.DEMO_PAYMENTS_ENABLED = "true";
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(repl.getUri("amfaye_bites"));
  await seed();
  await OrderGuard.init();
  admin = (
    await call("post", "/auth/login", null, {
      login: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    })
  ).body.token;
  for (const name of ["guardalice", "guardbob"]) {
    const r = await call("post", "/auth/register", null, {
      name,
      email: name + "@example.com",
      phone: "09123456789",
      username: name,
      password: "Guard-Customer-1234",
      confirmPassword: "Guard-Customer-1234",
    });
    assert.equal(r.status, 201);
    if (name === "guardalice") alice = r.body.token;
    else bob = r.body.token;
  }
  await call("post", "/users", admin, {
    name: "Guard Cashier",
    email: "guardcashier@example.com",
    username: "guardcashier",
    role: "cashier",
    password: "Guard-Cashier-1234",
  });
  cashier = (
    await call("post", "/auth/login", null, {
      login: "guardcashier",
      password: "Guard-Cashier-1234",
    })
  ).body.token;
  product = (await call("get", "/products")).body[0];
});
beforeEach(async () => {
  await OrderGuard.deleteMany({});
  process.env.ORDER_ACCOUNT_LIMIT = "2";
  process.env.ORDER_IP_LIMIT = "100";
  process.env.ORDER_WINDOW_SECONDS = "60";
  process.env.ORDER_BLOCK_SECONDS = "300";
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

test("Guard defaults are safe and IP identities normalize mapped IPv4 and IPv6 /64", () => {
  delete process.env.ORDER_ACCOUNT_LIMIT;
  delete process.env.ORDER_IP_LIMIT;
  assert.equal(guardConfig().accountLimit, 5);
  assert.equal(guardConfig().ipLimit, 20);
  process.env.ORDER_ACCOUNT_LIMIT = "-1";
  process.env.ORDER_IP_LIMIT = "bad";
  assert.equal(guardConfig().accountLimit, 5);
  assert.equal(guardConfig().ipLimit, 20);
  assert.equal(normalizeOrderIp("::ffff:192.0.2.10"), "192.0.2.10");
  assert.equal(normalizeOrderIp("0:0:0:0:0:ffff:c000:020a"), "192.0.2.10");
  assert.equal(
    normalizeOrderIp("2001:db8:abcd:1234::1"),
    normalizeOrderIp("2001:0db8:abcd:1234:ffff:0:0:abcd"),
  );
});

test("Account cooldown blocks new IPs, survives service reads, leaves browsing/auth/orders available", async () => {
  assert.equal((await call("post", "/orders", alice, payload())).status, 201);
  assert.equal((await call("post", "/orders", alice, payload())).status, 201);
  const [stock, orders, transactions, notifications] = await Promise.all([
    Product.findById(product._id),
    Order.countDocuments(),
    InventoryTransaction.countDocuments(),
    Notification.countDocuments(),
  ]);
  const blocked = await call("post", "/orders", alice, payload());
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, "ORDER_TEMPORARILY_BLOCKED");
  assert.ok(Number(blocked.headers["retry-after"]) > 0);
  const changedIp = await call(
    "post",
    "/orders",
    alice,
    payload(),
    "198.51.100.22",
  );
  assert.equal(changedIp.status, 429);
  assert.equal(changedIp.body.blockedUntil, blocked.body.blockedUntil);
  const status = await call("get", "/orders/guard", alice);
  assert.equal(status.body.blocked, true);
  assert.equal((await Product.findById(product._id)).stock, stock.stock);
  assert.equal(await Order.countDocuments(), orders);
  assert.equal(await InventoryTransaction.countDocuments(), transactions);
  assert.equal(await Notification.countDocuments(), notifications);
  assert.equal((await call("get", "/products")).status, 200);
  assert.equal((await call("get", "/orders", alice)).status, 200);
  assert.equal((await call("get", "/auth/me", alice)).status, 200);
  assert.equal((await call("get", "/orders/guard")).status, 401);
  const user = await User.findOne({ username: "guardalice" });
  const storage = JSON.stringify(await OrderGuard.find().lean());
  assert.ok(!storage.includes("203.0.113.10"));
  assert.ok(!storage.includes(String(user._id)));
  // A different account is not blocked by somebody else's ACCOUNT-only ban.
  assert.equal((await call("post", "/orders", bob, payload())).status, 201);
});

test("IP cooldown applies across customer accounts but exempts cashier and admin POS", async () => {
  process.env.ORDER_ACCOUNT_LIMIT = "100";
  process.env.ORDER_IP_LIMIT = "2";
  await call("post", "/orders", alice, payload());
  await call("post", "/orders", bob, payload());
  assert.equal((await call("post", "/orders", alice, payload())).status, 429);
  assert.equal((await call("post", "/orders", bob, payload())).status, 429);
  assert.equal((await call("get", "/orders/guard", bob)).body.blocked, true);
  assert.equal(
    (await call("post", "/orders", bob, payload(), "198.51.100.30")).status,
    201,
  );
  for (const token of [cashier, admin]) {
    assert.equal(
      (await call("get", "/orders/guard", token)).body.blocked,
      false,
    );
    assert.equal(
      (
        await call("post", "/orders", token, {
          ...payload(),
          source: "pos",
          amountReceived: 500,
        })
      ).status,
      201,
    );
  }
});

test("Failed order attempts count; cooldown automatically clears without extending on retry", async () => {
  for (let n = 0; n < 2; n++)
    assert.equal(
      (await call("post", "/orders", alice, { items: [] })).status,
      400,
    );
  const rejected = await call("post", "/orders", alice, payload());
  assert.equal(rejected.status, 429);
  assert.equal(
    (await call("post", "/orders", alice, payload())).body.blockedUntil,
    rejected.body.blockedUntil,
  );
  // Simulate time passing, rather than slowing the test down for five minutes.
  await OrderGuard.updateMany(
    { scope: "account" },
    { $set: { blockedUntil: new Date(Date.now() - 1000) } },
  );
  assert.equal((await call("get", "/orders/guard", alice)).body.blocked, false);
  assert.equal((await call("post", "/orders", alice, payload())).status, 201);
});

test("Concurrent requests cannot exceed the shared account allowance; windows reset", async () => {
  const results = await Promise.all(
    Array.from({ length: 6 }, () => call("post", "/orders", alice, payload())),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 2);
  assert.equal(results.filter((r) => r.status === 429).length, 4);
  await OrderGuard.updateMany(
    {},
    {
      $set: {
        blockedUntil: null,
        windowStartedAt: new Date(Date.now() - 61000),
      },
    },
  );
  assert.equal((await call("post", "/orders", alice, payload())).status, 201);
});

test("Stock alerts include threshold equality and zero stock, exclude disabled products and enforce staff access", async () => {
  const category = product.category._id;
  const [low, out, normal, archived] = await Product.create([
    {
      name: "Alert low",
      category,
      price: 50,
      stock: 5,
      minimumStock: 5,
      available: true,
    },
    {
      name: "Alert zero",
      category,
      price: 50,
      stock: 0,
      minimumStock: 5,
      available: true,
    },
    {
      name: "Alert healthy",
      category,
      price: 50,
      stock: 6,
      minimumStock: 5,
      available: true,
    },
    {
      name: "Alert archived",
      category,
      price: 50,
      stock: 0,
      minimumStock: 5,
      available: false,
    },
  ]);
  assert.equal((await call("get", "/products/stock-alerts")).status, 401);
  assert.equal(
    (await call("get", "/products/stock-alerts", alice)).status,
    403,
  );
  for (const token of [admin, cashier]) {
    const result = await call("get", "/products/stock-alerts", token);
    assert.equal(result.status, 200);
    assert.equal(result.body.lowStockCount, 1);
    assert.equal(result.body.outOfStockCount, 1);
    assert.deepEqual(
      result.body.items.map((p) => p.name),
      ["Alert zero", "Alert low"],
    );
  }
  await Product.updateOne({ _id: low._id }, { $set: { stock: 20 } });
  const next = await call("get", "/products/stock-alerts", admin);
  assert.equal(next.body.lowStockCount, 0);
  assert.equal(next.body.outOfStockCount, 1);
});
