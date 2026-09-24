import crypto from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { DemoOTPSession, Order, AuditLog } from "../models/index.js";
import { fail, id } from "../utils/validators.js";
import { recordPayment } from "../services/orderService.js";
const hash = (c) => crypto.createHash("sha256").update(c).digest("hex");
export async function otp(req, res) {
  if (process.env.DEMO_PAYMENTS_ENABLED !== "true")
    throw fail(400, "Demo payments disabled.");
  const code = crypto.randomInt(100000, 1000000).toString();
  const o = await DemoOTPSession.create({
    user: req.user._id,
    codeHash: hash(code),
    expiresAt: new Date(Date.now() + 300000),
  });
  res
    .status(201)
    .json({
      sessionId: o.id,
      demoCode: code,
      message: "Demo code only. No real SMS was sent.",
      expiresIn: 300,
    });
}
export async function verify(req, res) {
  const d = z
    .object({ sessionId: id, code: z.string().regex(/^\d{6}$/) })
    .parse(req.body);
  const o = await DemoOTPSession.findOneAndUpdate(
    {
      _id: d.sessionId,
      user: req.user._id,
      used: false,
      verified: false,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    },
    { $inc: { attempts: 1 } },
    { new: true },
  ).select("+codeHash");
  if (!o)
    throw fail(
      400,
      "Code expired or too many attempts. Request a new demo code.",
    );
  if (hash(d.code) !== o.codeHash) throw fail(400, "Incorrect demo code.");
  await DemoOTPSession.updateOne(
    { _id: o._id, used: false },
    { $set: { verified: true } },
  );
  res.json({ message: "Demo verification successful!", sessionId: o.id });
}
export async function collect(req, res) {
  const d = z
    .object({ order: id, amountReceived: z.number().min(0).max(1000000) })
    .parse(req.body);
  await mongoose.connection.transaction(async (session) => {
    const o = await Order.findById(d.order).session(session);
    if (
      !o ||
      o.status === "Cancelled" ||
      o.paymentStatus !== "Pending" ||
      o.paymentMethod !== "Cash"
    )
      throw fail(409, "This order cannot accept a cash payment.");
    if (d.amountReceived < o.total)
      throw fail(400, "Amount received is below the total.");
    await recordPayment(o, d.amountReceived, session);
    o.paymentStatus = "Paid";
    o.cashier = req.user._id;
    await o.save({ session });
    await AuditLog.create(
      [
        {
          actor: req.user._id,
          action: "payment.collected",
          entity: "Order",
          entityId: o.id,
        },
      ],
      { session },
    );
  });
  res.json({ message: "Payment collected." });
}
