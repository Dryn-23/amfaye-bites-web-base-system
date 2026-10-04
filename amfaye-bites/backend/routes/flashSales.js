import express from "express";
import { auth } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/roleMiddleware.js";
import { wrap } from "../utils/validators.js";
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
router.get("/active", wrap(getActiveFlashSales));
router.get("/:id", wrap(getFlashSale));

// Protected routes (require authentication)
router.get("/:id/eligibility", auth, wrap(checkFlashSaleEligibility));

// Admin routes
router.get("/", auth, admin, wrap(getAllFlashSales));
router.post("/", auth, admin, wrap(createFlashSale));
router.patch("/:id", auth, admin, wrap(updateFlashSale));
router.delete("/:id", auth, admin, wrap(deleteFlashSale));

export default router;
