// Development only: downloads and runs a real, temporary MongoDB replica set.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import crypto from "node:crypto";
if (process.env.NODE_ENV === "production")
  throw new Error(
    "Temporary database is development only. Use MongoDB Atlas in production.",
  );
const repl = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
process.env.MONGODB_URI = repl.getUri("amfaye_bites");
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.DEMO_PAYMENTS_ENABLED = "true";
process.env.SEED_ADMIN_EMAIL = "admin@amfayebites.demo";
process.env.SEED_ADMIN_PASSWORD =
  process.env.DEMO_ADMIN_PASSWORD ||
  crypto.randomBytes(12).toString("base64url");
const { connectDatabase } = await import("./config/database.js");
await connectDatabase();
const { seed } = await import("./seed/seedDatabase.js");
await seed();
const { app } = await import("./app.js");
const server = app.listen(5000, "0.0.0.0", () =>
  console.log(
    `Temporary demo API on 5000. Admin: ${process.env.SEED_ADMIN_EMAIL} / ${process.env.SEED_ADMIN_PASSWORD}`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    server.close();
    await repl.stop();
    process.exit();
  });
