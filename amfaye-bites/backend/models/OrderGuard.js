import mongoose from "mongoose";

// Deterministic HMAC IDs: no raw IP address or account identifier is stored here.
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    scope: { type: String, enum: ["account", "ip"], required: true },
    attempts: { type: Number, default: 0, min: 0 },
    windowStartedAt: { type: Date, required: true },
    blockedUntil: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model("OrderGuard", schema);
