import mongoose from "mongoose";
import { z } from "zod";
import { Ingredient, InventoryTransaction, AuditLog } from "../models/index.js";
import { fail, id, ingredientInput } from "../utils/validators.js";
export async function list(req, res) {
  res.json(await Ingredient.find().sort({ name: 1 }));
}
export async function create(req, res) {
  const d = ingredientInput.parse(req.body);
  let i;
  await mongoose.connection.transaction(async (session) => {
    [i] = await Ingredient.create([d], { session });
    await InventoryTransaction.create(
      [
        {
          ingredient: i._id,
          delta: d.stock,
          reason: "Opening stock",
          actor: req.user._id,
          balance: d.stock,
        },
      ],
      { session },
    );
  });
  res.status(201).json(i);
}
export async function update(req, res) {
  const d = ingredientInput.omit({ stock: true }).parse(req.body);
  const i = await Ingredient.findByIdAndUpdate(
    id.parse(req.params.id),
    { $set: d },
    { new: true, runValidators: true },
  );
  if (!i) throw fail(404, "Ingredient not found.");
  res.json(i);
}
export async function adjust(req, res) {
  const _id = id.parse(req.params.id);
  const d = z
    .object({
      delta: z
        .number()
        .min(-1000000)
        .max(1000000)
        .refine((n) => n !== 0),
      reason: z.string().trim().min(3).max(200),
    })
    .parse(req.body);
  let ingredient;
  await mongoose.connection.transaction(async (session) => {
    ingredient = await Ingredient.findOneAndUpdate(
      { _id, ...(d.delta < 0 ? { stock: { $gte: -d.delta } } : {}) },
      { $inc: { stock: d.delta } },
      { new: true, session },
    );
    if (!ingredient)
      throw fail(
        409,
        "Ingredient not found or adjustment would make stock negative.",
      );
    await InventoryTransaction.create(
      [
        {
          ingredient: _id,
          delta: d.delta,
          reason: d.reason,
          actor: req.user._id,
          balance: ingredient.stock,
        },
      ],
      { session },
    );
    await AuditLog.create(
      [
        {
          actor: req.user._id,
          action: "inventory.adjusted",
          entityId: _id,
          details: d,
        },
      ],
      { session },
    );
  });
  res.json(ingredient);
}
export async function history(req, res) {
  res.json(
    await InventoryTransaction.find(
      req.query.ingredient
        ? { ingredient: id.parse(req.query.ingredient) }
        : {},
    )
      .populate("ingredient", "name unit")
      .populate("actor", "name")
      .sort({ createdAt: -1 })
      .limit(200),
  );
}
