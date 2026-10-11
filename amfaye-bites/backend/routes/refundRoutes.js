import { Router } from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/authMiddleware.js";
import { admin, staff } from "../middleware/roleMiddleware.js";
import { wrap, id, fail } from "../utils/validators.js";
import { Refund, Order, Payment, Sale, AuditLog } from "../models/index.js";

function toCents(n) {
  return Math.round((Number(n) || 0) * 100);
}

function toAmount(items) {
  return items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
}

function validateInput(req) {
  const { order, items, amount, reason } = req.body || {};
  if (!order || typeof order !== "string" || order.length !== 24)
    throw fail(400, "Invalid order.");
  const parsedItems = Array.isArray(items)
    ? items
        .map((i) => ({
          product: String(i.product || "").trim(),
          name: String(i.name || "").trim().slice(0, 100),
          quantity: Math.max(0, Math.round(Number(i.quantity) || 0)),
          unitPrice: Math.max(0, Number(i.unitPrice) || 0),
        }))
        .filter((i) => i.quantity > 0)
    : [];
  const parsedAmount = Number(amount);
  const validAmount =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? Math.round(parsedAmount * 100) / 100
      : null;
  return {
    orderId: order,
    items: parsedItems,
    amount: validAmount,
    reason: String(reason || "").trim().slice(0, 2000),
  };
}

const r = Router();
r.use(auth);

// Customer: request a refund for a paid, owned order.
r.post("/", wrap(async (req, res) => {
  const { orderId, items, amount, reason } = validateInput(req);
  const order = await Order.findById(orderId).lean();
  if (!order) throw fail(404, "Order not found.");
  if (String(order.user) !== String(req.user._id))
    throw fail(403, "You can only request a refund for your own order.");
  if (order.paymentStatus === "Voided" || order.status === "Cancelled")
    throw fail(409, "Refunds are not available for voided or cancelled orders.");

  const pending = await Refund.findOne({ order: order._id, status: "Pending" }).lean();
  if (pending) throw fail(409, "A refund request for this order is already pending.");

  const refundItems =
    items.length > 0
      ? items
      : order.items.map((i) => ({
          product: i.product,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        }));

  const computed = toAmount(refundItems);
  const refundAmount =
    amount != null && toCents(amount) <= toCents(order.total)
      ? amount
      : computed > 0 && toCents(computed) <= toCents(order.total)
        ? computed
        : order.total;

  const refund = await Refund.create({
    order: order._id,
    customer: req.user._id,
    items: refundItems,
    amount: refundAmount,
    reason,
    status: "Pending",
    requestedBy: req.user._id,
  });
  res.status(201).json(refund);
}));

// Customer: list own refund requests.
r.get("/my", wrap(async (req, res) => {
  const list = await Refund.find({ customer: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("order", "number total paymentStatus");
  res.json(list);
}));

// Staff/admin: list all refund requests.
r.get("/", staff, wrap(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const list = await Refund.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("order", "number total paymentStatus")
    .populate("customer", "name email")
    .populate("requestedBy", "name");
  res.json(list);
}));

// Detail: owner or staff.
r.get("/:id", wrap(async (req, res) => {
  const refund = await Refund.findById(id.parse(req.params.id))
    .populate("order", "number total paymentStatus")
    .populate("customer", "name email")
    .populate("requestedBy", "name")
    .populate("processedBy", "name");
  if (!refund) throw fail(404, "Refund not found.");
  if (
    !["admin", "cashier"].includes(req.user.role) &&
    String(refund.customer?._id) !== String(req.user._id)
  )
    throw fail(403, "Not authorized.");
  res.json(refund);
}));

// Admin: approve or reject a refund.
r.put("/:id", admin, wrap(async (req, res) => {
  const { status, note } = req.body || {};
  const allowed = ["Approved", "Rejected"];
  if (!allowed.includes(status)) throw fail(400, "Invalid status.");
  const refundId = id.parse(req.params.id);
  const adminNote =
    note === undefined ? undefined : String(note).slice(0, 2000);

  if (status === "Rejected") {
    const refund = await Refund.findByIdAndUpdate(
      refundId,
      {
        $set: {
          status: "Rejected",
          note: adminNote ?? "",
          processedBy: req.user._id,
          processedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!refund) throw fail(404, "Refund not found.");
    return res.json(refund);
  }

  // Approved: void payment and sale, mark order payment status voided.
  const refund = await mongoose.connection.transaction(async (session) => {
    const r = await Refund.findById(refundId).session(session);
    if (!r) throw fail(404, "Refund not found.");
    if (r.status !== "Pending") throw fail(409, "Refund was already processed.");

    const order = await Order.findById(r.order).session(session);
    if (!order) throw fail(404, "Order not found.");
    if (order.paymentStatus !== "Paid")
      throw fail(409, "Order payment is not in a paid state.");

    await Refund.updateOne(
      { _id: r._id },
      {
        $set: {
          status: "Approved",
          note: adminNote ?? r.note ?? "",
          processedBy: req.user._id,
          processedAt: new Date(),
        },
      },
      { session },
    );
    await Order.updateOne(
      { _id: order._id },
      { $set: { paymentStatus: "Voided" } },
      { session },
    );
    await Payment.updateOne(
      { order: order._id },
      { $set: { status: "Voided" } },
      { session },
    );
    await Sale.updateOne(
      { order: order._id },
      { $set: { voided: true } },
      { session },
    );
    await AuditLog.create(
      [
        {
          actor: req.user._id,
          action: "refund.approved",
          entity: "Refund",
          entityId: String(r._id),
          details: {
            order: order._id,
            amount: r.amount,
            customer: r.customer,
          },
        },
      ],
      { session },
    );
    return Refund.findById(r._id).session(session);
  });
  res.json(refund);
}));

export default r;
