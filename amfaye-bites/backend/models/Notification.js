import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    orderNumber: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Preparing",
        "Ready for Pickup",
        "Completed",
        "Cancelled",
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 500 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
// Order transitions never return to a previous status. This also guards against duplicate events.
notificationSchema.index({ order: 1, status: 1 }, { unique: true });
export default mongoose.model("Notification", notificationSchema);
