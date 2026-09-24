import { Router } from "express";
import { z } from "zod";
import { Category, Product } from "../models/index.js";
import { auth } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/roleMiddleware.js";
import { wrap, fail, id } from "../utils/validators.js";
const r = Router();
const schema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().max(300).default(""),
});
r.get(
  "/",
  wrap(async (req, res) => res.json(await Category.find())),
);
r.post(
  "/",
  auth,
  admin,
  wrap(async (req, res) =>
    res.status(201).json(await Category.create(schema.parse(req.body))),
  ),
);
r.put(
  "/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    const c = await Category.findByIdAndUpdate(
      id.parse(req.params.id),
      { $set: schema.parse(req.body) },
      { new: true, runValidators: true },
    );
    if (!c) throw fail(404, "Category not found.");
    res.json(c);
  }),
);
r.delete(
  "/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    const _id = id.parse(req.params.id);
    if (await Product.exists({ category: _id }))
      throw fail(409, "Move products to another category first.");
    if (!(await Category.findByIdAndDelete(_id)))
      throw fail(404, "Category not found.");
    res.json({ message: "Category deleted." });
  }),
);
export default r;
