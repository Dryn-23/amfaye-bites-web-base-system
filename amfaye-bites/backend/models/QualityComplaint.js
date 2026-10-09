import mongoose from "mongoose";

const ref = (name, required = false) => ({ type: mongoose.Schema.Types.ObjectId, ref: name, required });

const schema = new mongoose.Schema({
  order: { ...ref("Order"), required: true },
  customer: { ...ref("User"), required: true },
  orderNumber: { type: String, trim: true, maxlength: 50 },
  issueType: { type: String, enum: ["Insects / Pest","Mold / Spoilage","Damaged / Crushed","Wrong Item","Allergen / Health","Other"], required: true },
  description: { type: String, trim: true, required: true, maxlength: 2000 },
  photoUrl: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ["Open","Under Review","Resolved","Refunded","Rejected"], default: "Open" },
  ticket: { type: String, trim: true, unique: true, index: true },
  keywordFlags: [{ type: String, trim: true }],
  staffNote: { type: String, trim: true, maxlength: 2000, default: "" },
}, { timestamps: true });

schema.index({ customer: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });

export default mongoose.model("QualityComplaint", schema);
