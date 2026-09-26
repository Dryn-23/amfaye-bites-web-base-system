import mongoose from "mongoose";
const { Schema } = mongoose;
const ref = (name, required = false) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
});
const str = { type: String, trim: true };
const money = { type: Number, min: 0, required: true };
const nonnegative = { type: Number, min: 0, default: 0 };
const model = (name, shape, indexes = []) => {
  const s = new Schema(shape, { timestamps: true });
  for (const [fields, opts] of indexes) s.index(fields, opts);
  return mongoose.model(name, s);
};
export const Role = model("Role", {
  name: {
    type: String,
    enum: ["admin", "cashier", "customer"],
    unique: true,
    required: true,
  },
});
export const User = model("User", {
  name: { ...str, required: true },
  email: { ...str, lowercase: true, unique: true, required: true },
  phone: str,
  username: { ...str, lowercase: true, unique: true, required: true },
  passwordHash: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ["admin", "cashier", "customer"],
    default: "customer",
  },
  roleRef: ref("Role"),
  active: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0, select: false },
});
export const CustomerProfile = model("CustomerProfile", {
  user: { ...ref("User", true), unique: true },
  notes: str,
});
export const Category = model("Category", {
  name: { ...str, required: true, unique: true },
  description: str,
});
export const ProductCustomization = model("ProductCustomization", {
  name: str,
  choices: [{ label: String, price: money }],
});
export const ProductAddon = model("ProductAddon", {
  name: { ...str, unique: true, required: true },
  price: money,
  ingredient: ref("Ingredient"),
  quantity: { type: Number, min: 0, default: 1 },
  active: { type: Boolean, default: true },
});
export const Product = model(
  "Product",
  {
    name: { ...str, required: true },
    description: str,
    category: ref("Category", true),
    price: money,
    image: str,
    stock: { type: Number, min: 0, default: 0, validate: Number.isInteger },
    minimumStock: { type: Number, min: 0, default: 5 },
    available: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    badge: str,
    customizable: { type: Boolean, default: false },
    customizations: [ref("ProductCustomization")],
  },
  [[{ name: "text", description: "text" }, {}]],
);
const selection = {
  size: { type: String, enum: ["Small", "Medium", "Large"], default: "Small" },
  sugar: {
    type: String,
    enum: ["0%", "25%", "50%", "75%", "100%"],
    default: "100%",
  },
  ice: {
    type: String,
    enum: ["Less Ice", "Regular Ice", "Extra Ice"],
    default: "Regular Ice",
  },
  addons: [ref("ProductAddon")],
};
const cartItem = {
  product: ref("Product", true),
  quantity: { type: Number, min: 1, max: 99, required: true },
  customization: selection,
};
export const Cart = model("Cart", {
  user: { ...ref("User", true), unique: true },
  items: [cartItem],
});
export const Ingredient = model("Ingredient", {
  name: { ...str, required: true, unique: true },
  unit: { ...str, required: true },
  stock: nonnegative,
  minimumStock: nonnegative,
  purchaseCost: nonnegative,
  supplier: str,
  expirationDate: Date,
});
export const ProductRecipe = model("ProductRecipe", {
  product: { ...ref("Product", true), unique: true },
  ingredients: [
    {
      ingredient: ref("Ingredient", true),
      quantity: { type: Number, min: 0.001, required: true },
    },
  ],
});
export const InventoryTransaction = model(
  "InventoryTransaction",
  {
    ingredient: ref("Ingredient", true),
    delta: { type: Number, required: true },
    reason: { ...str, required: true },
    actor: ref("User"),
    order: ref("Order"),
    balance: nonnegative,
  },
  [[{ ingredient: 1, createdAt: -1 }, {}]],
);
const orderItem = new Schema(
  {
    product: ref("Product", true),
    name: String,
    image: String,
    quantity: { type: Number, min: 1, required: true },
    unitPrice: money,
    subtotal: money,
    customization: {
      size: String,
      sugar: String,
      ice: String,
      addons: [{ name: String, price: Number }],
    },
  },
  { _id: false },
);
export const Order = model(
  "Order",
  {
    number: { type: String, unique: true, required: true },
    user: ref("User", true),
    cashier: ref("User"),
    source: { type: String, enum: ["web", "pos"], default: "web" },
    customerName: str,
    items: [orderItem],
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Preparing",
        "Ready for Pickup",
        "Completed",
        "Cancelled",
      ],
      default: "Pending",
    },
    subtotal: money,
    discount: nonnegative,
    total: money,
    paymentMethod: {
      type: String,
      enum: ["Cash", "Demo GCash"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Voided"],
      default: "Pending",
    },
    notes: str,
    inventoryUsage: [{ ingredient: ref("Ingredient"), quantity: Number }],
    idempotencyKey: { type: String, required: true },
  },
  [
    [{ user: 1, idempotencyKey: 1 }, { unique: true }],
    [{ user: 1, createdAt: -1 }, {}],
    [{ status: 1, createdAt: -1 }, {}],
  ],
);
export const Payment = model("Payment", {
  order: { ...ref("Order", true), unique: true },
  method: { type: String, enum: ["Cash", "Demo GCash"], required: true },
  amount: money,
  received: money,
  change: nonnegative,
  status: { type: String, enum: ["Paid", "Voided"], default: "Paid" },
  isDemo: { type: Boolean, default: false },
});
export const DemoOTPSession = model(
  "DemoOTPSession",
  {
    user: ref("User", true),
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    used: { type: Boolean, default: false },
  },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const Promotion = model("Promotion", {
  name: { ...str, required: true },
  code: { ...str, uppercase: true, unique: true, required: true },
  description: str,
  percent: { type: Number, min: 0, max: 50, required: true },
  active: { type: Boolean, default: true },
  expiresAt: Date,
});
export const Sale = model(
  "Sale",
  {
    order: { ...ref("Order", true), unique: true },
    amount: money,
    discount: nonnegative,
    voided: { type: Boolean, default: false },
  },
  [[{ createdAt: -1 }, {}]],
);
export const Receipt = model("Receipt", {
  order: { ...ref("Order", true), unique: true },
  payment: ref("Payment", true),
  number: { type: String, unique: true, required: true },
});
export const AuditLog = model(
  "AuditLog",
  {
    actor: ref("User"),
    action: { type: String, required: true },
    entity: String,
    entityId: String,
    details: Schema.Types.Mixed,
  },
  [[{ createdAt: -1 }, {}]],
);

export { default as Notification } from "./Notification.js";
