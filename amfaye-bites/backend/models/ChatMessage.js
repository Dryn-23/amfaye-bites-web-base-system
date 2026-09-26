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
    text: { type: String, default: "", trim: true, maxlength: 1000 },
    attachment: {
      type: new mongoose.Schema(
        {
          file: { type: mongoose.Schema.Types.ObjectId, required: true },
          mime: { type: String, enum: ["image/jpeg"], required: true },
          bytes: { type: Number, required: true },
          width: Number,
          height: Number,
          sha256: { type: String, required: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
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
