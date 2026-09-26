import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger,
    },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    displayName: { type: String, required: true, trim: true, maxlength: 40 },
    hidden: { type: Boolean, default: false },
    moderationReason: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true },
);
schema.index({ product: 1, customer: 1 }, { unique: true });
schema.index({ product: 1, hidden: 1, createdAt: -1, _id: -1 });
schema.index({ hidden: 1, createdAt: -1 });
export default mongoose.model("Review", schema);
