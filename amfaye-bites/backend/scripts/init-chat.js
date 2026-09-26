// Optional explicit index initialization; does not reset or seed your database.
import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import Conversation from "../models/ChatConversation.js";
import Message from "../models/ChatMessage.js";
import Bucket from "../models/ChatRateBucket.js";
try {
  await connectDatabase();
  for (const Model of [Conversation, Message, Bucket]) {
    await Model.createIndexes();
    console.log("Chat indexes ready: " + Model.collection.name);
  }
} finally {
  await mongoose.disconnect();
}
