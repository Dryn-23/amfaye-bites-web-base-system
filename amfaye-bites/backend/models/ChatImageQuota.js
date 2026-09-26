import mongoose from "mongoose";
const schema = new mongoose.Schema({
  _id: String,
  bytes: { type: Number, default: 0, min: 0 },
});
export default mongoose.model("ChatImageQuota", schema);
