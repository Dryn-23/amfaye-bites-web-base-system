import { Router } from "express";
import { auth } from "../middleware/authMiddleware.js";
import { staff } from "../middleware/roleMiddleware.js";
import { wrap, id, fail } from "../utils/validators.js";
import { QualityComplaint } from "../models/index.js";

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
  const list = await QualityComplaint.find(filter).sort({ createdAt: -1 }).limit(200).populate("customer", "name").populate("order", "status");
  res.json(list);
}));

// Staff: update status / note / resolve
r.put("/:id/status", staff, wrap(async (req, res) => {
  const { status, staffNote } = req.body;
  const allowed = ["Open", "Under Review", "Resolved", "Refunded", "Rejected"];
  if (status && !allowed.includes(status)) throw fail(400, "Invalid status.");
  const update = {};
  if (status) update.status = status;
  if (staffNote !== undefined) update.staffNote = String(staffNote).slice(0, 2000);
  const comp = await QualityComplaint.findByIdAndUpdate(id.parse(req.params.id), update, { new: true });
  if (!comp) throw fail(404, "Not found.");
  res.json(comp);
}));

export default r;
