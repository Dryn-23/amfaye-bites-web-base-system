import "dotenv/config";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "../config/database.js";
import { hashPassword } from "../utils/password.js";
import * as M from "../models/index.js";
export async function seed() {
  for (const name of ["admin", "cashier", "customer"])
    await M.Role.updateOne(
      { name },
      { $setOnInsert: { name } },
      { upsert: true },
    );
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    if (
      process.env.SEED_ADMIN_PASSWORD.length < 12 ||
      process.env.SEED_ADMIN_PASSWORD.startsWith("replace_")
    )
      throw new Error("Use a unique seed password of at least 12 characters.");
    if (
      !(await M.User.exists({
        email: process.env.SEED_ADMIN_EMAIL.toLowerCase(),
      }))
    ) {
      const role = await M.Role.findOne({ name: "admin" });
      await M.User.create({
        name: "Amfaye Admin",
        email: process.env.SEED_ADMIN_EMAIL.toLowerCase(),
        username: "admin",
        phone: "09123456789",
        role: "admin",
        roleRef: role._id,
        passwordHash: await hashPassword(process.env.SEED_ADMIN_PASSWORD),
      });
    }
  }
  const cats = {};
  for (const name of ["Pastries", "Fruit Shakes", "Add-ons", "Promotions"])
    cats[name] = await M.Category.findOneAndUpdate(
      { name },
      {
        $setOnInsert: {
          name,
          description:
            name === "Pastries"
              ? "Small-batch goodness, baked fresh every day."
              : "Fresh ingredients. Feel-good favorites.",
        },
      },
      { upsert: true, new: true },
    );
  const ingredients = {};
  for (const [name, unit, stock, min] of [
    ["Flour", "kg", 40, 5],
    ["Sugar", "kg", 25, 5],
    ["Butter", "kg", 20, 3],
    ["Milk", "L", 40, 5],
    ["Mango", "kg", 30, 5],
    ["Strawberry", "kg", 20, 5],
    ["Banana", "kg", 25, 5],
    ["Avocado", "kg", 20, 5],
    ["Tapioca", "kg", 15, 3],
    ["Ice", "kg", 100, 10],
    ["Chocolate", "kg", 15, 3],
    ["Whipped Cream", "L", 15, 3],
    ["Cups", "pc", 500, 50],
    ["Straws", "pc", 500, 50],
    ["Packaging", "pc", 500, 50],
  ])
    ingredients[name] = await M.Ingredient.findOneAndUpdate(
      { name },
      {
        $setOnInsert: {
          name,
          unit,
          stock,
          minimumStock: min,
          purchaseCost: unit === "pc" ? 2 : 120,
          supplier: "Local supplier",
        },
      },
      { upsert: true, new: true },
    );
  for (const [name, price, ing, quantity] of [
    ["Whipped Cream", 15, "Whipped Cream", 0.03],
    ["Extra Fruit", 20, "Mango", 0.05],
    ["Chocolate", 15, "Chocolate", 0.02],
    ["Tapioca", 15, "Tapioca", 0.03],
    ["Extra Topping", 10, "Chocolate", 0.01],
  ])
    await M.ProductAddon.updateOne(
      { name },
      {
        $setOnInsert: {
          name,
          price,
          ingredient: ing ? ingredients[ing]._id : undefined,
          quantity,
        },
      },
      { upsert: true },
    );
  const custom = await M.ProductCustomization.findOneAndUpdate(
    { name: "Shake size" },
    {
      $setOnInsert: {
        name: "Shake size",
        choices: [
          { label: "Small", price: 0 },
          { label: "Medium", price: 20 },
          { label: "Large", price: 40 },
        ],
      },
    },
    { upsert: true, new: true },
  );
  const list = [
    [
      "Chocolate Croissant",
      85,
      "Pastries",
      "Buttery, flaky layers with a rich chocolate center.",
      "croissant",
      "Bestseller",
    ],
    [
      "Blueberry Muffin",
      65,
      "Pastries",
      "Soft, golden and bursting with juicy blueberries.",
      "muffin",
      "Freshly baked",
    ],
    [
      "Chocolate Chip Cookies",
      45,
      "Pastries",
      "Golden edges, a soft center and generous chocolate chips.",
      "cookies",
      "",
    ],
    [
      "Cinnamon Roll",
      75,
      "Pastries",
      "A warm cinnamon swirl with a silky cream glaze.",
      "cinnamon",
      "Bestseller",
    ],
    [
      "Cheese Danish",
      70,
      "Pastries",
      "Delicate pastry filled with sweet cream cheese.",
      "danish",
      "",
    ],
    [
      "Brownies",
      55,
      "Pastries",
      "Rich, fudgy chocolate in every little square.",
      "brownie",
      "",
    ],
    [
      "Banana Bread",
      60,
      "Pastries",
      "Comforting banana loaf, baked in small batches.",
      "banana-bread",
      "",
    ],
    [
      "Strawberry Shortcake",
      95,
      "Pastries",
      "Light sponge, fresh cream and sweet strawberries.",
      "cake",
      "",
    ],
    [
      "Mango Shake",
      99,
      "Fruit Shakes",
      "Sun-ripened mangoes blended into pure sunshine.",
      "mango",
      "Bestseller",
    ],
    [
      "Strawberry Shake",
      109,
      "Fruit Shakes",
      "Sweet strawberries meet a smooth, creamy blend.",
      "strawberry",
      "Popular",
    ],
    [
      "Banana Shake",
      89,
      "Fruit Shakes",
      "Naturally sweet, beautifully creamy banana goodness.",
      "banana",
      "",
    ],
    [
      "Avocado Shake",
      119,
      "Fruit Shakes",
      "Rich, velvety avocado blended fresh just for you.",
      "avocado",
      "",
    ],
    [
      "Mixed Berry Shake",
      119,
      "Fruit Shakes",
      "A refreshing medley of bright, juicy berries.",
      "berry",
      "",
    ],
    [
      "Mango Strawberry Shake",
      129,
      "Fruit Shakes",
      "Two fruity favorites in one happy cup.",
      "mango-strawberry",
      "New",
    ],
    [
      "Chocolate Banana Shake",
      109,
      "Fruit Shakes",
      "Chocolatey comfort with a fresh banana twist.",
      "chocolate-banana",
      "",
    ],
  ];
  for (const [name, price, category, description, image, badge] of list) {
    const shake = category === "Fruit Shakes";
    const p = await M.Product.findOneAndUpdate(
      { name },
      {
        $setOnInsert: {
          name,
          price,
          category: cats[category]._id,
          description,
          image: `/products/${image}.jpg`,
          stock: 40,
          minimumStock: 5,
          available: true,
          featured: !!badge,
          badge,
          customizable: shake,
          customizations: shake ? [custom._id] : [],
        },
      },
      { upsert: true, new: true },
    );
    const fruit = name.includes("Avocado")
      ? "Avocado"
      : name.includes("Banana")
        ? "Banana"
        : name.includes("Strawberry") || name.includes("Berry")
          ? "Strawberry"
          : "Mango";
    const recipe = shake
      ? [
          [fruit, 0.15],
          ["Milk", 0.15],
          ["Ice", 0.1],
          ["Cups", 1],
          ["Straws", 1],
        ]
      : [
          ["Flour", 0.08],
          ["Butter", 0.03],
          ["Sugar", 0.02],
          ["Packaging", 1],
        ];
    await M.ProductRecipe.updateOne(
      { product: p._id },
      {
        $setOnInsert: {
          product: p._id,
          ingredients: recipe.map(([n, q]) => ({
            ingredient: ingredients[n]._id,
            quantity: q,
          })),
        },
      },
      { upsert: true },
    );
  }
  await M.Promotion.updateOne(
    { code: "SWEET10" },
    {
      $setOnInsert: {
        name: "A little treat, on us.",
        code: "SWEET10",
        description:
          "Enjoy 10% off your next order. Good moments taste better together.",
        percent: 10,
        active: true,
      },
    },
    { upsert: true },
  );
  for (const model of Object.values(M)) await model.init();
  console.log("Seed complete. Existing data was preserved.");
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await connectDatabase();
    await seed();
  } finally {
    await mongoose.disconnect();
  }
}
