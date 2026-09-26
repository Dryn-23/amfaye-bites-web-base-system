import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model("ChatRateBucket", schema);
