import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
    },
    sequence: { type: Number, required: true, min: 1 },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: { type: String, enum: ["customer", "admin"], required: true },
    senderName: { type: String, required: true, maxlength: 100 },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    clientMessageId: { type: String, required: true, maxlength: 100 },
  },
  { timestamps: true },
);
schema.index({ conversation: 1, sequence: 1 }, { unique: true });
schema.index(
  { conversation: 1, sender: 1, clientMessageId: 1 },
  { unique: true },
);
schema.index({ conversation: 1, senderRole: 1, sequence: 1 });
export default mongoose.model("ChatMessage", schema);
