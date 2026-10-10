import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { app } from "../app.js";
import { seed } from "../seed/seedDatabase.js";
import {
  Product,
  Category,
  Promotion,
  Payment,
} from "../models/index.js";
import FlashSale from "../models/FlashSale.js";
import Bundle from "../models/Bundle.js";
import QualityComplaint from "../models/QualityComplaint.js";
let repl, alice, bob, admin, cashier, pastry, shake, category;
const call = (method, path, token, data) => {
  const r = request(app)[method]("/api" + path);
  if (token) r.set("Authorization", "Bearer " + token);
  return data ? r.send(data) : r;
};
const orderBody = (items, extra = {}) => ({
  items,
  paymentMethod: "Cash",
  idempotencyKey: crypto.randomUUID(),
  ...extra,
});
const complaintBody = (order, extra = {}) => ({
  order,
  issueType: "Mold / Spoilage",
  description: "Found green mold inside the box this morning.",
  ...extra,
});
before(async () => {
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  process.env.SEED_ADMIN_EMAIL = "mktadmin@example.com";
  process.env.SEED_ADMIN_PASSWORD = "Mkt-Admin-Test-1234";
  process.env.DEMO_PAYMENTS_ENABLED = "true";
  process.env.ORDER_ACCOUNT_LIMIT = "50";
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
  ).body.token;
  for (const name of ["mktalice", "mktbob"]) {
    const r = await call("post", "/auth/register", null, {
      name,
      email: name + "@example.com",
      phone: "09123456789",
      username: name,
      password: "Mkt-Customer-1234",
      confirmPassword: "Mkt-Customer-1234",
    });
    assert.equal(r.status, 201);
    if (name === "mktalice") alice = r.body.token;
    else bob = r.body.token;
  }
  await call("post", "/users", admin, {
    name: "Mkt Cashier",
    email: "mktcashier@example.com",
    username: "mktcashier",
    role: "cashier",
    password: "Mkt-Cashier-1234",
  });
  cashier = (
    await call("post", "/auth/login", null, {
      login: "mktcashier",
      password: "Mkt-Cashier-1234",
    })
  ).body.token;
  category = await Category.findOne();
  pastry = await Product.create({
    name: "Audit Pastry",
    category: category._id,
    price: 100,
    stock: 100,
    available: true,
  });
  shake = await Product.create({
    name: "Audit Shake",
    category: category._id,
    price: 50,
    stock: 100,
    available: true,
  });
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

test("VAT is computed on the discounted subtotal", async () => {
  await Promotion.create({
    name: "Audit promo",
    code: "AUDIT10",
    percent: 10,
    active: true,
  });
  const r = await call(
    "post",
    "/orders",
    alice,
    orderBody([{ product: pastry._id, quantity: 1 }], {
      promoCode: "AUDIT10",
    }),
  );
  assert.equal(r.status, 201);
  assert.equal(r.body.subtotal, 100);
  assert.equal(r.body.discount, 10);
  assert.equal(r.body.vat, 10.8); // (100 - 10) * 0.12 — not 12
  assert.equal(r.body.total, 100.8);
});

test("Active flash sale discounts the product price once per customer cap", async () => {
  const sale = await FlashSale.create({
    name: "Audit Flash",
    discountPercent: 20,
    products: [pastry._id],
    startDate: new Date(Date.now() - 60000),
    endDate: new Date(Date.now() + 3600000),
    active: true,
    maxUsesPerCustomer: 1,
  });
  const first = await call(
    "post",
    "/orders",
    alice,
    orderBody([{ product: pastry._id, quantity: 1 }]),
  );
  assert.equal(first.status, 201);
  assert.equal(first.body.items[0].unitPrice, 80);
  assert.equal(first.body.subtotal, 80);
  // Second order exceeds maxUsesPerCustomer → full price.
  const second = await call(
    "post",
    "/orders",
    alice,
    orderBody([{ product: pastry._id, quantity: 1 }]),
  );
  assert.equal(second.status, 201);
  assert.equal(second.body.items[0].unitPrice, 100);
  const updated = await FlashSale.findById(sale._id);
  assert.equal(updated.usedBy.length, 1);
});

test("Bundle discount applies only when the order covers every bundle item", async () => {
  const bundle = await Bundle.create({
    name: "Audit Pair",
    items: [
      { product: pastry._id, name: "Audit Pastry", quantity: 1 },
      { product: shake._id, name: "Audit Shake", quantity: 1 },
    ],
    originalPrice: 150,
    bundlePrice: 120,
    active: true,
  });
  // Missing the shake → rejected.
  const incomplete = await call(
    "post",
    "/orders",
    alice,
    orderBody([{ product: pastry._id, quantity: 1 }], {
      bundleId: String(bundle._id),
    }),
  );
  assert.equal(incomplete.status, 400);
  // Complete bundle → savings folded into discount.
  const complete = await call(
    "post",
    "/orders",
    alice,
    orderBody(
      [
        { product: pastry._id, quantity: 1 },
        { product: shake._id, quantity: 1 },
      ],
      { bundleId: String(bundle._id) },
    ),
  );
  assert.equal(complete.status, 201);
  assert.equal(complete.body.subtotal, 150);
  assert.equal(complete.body.discount, 30); // 150 - 120
  // A bogus/expired bundle id is rejected.
  const bogus = await call(
    "post",
    "/orders",
    alice,
    orderBody(
      [
        { product: pastry._id, quantity: 1 },
        { product: shake._id, quantity: 1 },
      ],
      { bundleId: String(new mongoose.Types.ObjectId()) },
    ),
  );
  assert.equal(bogus.status, 400);
});

test("Complaint creation validates order id, existence, ownership and photoUrl scheme", async () => {
  const order = (
    await call(
      "post",
      "/orders",
      alice,
      orderBody([{ product: pastry._id, quantity: 1 }]),
    )
  ).body;
  // Human-readable order number is NOT a valid id — the old UI bug.
  const byNumber = await call(
    "post",
    "/quality",
    alice,
    complaintBody(order.number),
  );
  assert.equal(byNumber.status, 400);
  // Nonexistent order → 404.
  const missing = await call(
    "post",
    "/quality",
    alice,
    complaintBody(String(new mongoose.Types.ObjectId())),
  );
  assert.equal(missing.status, 404);
  // Another customer's order → 403.
  const other = await call(
    "post",
    "/quality",
    bob,
    complaintBody(order._id),
  );
  assert.equal(other.status, 403);
  // javascript: photoUrl → rejected.
  const xss = await call(
    "post",
    "/quality",
    alice,
    complaintBody(order._id, { photoUrl: "javascript:alert(1)" }),
  );
  assert.equal(xss.status, 400);
  // Valid complaint → 201, server-generated ticket, order number auto-filled.
  const ok = await call("post", "/quality", alice, complaintBody(order._id));
  assert.equal(ok.status, 201);
  assert.match(ok.body.ticket, /^QC-/);
  assert.equal(ok.body.complaint.orderNumber, order.number);
});

test("Cashier can view tickets but only admins can confirm refunds", async () => {
  // Alice places a paid order via the demo GCash flow.
  const otp = (
    await call("post", "/payments/demo-otp", alice, {})
  ).body;
  await call("post", "/payments/demo-verify", alice, {
    sessionId: otp.sessionId,
    code: otp.demoCode,
  });
  const paid = (
    await call(
      "post",
      "/orders",
      alice,
      orderBody([{ product: pastry._id, quantity: 1 }], {
        paymentMethod: "Demo GCash",
        otpSession: otp.sessionId,
      }),
    )
  ).body;
  assert.equal(paid.paymentStatus, "Paid");
  const comp = (
    await call("post", "/quality", alice, complaintBody(paid._id))
  ).body.complaint;
  // Cashier ticket lookup works again (previously 403 via the "staff" check).
  const lookup = await call("get", "/quality/ticket/" + comp.ticket, cashier);
  assert.equal(lookup.status, 200);
  // Cashier cannot refund; admin can, and the payment is voided.
  const cashierRefund = await call(
    "put",
    "/quality/" + comp._id + "/status",
    cashier,
    { status: "Refunded" },
  );
  assert.equal(cashierRefund.status, 403);
  const adminRefund = await call(
    "put",
    "/quality/" + comp._id + "/status",
    admin,
    { status: "Refunded" },
  );
  assert.equal(adminRefund.status, 200);
  const payment = await Payment.findOne({ order: paid._id });
  assert.equal(payment.status, "Voided");
  const complaint = await QualityComplaint.findById(comp._id);
  assert.equal(complaint.status, "Refunded");
});
