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
  Payment,
  Sale,
  Order,
  Refund,
} from "../models/index.js";

let repl, alice, admin, cashier, pastry, category;
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

before(async () => {
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  process.env.SEED_ADMIN_EMAIL = "refundadmin@example.com";
  process.env.SEED_ADMIN_PASSWORD = "Refund-Admin-Test-1234";
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
  const reg = await call("post", "/auth/register", null, {
    name: "refundalice",
    email: "refundalice@example.com",
    phone: "09123456789",
    username: "refundalice",
    password: "Refund-Alice-1234",
    confirmPassword: "Refund-Alice-1234",
  });
  assert.equal(reg.status, 201);
  alice = reg.body.token;
  await call("post", "/users", admin, {
    name: "Refund Cashier",
    email: "refundcashier@example.com",
    username: "refundcashier",
    role: "cashier",
    password: "Refund-Cashier-1234",
  });
  cashier = (
    await call("post", "/auth/login", null, {
      login: "refundcashier",
      password: "Refund-Cashier-1234",
    })
  ).body.token;
  category = await Category.findOne();
  pastry = await Product.create({
    name: "Refund Pastry",
    category: category._id,
    price: 100,
    stock: 100,
    available: true,
  });
});

after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

test("Customer refund request lifecycle: create, approve, void records", async () => {
  const otp = (await call("post", "/payments/demo-otp", alice, {})).body;
  await call("post", "/payments/demo-verify", alice, {
    sessionId: otp.sessionId,
    code: otp.demoCode,
  });
  const paid = (
    await call(
      "post",
      "/orders",
      alice,
      orderBody([{ product: pastry._id, quantity: 2 }], {
        paymentMethod: "Demo GCash",
        otpSession: otp.sessionId,
      }),
    )
  ).body;
  assert.equal(paid.paymentStatus, "Paid");
  assert.equal(paid.total, 224); // 200 + 24 VAT

  const req = await call("post", "/refunds", alice, {
    order: paid._id,
    amount: 100,
    reason: "One of the pastries arrived crushed.",
  });
  assert.equal(req.status, 201);
  assert.equal(req.body.status, "Pending");
  assert.equal(req.body.amount, 100);

  // Staff can list.
  const list = await call("get", "/refunds", cashier);
  assert.equal(list.status, 200);
  assert.ok(list.body.some((r) => String(r._id) === String(req.body._id)));

  // Cashier cannot approve (admin only).
  const cashierApprove = await call("put", "/refunds/" + req.body._id, cashier, {
    status: "Approved",
  });
  assert.equal(cashierApprove.status, 403);

  // Admin approves.
  const approve = await call("put", "/refunds/" + req.body._id, admin, {
    status: "Approved",
    note: "Approved partial refund.",
  });
  assert.equal(approve.status, 200);
  assert.equal(approve.body.status, "Approved");
  assert.equal(approve.body.note, "Approved partial refund.");

  // Payment, sale and order are voided.
  const order = await Order.findById(paid._id);
  assert.equal(order.paymentStatus, "Voided");
  const payment = await Payment.findOne({ order: paid._id });
  assert.equal(payment.status, "Voided");
  const sale = await Sale.findOne({ order: paid._id });
  assert.equal(sale.voided, true);

  // Re-approving a processed refund fails.
  const again = await call("put", "/refunds/" + req.body._id, admin, {
    status: "Approved",
  });
  assert.equal(again.status, 409);
});

test("Refund validation rules", async () => {
  const pending = (
    await call("post", "/orders", alice, orderBody([{ product: pastry._id, quantity: 1 }]))
  ).body;
  // Unpaid order cannot be refunded.
  const unPaid = await call("post", "/refunds", alice, {
    order: pending._id,
    reason: "too slow",
  });
  assert.equal(unPaid.status, 409);

  const paid = (
    await call("post", "/orders", alice, orderBody([{ product: pastry._id, quantity: 1 }]))
  ).body;
  // Fake payment status for speed: set order paid directly and create payment/sale.
  await Order.updateOne({ _id: paid._id }, { $set: { paymentStatus: "Paid" } });
  await Payment.create({
    order: paid._id,
    method: "Cash",
    amount: paid.total,
    received: paid.total,
    change: 0,
    status: "Paid",
  });
  await Sale.create({ order: paid._id, amount: paid.total, discount: 0, vat: paid.vat });

  const first = await call("post", "/refunds", alice, {
    order: paid._id,
    reason: "mold",
  });
  assert.equal(first.status, 201);

  // Duplicate pending refund on same order blocked.
  const dup = await call("post", "/refunds", alice, {
    order: paid._id,
    reason: "still mold",
  });
  assert.equal(dup.status, 409);

  // Amount cannot exceed order total.
  const over = await call("post", "/refunds", alice, {
    order: paid._id,
    amount: 999999,
    reason: "all of it",
  });
  // The previous pending blocks this first; but since previous is pending, blocked.
  // For amount-cap, use a fresh paid order.
  assert.equal(over.status, 409); // duplicate pending
});

test("Refund amount is capped at order total", async () => {
  const paid = (
    await call("post", "/orders", alice, orderBody([{ product: pastry._id, quantity: 1 }]))
  ).body;
  await Order.updateOne({ _id: paid._id }, { $set: { paymentStatus: "Paid" } });
  await Payment.create({
    order: paid._id,
    method: "Cash",
    amount: paid.total,
    received: paid.total,
    change: 0,
    status: "Paid",
  });
  const req = await call("post", "/refunds", alice, {
    order: paid._id,
    amount: 999999,
    reason: "too much",
  });
  assert.equal(req.status, 201);
  assert.ok(req.body.amount <= paid.total, "Amount was capped at order total");
});
