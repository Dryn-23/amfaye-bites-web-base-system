import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import auth from "./routes/authRoutes.js";
import products from "./routes/productRoutes.js";
import categories from "./routes/categoryRoutes.js";
import orders from "./routes/orderRoutes.js";
import inventory from "./routes/inventoryRoutes.js";
import payments from "./routes/paymentRoutes.js";
import users from "./routes/userRoutes.js";
import reports from "./routes/reportRoutes.js";
import extras from "./routes/extraRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";
export const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      const allowed = (process.env.FRONTEND_URL || "http://localhost:5173")
        .split(",")
        .map((s) => s.trim());
      cb(null, !origin || allowed.includes(origin));
    },
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    message: { message: "Too many requests. Please wait a minute." },
  }),
);
app.get("/api/health", (req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({
      success: mongoose.connection.readyState === 1,
      message:
        mongoose.connection.readyState === 1
          ? "Amfaye Bites API is running"
          : "Database unavailable",
    }),
);
app.use("/api", (req, res, next) =>
  mongoose.connection.readyState === 1
    ? next()
    : res
        .status(503)
        .json({ message: "Database unavailable. Please try again shortly." }),
);
for (const [path, router] of Object.entries({
  auth,
  products,
  categories,
  orders,
  inventory,
  payments,
  users,
  reports,
}))
  app.use("/api/" + path, router);
app.use("/api", extras);
app.use((req, res) => res.status(404).json({ message: "Endpoint not found." }));
app.use(errorHandler);
