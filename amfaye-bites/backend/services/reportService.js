import { Sale, Order, Ingredient } from "../models/index.js";
import { z } from "zod";
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
