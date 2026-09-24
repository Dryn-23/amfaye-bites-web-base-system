import {
  Product,
  ProductRecipe,
  Ingredient,
  AuditLog,
  Category,
} from "../models/index.js";
import { fail, id, productInput } from "../utils/validators.js";
export async function list(req, res) {
  const products = await Product.find()
    .populate("category")
    .sort({ createdAt: 1 })
    .lean();
  const recipes = await ProductRecipe.find()
    .populate("ingredients.ingredient")
    .lean();
  const byProduct = new Map(recipes.map((r) => [String(r.product), r]));
  res.json(
    products.map((p) => {
      const recipe = byProduct.get(String(p._id));
      const ingredientAvailable = (recipe?.ingredients || []).every(
        (r) =>
          r.ingredient &&
          r.ingredient.stock >= r.quantity &&
          (!r.ingredient.expirationDate ||
            r.ingredient.expirationDate > new Date()),
      );
      return {
        ...p,
        available: p.available && p.stock > 0 && ingredientAvailable,
        enabled: p.available,
        lowStock: p.stock <= p.minimumStock,
      };
    }),
  );
}
export async function detail(req, res) {
  const p = await Product.findById(id.parse(req.params.id))
    .populate("category")
    .lean();
  if (!p) throw fail(404, "Product not found.");
  const recipe = await ProductRecipe.findOne({ product: p._id })
    .populate("ingredients.ingredient")
    .lean();
  const ingredientAvailable = (recipe?.ingredients || []).every(
    (r) =>
      r.ingredient &&
      r.ingredient.stock >= r.quantity &&
      (!r.ingredient.expirationDate ||
        r.ingredient.expirationDate > new Date()),
  );
  res.json({
    ...p,
    available: p.available && p.stock > 0 && ingredientAvailable,
    enabled: p.available,
    lowStock: p.stock <= p.minimumStock,
  });
}
export async function create(req, res) {
  const d = productInput.parse(req.body);
  if (!(await Category.exists({ _id: d.category })))
    throw fail(400, "Choose an existing category.");
  const p = await Product.create(d);
  await AuditLog.create({
    actor: req.user._id,
    action: "product.created",
    entityId: p.id,
  });
  res.status(201).json(p);
}
export async function update(req, res) {
  const d = productInput.parse(req.body);
  if (!(await Category.exists({ _id: d.category })))
    throw fail(400, "Choose an existing category.");
  const p = await Product.findByIdAndUpdate(
    id.parse(req.params.id),
    { $set: d },
    { new: true, runValidators: true },
  );
  if (!p) throw fail(404, "Product not found.");
  await AuditLog.create({
    actor: req.user._id,
    action: "product.updated",
    entityId: p.id,
  });
  res.json(p);
}
export async function remove(req, res) {
  const p = await Product.findByIdAndUpdate(
    id.parse(req.params.id),
    { $set: { available: false } },
    { new: true },
  );
  if (!p) throw fail(404, "Product not found.");
  await AuditLog.create({
    actor: req.user._id,
    action: "product.archived",
    entityId: p.id,
  });
  res.json({
    message: "Product archived. Existing order records are preserved.",
  });
}
