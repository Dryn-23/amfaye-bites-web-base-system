import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderNumber: { type: String, required: true },
    customerName: { type: String, required: true },
    status: { type: String, enum: ["Open", "Closed"], default: "Open" },
    lastSequence: { type: Number, default: 0, min: 0 },
    customerReadSequence: { type: Number, default: 0, min: 0 },
    adminReadSequence: { type: Number, default: 0, min: 0 },
    customerUnread: { type: Number, default: 0, min: 0 },
    adminUnread: { type: Number, default: 0, min: 0 },
    lastMessage: { type: String, default: "", maxlength: 180 },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
schema.index({ customer: 1, lastMessageAt: -1, _id: -1 });
schema.index({ status: 1, lastMessageAt: -1, _id: -1 });
export default mongoose.model("ChatConversation", schema);
