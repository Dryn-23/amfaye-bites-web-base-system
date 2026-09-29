import {
  Product,
  ProductRecipe,
  Ingredient,
  AuditLog,
  Category,
} from "../models/index.js";
import { fail, id, productInput } from "../utils/validators.js";

// How long the public product list is cached in memory (milliseconds).
// Keep it short because stock and availability change when orders come in.
// Set to 0 to disable the cache completely.
const LIST_CACHE_MS = 5000;
let listCache = { data: null, expires: 0 };

// Call this after anything that changes products, stock, or ingredients.
export function clearProductsCache() {
  listCache = { data: null, expires: 0 };
}

function ingredientsAvailable(recipe, now) {
  return (recipe?.ingredients || []).every(
    (r) =>
      r.ingredient &&
      r.ingredient.stock >= r.quantity &&
      (!r.ingredient.expirationDate || r.ingredient.expirationDate > now),
  );
}

function shape(p, recipe, now) {
  return {
    ...p,
    available: p.available && p.stock > 0 && ingredientsAvailable(recipe, now),
    enabled: p.available,
    lowStock: p.stock <= p.minimumStock,
  };
}

export async function list(req, res) {
  if (LIST_CACHE_MS > 0 && listCache.data && Date.now() < listCache.expires) {
    return res.json(listCache.data);
  }

  // One parallel batch (one round trip of waiting) instead of four
  // sequential ones. The joins that populate() did are done in memory.
  const [products, categories, recipes, ingredients] = await Promise.all([
    Product.find().sort({ createdAt: 1 }).lean(),
    Category.find().lean(),
    ProductRecipe.find().lean(),
    Ingredient.find().select("stock expirationDate").lean(),
  ]);

  const categoryById = new Map(categories.map((c) => [String(c._id), c]));
  const ingredientById = new Map(ingredients.map((i) => [String(i._id), i]));
  const recipeByProduct = new Map(recipes.map((r) => [String(r.product), r]));
  const now = new Date();

  const data = products.map((p) => {
    const recipe = recipeByProduct.get(String(p._id));
    const hydratedRecipe = recipe && {
      ...recipe,
      ingredients: (recipe.ingredients || []).map((r) => ({
        ...r,
        ingredient: ingredientById.get(String(r.ingredient)) || null,
      })),
    };
    return shape(
      { ...p, category: categoryById.get(String(p.category)) || null },
      hydratedRecipe,
      now,
    );
  });

  if (LIST_CACHE_MS > 0) {
    listCache = { data, expires: Date.now() + LIST_CACHE_MS };
  }
  res.json(data);
}

export async function detail(req, res) {
  const pid = id.parse(req.params.id);
  // Product and recipe don't depend on each other, so fetch them together.
  const [p, recipe] = await Promise.all([
    Product.findById(pid).populate("category").lean(),
    ProductRecipe.findOne({ product: pid })
      .populate("ingredients.ingredient", "stock expirationDate")
      .lean(),
  ]);
  if (!p) throw fail(404, "Product not found.");
  res.json(shape(p, recipe, new Date()));
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
  clearProductsCache();
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
  clearProductsCache();
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
  clearProductsCache();
  res.json({
    message: "Product archived. Existing order records are preserved.",
  });
}

export async function stockAlerts(req, res) {
  res.set("Cache-Control", "no-store");
  // Manual disabled/archived products are excluded. Recipe shortages are separate
  // from the product's sellable-serving level shown here.
  const items = await Product.find({
    available: true,
    $expr: { $lte: ["$stock", "$minimumStock"] },
  })
    .select("name stock minimumStock category image price")
    .populate("category", "name")
    .sort({ stock: 1, name: 1 })
    .lean();
  res.json({
    lowStockCount: items.filter((p) => p.stock > 0).length,
    outOfStockCount: items.filter((p) => p.stock <= 0).length,
    totalAlerts: items.length,
    items: items.map((p) => ({
      ...p,
      stockStatus: p.stock <= 0 ? "Out of stock" : "Low stock",
    })),
  });
}