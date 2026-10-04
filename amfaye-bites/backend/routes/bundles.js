import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  getAllBundles,
  getActiveBundles,
  getBundle,
  createBundle,
  updateBundle,
  deleteBundle,
  checkBundleAvailability,
} from "../controllers/bundleController.js";

const router = express.Router();

// Public routes
router.get("/active", getActiveBundles);
router.get("/:id", getBundle);
router.get("/:id/availability", checkBundleAvailability);

// Admin routes
router.get("/", authenticate, authorize("admin"), getAllBundles);
router.post("/", authenticate, authorize("admin"), createBundle);
router.patch("/:id", authenticate, authorize("admin"), updateBundle);
router.delete("/:id", authenticate, authorize("admin"), deleteBundle);

export default router;
