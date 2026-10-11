import "dotenv/config";
import mongoose from "mongoose";
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
  // Pastries
  { name: "Butter Croissant", category: "Pastries", price: 89, stock: 40, badge: "Bestseller" },
  { name: "Chocolate Croissant", category: "Pastries", price: 105, stock: 35 },
  { name: "Almond Danish", category: "Pastries", price: 120, stock: 30 },
  { name: "Cinnamon Roll", category: "Pastries", price: 95, stock: 28, badge: "Sweet" },
  { name: "Blueberry Muffin", category: "Pastries", price: 85, stock: 32 },
  { name: "Banana Walnut Muffin", category: "Pastries", price: 90, stock: 25 },
  { name: "Cheese Danish", category: "Pastries", price: 115, stock: 20 },
  { name: "Apple Turnover", category: "Pastries", price: 98, stock: 22 },

  // Cakes
  { name: "Classic Chocolate Cake Slice", category: "Cakes", price: 160, stock: 18, badge: "Rich" },
  { name: "Strawberry Shortcake Slice", category: "Cakes", price: 155, stock: 15 },
  { name: "Red Velvet Cake Slice", category: "Cakes", price: 165, stock: 14 },
  { name: "Cheesecake Slice", category: "Cakes", price: 150, stock: 20 },
  { name: "Mango Cream Cake Slice", category: "Cakes", price: 145, stock: 12 },
  { name: "Ube Cake Slice", category: "Cakes", price: 150, stock: 16, badge: "Local" },

  // Cookies
  { name: "Chocolate Chip Cookie", category: "Cookies", price: 65, stock: 60 },
  { name: "Oatmeal Raisin Cookie", category: "Cookies", price: 60, stock: 45 },
  { name: "Double Chocolate Cookie", category: "Cookies", price: 70, stock: 50 },
  { name: "Sugar Cookie", category: "Cookies", price: 55, stock: 55 },
  { name: "Macadamia Cookie", category: "Cookies", price: 80, stock: 40 },

  // Shakes
  { name: "Mango Strawberry Shake", category: "Shakes", price: 169, stock: 100, customizable: true },
  { name: "Strawberry Shake", category: "Shakes", price: 149, stock: 100, customizable: true },
  { name: "Chocolate Milkshake", category: "Shakes", price: 159, stock: 100, customizable: true },
  { name: "Vanilla Milkshake", category: "Shakes", price: 145, stock: 100, customizable: true },
  { name: "Cookies & Cream Shake", category: "Shakes", price: 175, stock: 100, customizable: true },
  { name: "Mango Graham Shake", category: "Shakes", price: 155, stock: 100, customizable: true },

  // Coffee
  { name: "Espresso", category: "Coffee", price: 95, stock: 100 },
  { name: "Americano", category: "Coffee", price: 110, stock: 100, customizable: true },
  { name: "Café Latte", category: "Coffee", price: 140, stock: 100, customizable: true },
  { name: "Cappuccino", category: "Coffee", price: 145, stock: 100, customizable: true },
  { name: "Caramel Macchiato", category: "Coffee", price: 165, stock: 100, customizable: true },
  { name: "Mocha", category: "Coffee", price: 160, stock: 100, customizable: true },
  { name: "Iced Americano", category: "Coffee", price: 120, stock: 100, customizable: true },
  { name: "Iced Latte", category: "Coffee", price: 150, stock: 100, customizable: true },

  // Tea
  { name: "Earl Grey Tea", category: "Tea", price: 100, stock: 80 },
  { name: "Green Tea", category: "Tea", price: 95, stock: 80 },
  { name: "Jasmine Tea", category: "Tea", price: 100, stock: 80 },
  { name: "Lemon Iced Tea", category: "Tea", price: 115, stock: 80, customizable: true },
  { name: "Peach Iced Tea", category: "Tea", price: 125, stock: 80, customizable: true },

  // Frappe
  { name: "Java Chip Frappe", category: "Frappe", price: 185, stock: 100, customizable: true },
  { name: "Caramel Frappe", category: "Frappe", price: 180, stock: 100, customizable: true },
  { name: "Mocha Frappe", category: "Frappe", price: 180, stock: 100, customizable: true },
  { name: "Matcha Frappe", category: "Frappe", price: 190, stock: 100, customizable: true, badge: "New" },

  // Sandwiches
  { name: "Ham & Cheese Sandwich", category: "Sandwiches", price: 140, stock: 25 },
  { name: "Tuna Melt Sandwich", category: "Sandwiches", price: 155, stock: 20 },
  { name: "Egg Salad Sandwich", category: "Sandwiches", price: 135, stock: 22 },
  { name: "Grilled Chicken Sandwich", category: "Sandwiches", price: 175, stock: 18, badge: "Meal" },
  { name: "Veggie Sandwich", category: "Sandwiches", price: 130, stock: 15 },
];

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");

  const catMap = new Map();
  for (const c of categories) {
    let doc = await Category.findOne({ name: c.name }).lean();
    if (!doc) {
      doc = await Category.create({ name: c.name, description: c.description });
      console.log("Created category:", c.name);
    } else {
      console.log("Found category:", c.name);
    }
    catMap.set(c.name, doc._id);
  }

  let created = 0;
  let skipped = 0;
  for (const p of products) {
    const exists = await Product.exists({ name: p.name });
    if (exists) {
      skipped++;
      continue;
    }
    await Product.create({
      ...p,
      category: catMap.get(p.category),
      available: true,
      featured: false,
      minimumStock: 5,
      image: "",
    });
    created++;
  }

  console.log(`Created ${created} products, skipped ${skipped} duplicates.`);
  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
