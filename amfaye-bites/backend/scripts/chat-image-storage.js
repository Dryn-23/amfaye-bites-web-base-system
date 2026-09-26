// Run inside backend with the normal Atlas environment. No seeding/resetting.
import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import Asset from "../models/ChatImageAsset.js";
import Quota from "../models/ChatImageQuota.js";
import { cleanupExpired, storageLimit } from "../services/chatImageService.js";
try {
  await connectDatabase();
  await Asset.createIndexes();
  await Quota.createIndexes();
  if (process.argv.includes("--cleanup")) {
    let total = 0,
      n;
    do {
      n = await cleanupExpired();
      total += n;
    } while (n === 200);
    console.log("Removed stale unfinished uploads:", total);
  }
  const q = await Quota.findById("chat-images");
  console.log(
    "Reserved/stored image bytes:",
    q?.bytes || 0,
    "; configured limit:",
    storageLimit(),
  );
} finally {
  await mongoose.disconnect();
}
