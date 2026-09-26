import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { app } from "../app.js";
import { seed } from "../seed/seedDatabase.js";
import { Product, Order, AuditLog } from "../models/index.js";
import Review from "../models/Review.js";
import Bucket from "../models/ReviewRateBucket.js";
let repl, alice, bob, admin, cashier, product, otherProduct;
function call(method, path, token, body) {
  let r = request(app)[method]("/api" + path);
  if (token) r.set("Authorization", "Bearer " + token);
  return body ? r.send(body) : r;
}
const endpoint = () => "/reviews/product/" + product._id;
const content = {
  rating: 5,
  text: "Fresh, delicious and carefully packed.",
  displayName: "Pastry fan",
};
const save = (token = alice.token, body = content) =>
  call("put", endpoint() + "/mine", token, body);
async function purchase(user = alice.user.id, overrides = {}) {
  return Order.create({
    number: "TEST-" + crypto.randomUUID(),
    user,
    source: "web",
    customerName: "Private customer name",
    items: [
      {
        product: product._id,
        name: product.name,
        quantity: 1,
        unitPrice: product.price,
        subtotal: product.price,
      },
    ],
    status: "Completed",
    paymentStatus: "Paid",
    paymentMethod: "Cash",
    subtotal: product.price,
    total: product.price,
    idempotencyKey: crypto.randomUUID(),
    ...overrides,
  });
}
before(async () => {
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  process.env.SEED_ADMIN_EMAIL = "reviewsadmin@example.com";
  process.env.SEED_ADMIN_PASSWORD = "Reviews-Admin-123456";
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(repl.getUri("amfaye_bites"));
  await seed();
  await Promise.all([Review.init(), Bucket.init()]);
  admin = (
    await call("post", "/auth/login", null, {
      login: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    })
  ).body;
  for (const name of ["reviewalice", "reviewbob"]) {
    const r = await call("post", "/auth/register", null, {
      name,
      email: name + "@example.com",
      username: name,
      phone: "09123456789",
      password: "Reviews-Customer-123",
      confirmPassword: "Reviews-Customer-123",
    });
    assert.equal(r.status, 201);
    if (name === "reviewalice") alice = r.body;
    else bob = r.body;
  }
  const r = await call("post", "/users", admin.token, {
    name: "Review Cashier",
    email: "reviewcashier@example.com",
    username: "reviewcashier",
    role: "cashier",
    password: "Reviews-Cashier-123",
  });
  assert.equal(r.status, 201);
  cashier = (
    await call("post", "/auth/login", null, {
      login: "reviewcashier",
      password: "Reviews-Cashier-123",
    })
  ).body;
  const products = (await call("get", "/products")).body;
  [product, otherProduct] = products;
});
beforeEach(async () => {
  await Review.deleteMany({});
  await Bucket.deleteMany({});
  await Order.deleteMany({});
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});
test("Public reading is allowed, but guests/staff cannot write customer reviews and customers cannot moderate", async () => {
  assert.equal((await call("get", endpoint())).status, 200);
  assert.equal((await save(null)).status, 401);
  for (const u of [admin, cashier]) {
    assert.equal((await save(u.token)).status, 403);
    assert.equal(
      (await call("get", endpoint() + "/mine", u.token)).status,
      403,
    );
  }
  assert.equal((await call("get", "/reviews/admin", alice.token)).status, 403);
  assert.equal(
    (await call("get", "/reviews/admin", cashier.token)).status,
    403,
  );
  assert.equal((await call("get", "/reviews/admin")).status, 401);
  assert.equal(
    (
      await call(
        "put",
        "/reviews/admin/" + new mongoose.Types.ObjectId(),
        alice.token,
        { hidden: true, reason: "Spam content" },
      )
    ).status,
    403,
  );
});
test("Only owned, completed and paid online orders containing the product qualify", async () => {
  assert.equal((await save()).status, 403);
  await purchase(bob.user.id);
  assert.equal((await save()).status, 403);
  for (const overrides of [
    { status: "Pending" },
    { status: "Cancelled" },
    { paymentStatus: "Pending" },
    { paymentStatus: "Voided" },
    { source: "pos" },
    {
      items: [
        {
          product: otherProduct._id,
          name: "Other",
          quantity: 1,
          unitPrice: 20,
          subtotal: 20,
        },
      ],
    },
  ]) {
    await Order.deleteMany({});
    await purchase(alice.user.id, overrides);
    assert.equal((await save()).status, 403, JSON.stringify(overrides));
  }
  await Order.deleteMany({});
  await purchase();
  assert.equal(
    (await call("get", endpoint() + "/mine", alice.token)).body.eligible,
    true,
  );
  assert.equal((await save()).status, 200);
});
test("One review per customer/product, safe editable fields and independent customer ownership", async () => {
  await purchase();
  const first = await save();
  assert.equal(first.status, 200);
  assert.equal(first.body.rating, 5);
  const edited = await save(alice.token, {
    ...content,
    rating: 2,
    text: "A fair edit after trying the pastry.",
    customer: bob.user.id,
    hidden: true,
    order: new mongoose.Types.ObjectId(),
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body._id, first.body._id);
  assert.equal(edited.body.hidden, false);
  assert.equal(await Review.countDocuments(), 1);
  assert.equal(String((await Review.findOne()).customer), alice.user.id);
  assert.equal(
    (await call("get", endpoint() + "/mine", bob.token)).body.review,
    null,
  );
  await purchase(bob.user.id);
  await save(bob.token, { ...content, rating: 4 });
  assert.equal(await Review.countDocuments(), 2);
  const summary = (await call("get", endpoint())).body;
  assert.equal(summary.average, 3);
  assert.equal(summary.count, 2);
  assert.deepEqual(summary.distribution, { 2: 1, 4: 1 });
});
test("Concurrent first submissions cannot create duplicate reviews", async () => {
  await purchase();
  const rs = await Promise.all(Array.from({ length: 6 }, () => save()));
  assert.ok(
    rs.every((r) => r.status === 200),
    JSON.stringify(rs.map((r) => r.body)),
  );
  assert.equal(await Review.countDocuments(), 1);
  assert.equal(new Set(rs.map((r) => r.body._id)).size, 1);
});
test("Rating, length, IDs, pagination and display-name validation", async () => {
  await purchase();
  for (const rating of [0, 6, 2.5, "5"])
    assert.equal((await save(alice.token, { ...content, rating })).status, 400);
  for (const body of [
    { ...content, text: "    " },
    { ...content, text: "x".repeat(1001) },
    { ...content, displayName: " " },
    { ...content, displayName: "x".repeat(41) },
  ])
    assert.equal((await save(alice.token, body)).status, 400);
  assert.equal((await call("get", "/reviews/product/not-an-id")).status, 400);
  assert.equal(
    (await call("get", "/reviews/product/" + new mongoose.Types.ObjectId()))
      .status,
    404,
  );
  assert.equal((await call("get", endpoint() + "?page=-1")).status, 400);
});
test("Public output exposes only a chosen display name, not customer/order IDs or contact details", async () => {
  await purchase();
  await save(alice.token, {
    ...content,
    text: "<img src=x onerror=alert(1)> is plain text.",
  });
  const r = (await call("get", endpoint())).body.items[0];
  assert.equal(r.displayName, content.displayName);
  assert.equal(r.verifiedPurchase, true);
  assert.ok(r.text.includes("<img"));
  assert.deepEqual(
    Object.keys(r).sort(),
    [
      "_id",
      "rating",
      "text",
      "displayName",
      "createdAt",
      "updatedAt",
      "verifiedPurchase",
    ].sort(),
  );
  assert.ok(!JSON.stringify(r).includes(alice.user.id));
});
test("Moderation is audited, hidden reviews leave ratings, and customer edits cannot unhide them", async () => {
  await purchase();
  const review = (await save()).body;
  assert.equal(
    (
      await call("put", "/reviews/admin/" + review._id, admin.token, {
        hidden: true,
        reason: "",
      })
    ).status,
    400,
  );
  const hide = await call("put", "/reviews/admin/" + review._id, admin.token, {
    hidden: true,
    reason: "Contains personal contact information.",
  });
  assert.equal(hide.status, 200);
  assert.equal((await call("get", endpoint())).body.count, 0);
  assert.deepEqual((await call("get", "/reviews/summary")).body, []);
  const own = (await call("get", endpoint() + "/mine", alice.token)).body
    .review;
  assert.equal(own.hidden, true);
  assert.ok(own.moderationReason.includes("contact"));
  await save(alice.token, {
    ...content,
    hidden: false,
    text: "Now revised without personal details.",
  });
  assert.equal((await Review.findById(review._id)).hidden, true);
  const logs = await AuditLog.find({
    entityId: review._id,
    action: "review.hide",
  });
  assert.equal(logs.length, 1);
  assert.equal(
    logs[0].details.reason,
    "Contains personal contact information.",
  );
  assert.equal(
    (await call("get", "/reviews/admin?status=Hidden", admin.token)).body.total,
    1,
  );
  assert.equal(
    (
      await call("put", "/reviews/admin/" + review._id, admin.token, {
        hidden: false,
        reason: "Personal information has been removed.",
      })
    ).status,
    200,
  );
  assert.equal((await call("get", endpoint())).body.count, 1);
  assert.equal((await call("get", "/reviews/summary")).body[0].average, 5);
});
test("Public and moderation pagination remain bounded and deterministic", async () => {
  const docs = Array.from({ length: 23 }, (_, i) => ({
    product: product._id,
    customer: new mongoose.Types.ObjectId(),
    order: new mongoose.Types.ObjectId(),
    rating: (i % 5) + 1,
    text: "Fixture review " + i,
    displayName: "Tester " + i,
  }));
  await Review.insertMany(docs);
  const pages = await Promise.all(
    [1, 2, 3].map((p) => call("get", endpoint() + "?page=" + p)),
  );
  assert.deepEqual(
    pages.map((r) => r.body.items.length),
    [10, 10, 3],
  );
  assert.equal(
    new Set(pages.flatMap((r) => r.body.items.map((x) => x._id))).size,
    23,
  );
  assert.equal(pages[0].body.pages, 3);
  const adminPages = await Promise.all(
    [1, 2].map((p) => call("get", "/reviews/admin?page=" + p, admin.token)),
  );
  assert.deepEqual(
    adminPages.map((r) => r.body.items.length),
    [20, 3],
  );
});
test("Per-account write throttling leaves reads available and does not mutate stock/order/payment", async () => {
  const order = await purchase(),
    before = await Product.findById(product._id).lean();
  for (let i = 0; i < 10; i++) assert.equal((await save()).status, 200);
  const blocked = await save();
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, "REVIEW_RATE_LIMIT");
  assert.ok(blocked.body.retryAfter >= 1 && blocked.body.retryAfter <= 60);
  assert.ok(blocked.headers["retry-after"]);
  assert.equal(
    (await call("get", endpoint() + "/mine", alice.token)).status,
    200,
  );
  assert.equal((await call("get", endpoint())).status, 200);
  assert.equal((await Order.findById(order._id)).status, "Completed");
  assert.equal((await Order.findById(order._id)).paymentStatus, "Paid");
  assert.equal((await Product.findById(product._id)).stock, before.stock);
  await purchase(bob.user.id);
  assert.equal((await save(bob.token)).status, 200);
});
