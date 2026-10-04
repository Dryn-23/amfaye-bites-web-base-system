import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
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
import preparation from "./routes/preparationRoutes.js";
import reviews from "./routes/reviewRoutes.js";
import chats from "./routes/chatRoutes.js";
import notifications from "./routes/notificationRoutes.js";
import flashSales from "./routes/flashSales.js";
import bundles from "./routes/bundles.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

export const app = express();

const dbReady = () => mongoose.connection.readyState === 1;

// Set to "true" ONLY on your local machine when running load tests.
// Never set this in production.
const rateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

// Requests per minute per IP. Override with API_RATE_LIMIT in your .env.
const apiRateLimit = Number(process.env.API_RATE_LIMIT) || 600;

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(compression());

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

// Health check sits ABOVE the rate limiter so uptime monitors and
// load balancers are never blocked and don't use up the client's quota.
app.get("/api/health", (req, res) => {
  const ok = dbReady();
  res.status(ok ? 200 : 503).json({
    success: ok,
    message: ok ? "Amfaye Bites API is running" : "Database unavailable",
  });
});

// Global limiter for the rest of the API.
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: apiRateLimit,
    message: { message: "Too many requests. Please wait a minute." },
    skip: () => rateLimitDisabled,
  }),
);

// Block API calls while the database is down.
app.use("/api", (req, res, next) =>
  dbReady()
    ? next()
    : res
        .status(503)
        .json({ message: "Database unavailable. Please try again shortly." }),
);

const routes = {
  preparation,
  reviews,
  chats,
  auth,
  products,
  categories,
  orders,
  inventory,
  payments,
  users,
  reports,
  notifications,
  "flash-sales": flashSales,
  bundles,
};

for (const [path, router] of Object.entries(routes)) {
  app.use(`/api/${path}`, router);
}

app.use("/api", extras);

app.use((req, res) => res.status(404).json({ message: "Endpoint not found." }));
app.use(errorHandler);