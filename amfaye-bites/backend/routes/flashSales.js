import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  getAllFlashSales,
  getActiveFlashSales,
  getFlashSale,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
  checkFlashSaleEligibility,
} from "../controllers/flashSaleController.js";

const router = express.Router();

// Public routes
router.get("/active", getActiveFlashSales);
router.get("/:id", getFlashSale);

// Protected routes (require authentication)
router.get("/:id/eligibility", authenticate, checkFlashSaleEligibility);

// Admin routes
router.get("/", authenticate, authorize("admin"), getAllFlashSales);
router.post("/", authenticate, authorize("admin"), createFlashSale);
router.patch("/:id", authenticate, authorize("admin"), updateFlashSale);
router.delete("/:id", authenticate, authorize("admin"), deleteFlashSale);

export default router;
