import { Router } from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/authMiddleware.js";
import { staff } from "../middleware/roleMiddleware.js";
import { wrap, id, fail } from "../utils/validators.js";
import { QualityComplaint, Payment, Sale, AuditLog, Order } from "../models/index.js";

function makeTicket() {
  return "QC-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

const r = Router();
r.use(auth);

// Customer: create quality complaint / refund request
r.post("/", wrap(async (req, res) => {
  const { order, issueType, description, orderNumber, photoUrl } = req.body;
  if (!order || !issueType || !description) throw fail(400, "Order, issue type, and description are required.");
  if (!req.user?._id) throw fail(401, "Login required.");

  const keywords = ["insect", "bug", "mold", "mould", "damaged", "crushed", "spoil", "rotten", "contaminated", "dirty"];
  const text = (description || "").toLowerCase();
  const flags = keywords.filter(k => text.includes(k));

  const ticket = (req.body.ticket && typeof req.body.ticket === "string" && req.body.ticket.trim().length > 2)
    ? req.body.ticket.trim()
    : makeTicket();

  const complaint = await QualityComplaint.create({
    order,
    customer: req.user._id,
    orderNumber: (orderNumber || "").trim().slice(0, 50),
    issueType,
    description: description.trim().slice(0, 2000),
    photoUrl: (photoUrl || "").trim().slice(0, 500),
    status: flags.length ? "Under Review" : "Open",
    ticket,
    keywordFlags: flags,
  });

  res.status(201).json({ complaint, ticket, flagged: flags.length > 0 });
}));

// Customer: list own complaints (track ticket)
r.get("/my", wrap(async (req, res) => {
  const list = await QualityComplaint.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json(list);
}));

// Customer / staff: get by ticket
r.get("/ticket/:ticket", wrap(async (req, res) => {
  const comp = await QualityComplaint.findOne({ ticket: req.params.ticket }).populate("customer", "name email");
  if (!comp) throw fail(404, "Ticket not found.");
  if (req.user.role !== "admin" && req.user.role !== "staff" && String(comp.customer?._id) !== String(req.user._id)) throw fail(403, "Not authorized.");
  res.json(comp);
}));

// Staff / admin: list all with optional keyword filter
r.get("/", staff, wrap(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.keyword) filter.keywordFlags = req.query.keyword;
  const populate = req.query.populate ? String(req.query.populate).split(",").map(s => s.trim()) : [];
  let q = QualityComplaint.find(filter).sort({ createdAt: -1 }).limit(200);
  if (populate.includes("order")) q = q.populate("order", "status total number");
  if (populate.includes("customer")) q = q.populate("customer", "name email");
  const list = await q;
  res.json(list);
}));

// Staff: update status / note / resolve
// Refund confirmation also voids the order payment (money back) and marks the sale
// voided so it is deducted from sales totals, mirroring order cancellation.
r.put("/:id/status", staff, wrap(async (req, res) => {
  const { status, staffNote } = req.body;
  const allowed = ["Open", "Under Review", "Resolved", "Refunded", "Rejected"];
  if (status && !allowed.includes(status)) throw fail(400, "Invalid status.");
  const update = {};
  if (status) update.status = status;
  if (staffNote !== undefined) update.staffNote = String(staffNote).slice(0, 2000);

  if (status !== "Refunded") {
    const comp = await QualityComplaint.findByIdAndUpdate(id.parse(req.params.id), update, { new: true });
    if (!comp) throw fail(404, "Not found.");
    return res.json(comp);
  }

  const result = await mongoose.connection.transaction(async (session) => {
    const comp = await QualityComplaint.findById(id.parse(req.params.id)).session(session);
    if (!comp) throw fail(404, "Not found.");
    if (comp.status === "Refunded") return comp;

    const order = await Order.findById(comp.order).session(session);
    if (!order) throw fail(404, "Order not found.");
    if (order.paymentStatus !== "Paid")
      throw fail(409, "Only paid orders can be refunded.");

    await QualityComplaint.updateOne(
      { _id: comp._id },
      { $set: { status: "Refunded", staffNote: update.staffNote ?? "" } },
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
          action: "quality.refunded",
          entity: "QualityComplaint",
          entityId: String(comp._id),
          details: { ticket: comp.ticket, order: order._id, amount: order.total },
        },
      ],
      { session },
    );
    await order.save({ session });
    return QualityComplaint.findById(comp._id).session(session);
  });
  res.json(result);
}));

export default r;
