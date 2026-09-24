import { z } from "zod";
import { Order, Payment, Receipt } from "../models/index.js";
import { createOrder, changeStatus } from "../services/orderService.js";
import { fail, id } from "../utils/validators.js";
export async function create(req, res) {
  res.status(201).json(await createOrder(req.body, req.user));
}
export async function list(req, res) {
  const filter = req.user.role === "customer" ? { user: req.user._id } : {};
  if (req.query.status)
    filter.status = z
      .enum([
        "Pending",
        "Confirmed",
        "Preparing",
        "Ready for Pickup",
        "Completed",
        "Cancelled",
      ])
      .parse(req.query.status);
  res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(200));
}
export async function detail(req, res) {
  const o = await Order.findById(id.parse(req.params.id)).populate(
    "cashier",
    "name",
  );
  if (!o) throw fail(404, "Order not found.");
  if (req.user.role === "customer" && String(o.user) !== req.user.id)
    throw fail(403, "You can only view your own orders.");
  res.json({
    ...o.toObject(),
    payment: await Payment.findOne({ order: o._id }),
    receipt: await Receipt.findOne({ order: o._id }),
  });
}
export async function status(req, res) {
  const status = z
    .enum([
      "Pending",
      "Confirmed",
      "Preparing",
      "Ready for Pickup",
      "Completed",
      "Cancelled",
    ])
    .parse(req.body.status);
  res.json(await changeStatus(id.parse(req.params.id), status, req.user));
}
