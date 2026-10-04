import mongoose from "mongoose";

const flashSaleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, maxlength: 500 },
    discountPercent: { type: Number, required: true, min: 1, max: 90 },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
    maxUsesPerCustomer: { type: Number, default: 1 },
    usedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usedAt: Date,
      },
    ],
  },
  { timestamps: true }
);

flashSaleSchema.index({ active: 1, startDate: 1, endDate: 1 });

// Method to check if flash sale is currently active
flashSaleSchema.methods.isActive = function () {
  const now = new Date();
  return this.active && this.startDate <= now && this.endDate > now;
};

export default mongoose.model("FlashSale", flashSaleSchema);
