import { notifyOrderStatus } from "./notificationService.js";
import mongoose from "mongoose";
import crypto from "node:crypto";
import {
  Product,
  ProductAddon,
  ProductRecipe,
  Ingredient,
  InventoryTransaction,
  Order,
  Payment,
  Sale,
  Receipt,
  AuditLog,
  DemoOTPSession,
  Promotion,
  Cart,
} from "../models/index.js";
import { fail, orderInput } from "../utils/validators.js";
export const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export async function createOrder(body, user) {
  const input = orderInput.parse(body);
  if (input.source === "pos" && !["admin", "cashier"].includes(user.role))
    throw fail(403, "Only staff can place POS orders.");
  if (
    input.source === "web" &&
    input.paymentMethod === "Cash" &&
    input.amountReceived !== undefined
  )
    throw fail(400, "Cash is collected by staff at pickup.");
  let result;
  await mongoose.connection.transaction(async (session) => {
    const existing = await Order.findOne({
      user: user._id,
      idempotencyKey: input.idempotencyKey,
    }).session(session);
    if (existing) {
      result = existing;
      return;
    }
    const items = [];
    const usage = new Map();
    let subtotal = 0;
    for (const line of input.items) {
      const p = await Product.findById(line.product).session(session);
      if (!p || !p.available || p.stock < line.quantity)
        throw fail(
          409,
          `${p?.name || "Product"} is unavailable or has insufficient stock.`,
        );
      let extra = 0;
      const addons = [];
      let customization = {};
      if (p.customizable) {
        extra = { Small: 0, Medium: 20, Large: 40 }[line.customization.size];
        const unique = [...new Set(line.customization.addons)];
        for (const addonId of unique) {
          const a = await ProductAddon.findOne({
            _id: addonId,
            active: true,
          }).session(session);
          if (!a) throw fail(400, "An add-on is no longer available.");
          extra += a.price;
          addons.push({ name: a.name, price: a.price });
          if (a.ingredient)
            usage.set(
              String(a.ingredient),
              (usage.get(String(a.ingredient)) || 0) +
                a.quantity * line.quantity,
            );
        }
        customization = { ...line.customization, addons };
      } else if (
        line.customization.addons.length ||
        line.customization.size !== "Small"
      )
        throw fail(400, "This pastry cannot be customized.");
      const unitPrice = round(p.price + extra);
      const lineTotal = round(unitPrice * line.quantity);
      subtotal = round(subtotal + lineTotal);
      items.push({
        product: p._id,
        name: p.name,
        image: p.image,
        quantity: line.quantity,
        unitPrice,
        subtotal: lineTotal,
        customization,
      });
      const updated = await Product.updateOne(
        { _id: p._id, available: true, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } },
        { session },
      );
      if (updated.modifiedCount !== 1)
        throw fail(409, "Stock changed. Please review your cart.");
      const recipe = await ProductRecipe.findOne({ product: p._id }).session(
        session,
      );
      const factor = p.customizable
        ? { Small: 1, Medium: 1.25, Large: 1.5 }[line.customization.size]
        : 1;
      for (const r of recipe?.ingredients || []) {
        const ingredient = await Ingredient.findById(r.ingredient)
          .select("unit")
          .session(session);
        if (!ingredient)
          throw fail(
            409,
            "A recipe ingredient is missing. Please contact staff.",
          );
        const scale = ingredient.unit === "pc" ? 1 : factor;
        usage.set(
          String(r.ingredient),
          (usage.get(String(r.ingredient)) || 0) +
            r.quantity * line.quantity * scale,
        );
      }
    }
    let discount = 0;
    if (input.promoCode) {
      const promo = await Promotion.findOne({
        code: input.promoCode.trim().toUpperCase(),
        active: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      }).session(session);
      if (!promo) throw fail(400, "Promotion code is invalid or expired.");
      discount = round((subtotal * promo.percent) / 100);
    }
    const total = round(subtotal - discount);
    let paid = input.paymentMethod === "Demo GCash" || input.source === "pos";
    let received = total;
    if (input.paymentMethod === "Demo GCash") {
      if (process.env.DEMO_PAYMENTS_ENABLED !== "true")
        throw fail(400, "Demo payments are disabled.");
      const otp = await DemoOTPSession.findOneAndUpdate(
        {
          _id: input.otpSession,
          user: user._id,
          verified: true,
          used: false,
          expiresAt: { $gt: new Date() },
        },
        { $set: { used: true } },
        { session, new: true },
      );
      if (!otp) throw fail(400, "Verify a new demo code before paying.");
    } else if (input.source === "pos") {
      received = input.amountReceived;
      if (received === undefined || received < total)
        throw fail(400, "Amount received must cover the total.");
    }
    const number = `AB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const [order] = await Order.create(
      [
        {
          number,
          user: user._id,
          cashier: input.source === "pos" ? user._id : undefined,
          source: input.source,
          customerName: input.customerName || user.name,
          items,
          subtotal,
          discount,
          total,
          status: input.source === "pos" ? "Completed" : "Pending",
          paymentMethod: input.paymentMethod,
          paymentStatus: paid ? "Paid" : "Pending",
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
          inventoryUsage: [...usage].map(([ingredient, quantity]) => ({
            ingredient,
            quantity,
          })),
        },
      ],
      { session },
    );
    for (const [ingredient, quantity] of usage) {
      const i = await Ingredient.findOneAndUpdate(
        {
          _id: ingredient,
          stock: { $gte: quantity },
          $or: [
            { expirationDate: null },
            { expirationDate: { $gt: new Date() } },
          ],
        },
        { $inc: { stock: -quantity } },
        { new: true, session },
      );
      if (!i)
        throw fail(
          409,
          "Insufficient or expired ingredients. Please choose another item.",
        );
      await InventoryTransaction.create(
        [
          {
            ingredient,
            delta: -quantity,
            reason: `Order ${number}`,
            actor: user._id,
            order: order._id,
            balance: i.stock,
          },
        ],
        { session },
      );
    }
    if (paid) await recordPayment(order, received, session);
    await AuditLog.create(
      [
        {
          actor: user._id,
          action: "order.created",
          entity: "Order",
          entityId: order.id,
        },
      ],
      { session },
    );
    if (input.source === "web")
      await Cart.updateOne(
        { user: user._id },
        { $set: { items: [] } },
        { session },
      );
    await notifyOrderStatus(order, session);
    result = order;
  });
  return result;
}
export async function recordPayment(order, received, session) {
  const [payment] = await Payment.create(
    [
      {
        order: order._id,
        method: order.paymentMethod,
        amount: order.total,
        received,
        change: round(received - order.total),
        isDemo: order.paymentMethod === "Demo GCash",
      },
    ],
    { session },
  );
  await Sale.create(
    [{ order: order._id, amount: order.total, discount: order.discount }],
    { session },
  );
  await Receipt.create(
    [{ order: order._id, payment: payment._id, number: order.number }],
    { session },
  );
}
export async function changeStatus(orderId, status, user) {
  let result;
  await mongoose.connection.transaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw fail(404, "Order not found.");
    const allowed = {
      Pending: ["Confirmed", "Cancelled"],
      Confirmed: ["Preparing", "Cancelled"],
      Preparing: ["Ready for Pickup"],
      "Ready for Pickup": ["Completed"],
      Completed: [],
      Cancelled: [],
    };
    if (!allowed[order.status].includes(status))
      throw fail(409, "This order status transition is not allowed.");
    if (status === "Completed" && order.paymentStatus !== "Paid")
      throw fail(400, "Collect payment before completing the order.");
    if (status === "Cancelled") {
      if (order.paymentStatus === "Paid" && order.paymentMethod === "Cash")
        throw fail(
          400,
          "Paid cash orders cannot be cancelled here. A supervised refund is required.",
        );
      for (const line of order.items)
        await Product.updateOne(
          { _id: line.product },
          { $inc: { stock: line.quantity } },
          { session },
        );
      for (const use of order.inventoryUsage) {
        const i = await Ingredient.findByIdAndUpdate(
          use.ingredient,
          { $inc: { stock: use.quantity } },
          { session, new: true },
        );
        await InventoryTransaction.create(
          [
            {
              ingredient: use.ingredient,
              delta: use.quantity,
              reason: `Cancelled ${order.number}`,
              actor: user._id,
              order: order._id,
              balance: i.stock,
            },
          ],
          { session },
        );
      }
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
      order.paymentStatus = "Voided";
    }
    order.status = status;
    await order.save({ session });
    await AuditLog.create(
      [
        {
          actor: user._id,
          action: `order.${status}`,
          entity: "Order",
          entityId: order.id,
        },
      ],
      { session },
    );
    await notifyOrderStatus(order, session);
    result = order;
  });
  return result;
}
