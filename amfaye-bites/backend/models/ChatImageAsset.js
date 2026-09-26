import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bytes: { type: Number, required: true, min: 1 },
    state: {
      type: String,
      enum: ["pending", "attached", "deleting"],
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
schema.index({ state: 1, expiresAt: 1 });
// No TTL: deleting metadata alone would leak GridFS chunks and quota reservations.
export default mongoose.model("ChatImageAsset", schema);
