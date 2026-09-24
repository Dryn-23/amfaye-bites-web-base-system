import { Router } from "express";
import { z } from "zod";
import {
  Cart,
  ProductAddon,
  Promotion,
  CustomerProfile,
  User,
  Order,
  ProductRecipe,
  Ingredient,
  Product,
} from "../models/index.js";
import { auth } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/roleMiddleware.js";
import { wrap, fail, item, id } from "../utils/validators.js";
const r = Router();
r.get(
  "/addons",
  wrap(async (req, res) => res.json(await ProductAddon.find({ active: true }))),
);
r.get(
  "/promotions",
  wrap(async (req, res) =>
    res.json(
      await Promotion.find({
        active: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      }),
    ),
  ),
);
r.post(
  "/promotions",
  auth,
  admin,
  wrap(async (req, res) =>
    res.status(201).json(
      await Promotion.create(
        z
          .object({
            name: z.string().min(2).max(100),
            code: z
              .string()
              .min(2)
              .max(30)
              .transform((s) => s.toUpperCase()),
            description: z.string().max(300),
            percent: z.number().min(1).max(50),
            active: z.boolean().default(true),
            expiresAt: z.string().datetime().optional(),
          })
          .parse(req.body),
      ),
    ),
  ),
);
r.get(
  "/cart",
  auth,
  wrap(async (req, res) =>
    res.json((await Cart.findOne({ user: req.user._id })) || { items: [] }),
  ),
);
r.put(
  "/cart",
  auth,
  wrap(async (req, res) => {
    const d = z.object({ items: z.array(item).max(50) }).parse(req.body);
    res.json(
      await Cart.findOneAndUpdate(
        { user: req.user._id },
        { $set: d },
        { upsert: true, new: true, runValidators: true },
      ),
    );
  }),
);
r.get(
  "/customers",
  auth,
  admin,
  wrap(async (req, res) =>
    res.json(
      await User.find({ role: "customer" }).sort({ createdAt: -1 }).limit(500),
    ),
  ),
);
r.get(
  "/recipes/:id",
  auth,
  admin,
  wrap(async (req, res) =>
    res.json(
      (await ProductRecipe.findOne({ product: id.parse(req.params.id) })) || {
        ingredients: [],
      },
    ),
  ),
);
r.put(
  "/recipes/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    const product = id.parse(req.params.id);
    const d = z
      .object({
        ingredients: z
          .array(
            z.object({
              ingredient: id,
              quantity: z.number().positive().max(10000),
            }),
          )
          .max(30),
      })
      .parse(req.body);
    if (!(await Product.exists({ _id: product })))
      throw fail(404, "Product not found.");
    const ids = [...new Set(d.ingredients.map((x) => x.ingredient))];
    if (
      ids.length !== d.ingredients.length ||
      (await Ingredient.countDocuments({ _id: { $in: ids } })) !== ids.length
    )
      throw fail(400, "Use distinct, valid ingredients.");
    res.json(
      await ProductRecipe.findOneAndUpdate(
        { product },
        { $set: d },
        { upsert: true, new: true, runValidators: true },
      ),
    );
  }),
);
r.get("/settings", auth, admin, (req, res) =>
  res.json({
    businessName: "Amfaye Bites",
    tagline: "Freshly Baked. Freshly Blended.",
    currency: "PHP",
    timezone: "Asia/Manila",
    demoPaymentsEnabled: process.env.DEMO_PAYMENTS_ENABLED === "true",
    paymentNotice: "Demo Payment — No real money will be transferred.",
  }),
);
export default r;
