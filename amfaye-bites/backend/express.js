import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import qualityRoutes from "./routes/qualityRoutes.js";

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "200kb" }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Existing auth/routes would mount here; for this fix mount quality
app.use("/api/quality", qualityRoutes);

export { app };
