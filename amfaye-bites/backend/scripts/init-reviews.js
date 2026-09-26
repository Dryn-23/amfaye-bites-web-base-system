import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import Review from "../models/Review.js";
import Bucket from "../models/ReviewRateBucket.js";
try {
  await connectDatabase();
  for (const model of [Review, Bucket]) {
    await model.createIndexes();
    console.log("Indexes ready: " + model.collection.name);
  }
} finally {
  await mongoose.disconnect();
}
