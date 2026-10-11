import { Router } from "express";
import { auth } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/roleMiddleware.js";
import { wrap } from "../utils/validators.js";
import { Category, Product } from "../models/index.js";

const categories = [
  { name: "Pastries", description: "Freshly baked daily" },
  { name: "Cakes", description: "Cakes for every occasion" },
  { name: "Cookies", description: "Crisp and chewy treats" },
  { name: "Shakes", description: "Creamy blended beverages" },
  { name: "Coffee", description: "Hot and iced coffee" },
  { name: "Tea", description: "Hot and iced tea" },
  { name: "Sandwiches", description: "Savory bites" },
  { name: "Frappe", description: "Blended iced drinks" },
];

const products = [
  { name: "Butter Croissant", category: "Pastries", price: 89, stock: 40, badge: "Bestseller" },
  { name: "Chocolate Croissant", category: "Pastries", price: 105, stock: 35 },
  { name: "Almond Danish", category: "Pastries", price: 120, stock: 30 },
  { name: "Cinnamon Roll", category: "Pastries", price: 95, stock: 28, badge: "Sweet" },
  { name: "Blueberry Muffin", category: "Pastries", price: 85, stock: 32 },
  { name: "Banana Walnut Muffin", category: "Pastries", price: 90, stock: 25 },
  { name: "Cheese Danish", category: "Pastries", price: 115, stock: 20 },
  { name: "Apple Turnover", category: "Pastries", price: 98, stock: 22 },
  { name: "Classic Chocolate Cake Slice", category: "Cakes", price: 160, stock: 18, badge: "Rich" },
  { name: "Strawberry Shortcake Slice", category: "Cakes", price: 155, stock: 15 },
  { name: "Red Velvet Cake Slice", category: "Cakes", price: 165, stock: 14 },
  { name: "Cheesecake Slice", category: "Cakes", price: 150, stock: 20 },
  { name: "Mango Cream Cake Slice", category: "Cakes", price: 145, stock: 12 },
  { name: "Ube Cake Slice", category: "Cakes", price: 150, stock: 16, badge: "Local" },
  { name: "Chocolate Chip Cookie", category: "Cookies", price: 65, stock: 60 },
  { name: "Oatmeal Raisin Cookie", category: "Cookies", price: 60, stock: 45 },
  { name: "Double Chocolate Cookie", category: "Cookies", price: 70, stock: 50 },
  { name: "Sugar Cookie", category: "Cookies", price: 55, stock: 55 },
  { name: "Macadamia Cookie", category: "Cookies", price: 80, stock: 40 },
  { name: "Mango Strawberry Shake", category: "Shakes", price: 169, stock: 100, customizable: true },
  { name: "Strawberry Shake", category: "Shakes", price: 149, stock: 100, customizable: true },
  { name: "Chocolate Milkshake", category: "Shakes", price: 159, stock: 100, customizable: true },
  { name: "Vanilla Milkshake", category: "Shakes", price: 145, stock: 100, customizable: true },
  { name: "Cookies & Cream Shake", category: "Shakes", price: 175, stock: 100, customizable: true },
  { name: "Mango Graham Shake", category: "Shakes", price: 155, stock: 100, customizable: true },
  { name: "Espresso", category: "Coffee", price: 95, stock: 100 },
  { name: "Americano", category: "Coffee", price: 110, stock: 100, customizable: true },
  { name: "Café Latte", category: "Coffee", price: 140, stock: 100, customizable: true },
  { name: "Cappuccino", category: "Coffee", price: 145, stock: 100, customizable: true },
  { name: "Caramel Macchiato", category: "Coffee", price: 165, stock: 100, customizable: true },
  { name: "Mocha", category: "Coffee", price: 160, stock: 100, customizable: true },
  { name: "Iced Americano", category: "Coffee", price: 120, stock: 100, customizable: true },
  { name: "Iced Latte", category: "Coffee", price: 150, stock: 100, customizable: true },
  { name: "Earl Grey Tea", category: "Tea", price: 100, stock: 80 },
  { name: "Green Tea", category: "Tea", price: 95, stock: 80 },
  { name: "Jasmine Tea", category: "Tea", price: 100, stock: 80 },
  { name: "Lemon Iced Tea", category: "Tea", price: 115, stock: 80, customizable: true },
  { name: "Peach Iced Tea", category: "Tea", price: 125, stock: 80, customizable: true },
  { name: "Java Chip Frappe", category: "Frappe", price: 185, stock: 100, customizable: true },
  { name: "Caramel Frappe", category: "Frappe", price: 180, stock: 100, customizable: true },
  { name: "Mocha Frappe", category: "Frappe", price: 180, stock: 100, customizable: true },
  { name: "Matcha Frappe", category: "Frappe", price: 190, stock: 100, customizable: true, badge: "New" },
  { name: "Ham & Cheese Sandwich", category: "Sandwiches", price: 140, stock: 25 },
  { name: "Tuna Melt Sandwich", category: "Sandwiches", price: 155, stock: 20 },
  { name: "Egg Salad Sandwich", category: "Sandwiches", price: 135, stock: 22 },
  { name: "Grilled Chicken Sandwich", category: "Sandwiches", price: 175, stock: 18, badge: "Meal" },
  { name: "Veggie Sandwich", category: "Sandwiches", price: 130, stock: 15 },
];

const r = Router();
r.use(auth, admin);
r.post(
  "/",
  wrap(async (req, res) => {
    const catMap = new Map();
    for (const c of categories) {
      let doc = await Category.findOne({ name: c.name });
      if (!doc) {
        doc = await Category.create({
          name: c.name,
          description: c.description,
        });
      }
      catMap.set(c.name, doc._id);
    }

    function imageUrl(p) {
      const prompt = `appetizing food photography of ${p.name}, ${p.category}, professional studio lighting, clean background`;
      return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=400&nologo=true&seed=${encodeURIComponent(p.name)}`;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const p of products) {
      const existing = await Product.findOne({ name: p.name });
      if (existing) {
        if (!existing.image) {
          existing.image = imageUrl(p);
          await existing.save();
          updated++;
        } else {
          skipped++;
        }
        continue;
      }
      await Product.create({
        ...p,
        category: catMap.get(p.category),
        available: true,
        featured: false,
        minimumStock: 5,
        image: imageUrl(p),
      });
      created++;
    }
    res.json({ created, updated, skipped });
  }),
);

export default r;
