import { z } from "zod";
export const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier");
export const quantity = z.number().int().min(1).max(99);
export const item = z.object({
  product: id,
  quantity,
  customization: z
    .object({
      size: z.enum(["Small", "Medium", "Large"]).default("Small"),
      sugar: z.enum(["0%", "25%", "50%", "75%", "100%"]).default("100%"),
      ice: z
        .enum(["Less Ice", "Regular Ice", "Extra Ice"])
        .default("Regular Ice"),
      addons: z.array(id).max(5).default([]),
    })
    .default({}),
});
export const orderInput = z.object({
  items: z.array(item).min(1).max(50),
  source: z.enum(["web", "pos"]).default("web"),
  paymentMethod: z.enum(["Cash", "Demo GCash"]),
  amountReceived: z.number().min(0).max(1000000).optional(),
  otpSession: id.optional(),
  promoCode: z.string().max(30).optional(),
  notes: z.string().max(300).default(""),
  customerName: z.string().max(100).optional(),
  idempotencyKey: z.string().min(8).max(100),
});
export const productInput = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(1000).default(""),
  category: id,
  price: z.number().min(1).max(10000),
  image: z
    .string()
    .max(1000)
    .refine(
      (v) => !v || v.startsWith("/") || /^https:\/\//.test(v),
      "Use a local path or HTTPS image",
    ),
  stock: z.number().int().min(0).max(100000),
  minimumStock: z.number().min(0).default(5),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
  customizable: z.boolean().default(false),
  badge: z.string().max(30).default(""),
});
export const ingredientInput = z.object({
  name: z.string().trim().min(2).max(100),
  unit: z.string().min(1).max(20),
  stock: z.number().min(0).max(10000000).default(0),
  minimumStock: z.number().min(0).default(0),
  purchaseCost: z.number().min(0).default(0),
  supplier: z.string().max(100).default(""),
  expirationDate: z.string().datetime().nullable().optional(),
});
export const fail = (status, message) =>
  Object.assign(new Error(message), { status });
export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
