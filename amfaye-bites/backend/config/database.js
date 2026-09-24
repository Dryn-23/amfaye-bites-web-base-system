import mongoose from "mongoose";
export async function connectDatabase() {
  if (!process.env.MONGODB_URI)
    throw new Error(
      "MONGODB_URI is required. Copy .env.example and configure MongoDB.",
    );
  mongoose.set("strictQuery", true);
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "amfaye_bites",
    serverSelectionTimeoutMS: 10000,
  });
  console.log("MongoDB connected: amfaye_bites");
}
