import mongoose from "mongoose";

const bundleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    originalPrice: { type: Number, required: true, min: 0 },
    bundlePrice: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    startDate: Date,
    endDate: Date,
    imageUrl: String,
  },
  { timestamps: true }
);

bundleSchema.index({ active: 1, endDate: 1 });

export default mongoose.model("Bundle", bundleSchema);
