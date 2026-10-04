import FlashSale from "../models/FlashSale.js";
import { z } from "zod";

const flashSaleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  discountPercent: z.number().min(1).max(90),
  products: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  active: z.boolean().default(true),
  maxUsesPerCustomer: z.number().min(1).default(1),
});

// Get all flash sales
export async function getAllFlashSales(req, res) {
  const { active } = req.query;

  const query = {};
  if (active === "true") {
    const now = new Date();
    query.active = true;
    query.startDate = { $lte: now };
    query.endDate = { $gt: now };
  }

  const flashSales = await FlashSale.find(query)
    .populate("products", "name price images")
    .populate("categories", "name")
    .sort({ startDate: -1 });

  res.json(flashSales);
}

// Get active flash sales for customer view
export async function getActiveFlashSales(req, res) {
  const now = new Date();

  const flashSales = await FlashSale.find({
    active: true,
    startDate: { $lte: now },
    endDate: { $gt: now },
  })
    .populate("products", "name price images stock")
    .populate("categories", "name")
    .sort({ endDate: 1 });

  res.json(flashSales);
}

// Get one flash sale
export async function getFlashSale(req, res) {
  const flashSale = await FlashSale.findById(req.params.id)
    .populate("products", "name price images stock")
    .populate("categories", "name");

  if (!flashSale) {
    return res.status(404).json({ message: "Flash sale not found" });
  }

  res.json(flashSale);
}

// Create flash sale (admin)
export async function createFlashSale(req, res) {
  const data = flashSaleSchema.parse(req.body);

  // Validate dates
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  if (end <= start) {
    return res.status(400).json({ message: "End date must be after start date" });
  }

  const flashSale = await FlashSale.create(data);
  await flashSale.populate("products categories");

  res.status(201).json(flashSale);
}

// Update flash sale (admin)
export async function updateFlashSale(req, res) {
  const data = flashSaleSchema.partial().parse(req.body);

  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end <= start) {
      return res.status(400).json({ message: "End date must be after start date" });
    }
  }

  const flashSale = await FlashSale.findByIdAndUpdate(
    req.params.id,
    data,
    { new: true, runValidators: true }
  ).populate("products categories");

  if (!flashSale) {
    return res.status(404).json({ message: "Flash sale not found" });
  }

  res.json(flashSale);
}

// Delete flash sale (admin)
export async function deleteFlashSale(req, res) {
  const flashSale = await FlashSale.findByIdAndDelete(req.params.id);

  if (!flashSale) {
    return res.status(404).json({ message: "Flash sale not found" });
  }

  res.json({ message: "Flash sale deleted successfully" });
}

// Check if user can use flash sale
export async function checkFlashSaleEligibility(req, res) {
  const { id } = req.params;
  const userId = req.user._id;

  const flashSale = await FlashSale.findById(id);

  if (!flashSale) {
    return res.status(404).json({ message: "Flash sale not found" });
  }

  if (!flashSale.isActive()) {
    return res.json({ eligible: false, reason: "Flash sale is not currently active" });
  }

  const usageCount = flashSale.usedBy.filter(
    (usage) => usage.user.toString() === userId.toString()
  ).length;

  if (usageCount >= flashSale.maxUsesPerCustomer) {
    return res.json({ eligible: false, reason: "You have reached the usage limit" });
  }

  res.json({ eligible: true });
}
