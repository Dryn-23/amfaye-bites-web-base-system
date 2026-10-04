import express from "express";
import { auth } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/roleMiddleware.js";
import { wrap } from "../utils/validators.js";
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
router.get("/active", wrap(getActiveBundles));
router.get("/:id", wrap(getBundle));
router.get("/:id/availability", wrap(checkBundleAvailability));

// Admin routes
router.get("/", auth, admin, wrap(getAllBundles));
router.post("/", auth, admin, wrap(createBundle));
router.patch("/:id", auth, admin, wrap(updateBundle));
router.delete("/:id", auth, admin, wrap(deleteBundle));

export default router;
