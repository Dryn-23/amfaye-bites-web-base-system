import { Sale, Order, Ingredient, Payment, User } from "../models/index.js";
import { z } from "zod";
import { Types } from "mongoose";
import { id } from "../utils/validators.js";
import { round } from "./orderService.js";
export function dates(query) {
  const schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const filter = {};
  if (query.from) {
    filter.$gte = new Date(schema.parse(query.from) + "T00:00:00+08:00");
  }
  if (query.to) {
    const end = new Date(schema.parse(query.to) + "T00:00:00+08:00");
    end.setUTCDate(end.getUTCDate() + 1);
    filter.$lt = end;
  }
  return Object.keys(filter).length ? { createdAt: filter } : {};
}
export async function sales(query) {
  const filter = { voided: false, ...dates(query) };
  const entries = await Sale.find(filter)
    .populate("order", "number paymentMethod customerName")
    .sort({ createdAt: -1 })
    .limit(500);
  const [summary] = await Sale.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$amount" },
        discount: { $sum: "$discount" },
        vat: { $sum: "$vat" },
        count: { $sum: 1 },
      },
    },
  ]);
  const daily = await Sale.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "Asia/Manila",
          },
        },
        total: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return {
    entries,
    summary: summary || { revenue: 0, discount: 0, vat: 0, count: 0 },
    daily,
  };
}
export async function products(query) {
  return Order.aggregate([
    {
      $match: {
        paymentStatus: "Paid",
        status: { $ne: "Cancelled" },
        ...dates(query),
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.name" },
        quantity: { $sum: "$items.quantity" },
        grossRevenue: { $sum: "$items.subtotal" },
      },
    },
    { $sort: { quantity: -1 } },
  ]);
}
export async function inventory() {
  return Ingredient.find({ $expr: { $lte: ["$stock", "$minimumStock"] } });
}
export async function categoryPerformance(query) {
  return Order.aggregate([
    {
      $match: {
        paymentStatus: "Paid",
        status: { $ne: "Cancelled" },
        ...dates(query),
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.category",
        category: { $first: "$items.category" },
        quantity: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.subtotal" },
      },
    },
    { $sort: { revenue: -1 } },
  ]);
}
export async function peakHours(query) {
  return Order.aggregate([
    {
      $match: {
        paymentStatus: "Paid",
        status: { $ne: "Cancelled" },
        ...dates(query),
      },
    },
    {
      $group: {
        _id: {
          $hour: { date: "$createdAt", timezone: "Asia/Manila" },
        },
        count: { $sum: 1 },
        revenue: { $sum: "$total" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}
export async function paymentMethods(query) {
  return Order.aggregate([
    {
      $match: {
        paymentStatus: "Paid",
        status: { $ne: "Cancelled" },
        ...dates(query),
      },
    },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        revenue: { $sum: "$total" },
      },
    },
    { $sort: { revenue: -1 } },
  ]);
}
export async function monthlyComparison() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  return Sale.aggregate([
    {
      $match: {
        voided: false,
        createdAt: { $gte: startOfYear },
      },
    },
    {
      $group: {
        _id: {
          $month: { date: "$createdAt", timezone: "Asia/Manila" },
        },
        revenue: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}
// Cash drawer / shift summary. Groups settled cash payments by cashier so the
// drawer can be counted against what the system expects to be in it.
export async function cashDrawer(query) {
  const { user } = query;
  const cashier = user ? id.parse(user) : undefined;
  const rows = await Payment.aggregate([
    {
      $match: {
        method: "Cash",
        status: "Paid",
        ...dates(query),
      },
    },
    { $lookup: { from: "orders", localField: "order", foreignField: "_id", as: "o" } },
    { $unwind: "$o" },
    ...(cashier ? [{ $match: { "o.cashier": new Types.ObjectId(cashier) } }] : []),
    {
      $group: {
        _id: "$o.cashier",
        orders: { $sum: 1 },
        sales: { $sum: "$amount" },
        received: { $sum: "$received" },
        change: { $sum: "$change" },
      },
    },
    { $sort: { received: -1 } },
  ]);

  const names = await User.find({ _id: { $in: rows.map((r) => r._id).filter(Boolean) } })
    .select("name role")
    .lean();
  const byId = new Map(names.map((u) => [String(u._id), u.name]));

  const shaped = rows.map((r) => ({
    cashier: r._id || null,
    name: r._id ? byId.get(String(r._id)) || "Unknown" : "Web orders",
    orders: r.orders,
    sales: round(r.sales),
    received: round(r.received),
    change: round(r.change),
    // Cash that should be in the drawer: every peso handed over, less the
    // change already given back out.
    expected: round(r.received - r.change),
  }));

  return {
    rows: shaped,
    totals: shaped.reduce(
      (acc, r) => ({
        orders: acc.orders + r.orders,
        sales: round(acc.sales + r.sales),
        received: round(acc.received + r.received),
        change: round(acc.change + r.change),
        expected: round(acc.expected + r.expected),
      }),
      { orders: 0, sales: 0, received: 0, change: 0, expected: 0 },
    ),
  };
}
