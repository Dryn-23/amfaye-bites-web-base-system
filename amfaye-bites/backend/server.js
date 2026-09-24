import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32 ||
  process.env.JWT_SECRET.startsWith("replace_")
) {
  console.error("Set JWT_SECRET to a random secret of at least 32 characters.");
  process.exit(1);
}
try {
  await connectDatabase();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`Server running on port ${PORT}`),
  );
} catch (error) {
  console.error(
    "Could not connect to MongoDB. Check MONGODB_URI, database user and network access.",
  );
  process.exit(1);
}
