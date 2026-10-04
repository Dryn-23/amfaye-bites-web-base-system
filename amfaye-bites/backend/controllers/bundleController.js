import Bundle from "../models/Bundle.js";
import { Product } from "../models/index.js";
import { z } from "zod";

const bundleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  items: z.array(
    z.object({
      product: z.string(),
      name: z.string().optional(),
      quantity: z.number().min(1),
    })
  ).min(2),
  originalPrice: z.number().min(0),
  bundlePrice: z.number().min(0),
  active: z.boolean().default(true),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  imageUrl: z.string().url().optional(),
});

// Get all bundles
export async function getAllBundles(req, res) {
  const { active } = req.query;

  const query = {};
  if (active === "true") {
    const now = new Date();
    query.active = true;
    query.$or = [
      { endDate: { $exists: false } },
      { endDate: { $gt: now } },
    ];
  }

  const bundles = await Bundle.find(query)
    .populate("items.product", "name price images")
    .sort({ createdAt: -1 });

  res.json(bundles);
}

// Get active bundles for customer view
export async function getActiveBundles(req, res) {
  const now = new Date();

  const bundles = await Bundle.find({
    active: true,
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gt: now } },
    ],
  })
    .populate("items.product", "name price images stock")
    .sort({ createdAt: -1 });

  res.json(bundles);
}

// Get one bundle
export async function getBundle(req, res) {
  const bundle = await Bundle.findById(req.params.id)
    .populate("items.product", "name price images stock");

  if (!bundle) {
    return res.status(404).json({ message: "Bundle not found" });
  }

  res.json(bundle);
}

// Create bundle (admin)
export async function createBundle(req, res) {
  const data = bundleSchema.parse(req.body);

  // Validate that bundle price is less than original
  if (data.bundlePrice >= data.originalPrice) {
    return res.status(400).json({
      message: "Bundle price must be less than original price"
    });
  }

  // Validate dates if provided
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end <= start) {
      return res.status(400).json({ message: "End date must be after start date" });
    }
  }

  // Populate item names from products
  for (const item of data.items) {
    if (!item.name) {
      const product = await Product.findById(item.product);
      if (product) {
        item.name = product.name;
      }
    }
  }

  const bundle = await Bundle.create(data);
  await bundle.populate("items.product", "name price images");

  res.status(201).json(bundle);
}

// Update bundle (admin)
export async function updateBundle(req, res) {
  const data = bundleSchema.partial().parse(req.body);

  if (data.bundlePrice && data.originalPrice && data.bundlePrice >= data.originalPrice) {
    return res.status(400).json({
      message: "Bundle price must be less than original price"
    });
  }

  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end <= start) {
      return res.status(400).json({ message: "End date must be after start date" });
    }
  }

  const bundle = await Bundle.findByIdAndUpdate(
    req.params.id,
    data,
    { new: true, runValidators: true }
  ).populate("items.product", "name price images");

  if (!bundle) {
    return res.status(404).json({ message: "Bundle not found" });
  }

  res.json(bundle);
}

// Delete bundle (admin)
export async function deleteBundle(req, res) {
  const bundle = await Bundle.findByIdAndDelete(req.params.id);

  if (!bundle) {
    return res.status(404).json({ message: "Bundle not found" });
  }

  res.json({ message: "Bundle deleted successfully" });
}

// Check bundle availability
export async function checkBundleAvailability(req, res) {
  const bundle = await Bundle.findById(req.params.id)
    .populate("items.product", "stock");

  if (!bundle) {
    return res.status(404).json({ message: "Bundle not found" });
  }

  if (!bundle.active) {
    return res.json({ available: false, reason: "Bundle is not active" });
  }

  const now = new Date();
  if (bundle.endDate && bundle.endDate < now) {
    return res.json({ available: false, reason: "Bundle has expired" });
  }

  // Check if all items have sufficient stock
  for (const item of bundle.items) {
    if (item.product.stock < item.quantity) {
      return res.json({
        available: false,
        reason: `Insufficient stock for ${item.name}`
      });
    }
  }

  res.json({ available: true });
}
