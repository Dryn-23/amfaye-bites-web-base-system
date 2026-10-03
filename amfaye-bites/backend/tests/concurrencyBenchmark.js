import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { app } from "../app.js";
import { seed } from "../seed/seedDatabase.js";
import * as M from "../models/index.js";
import { hashPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";

function calcStats(latencies) {
  if (!latencies.length) return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p = (pct) => sorted[Math.min(Math.floor((pct / 100) * sorted.length), sorted.length - 1)];
  return {
    min: sorted[0].toFixed(1),
    max: sorted[sorted.length - 1].toFixed(1),
    avg: (sum / sorted.length).toFixed(1),
    p50: p(50).toFixed(1),
    p90: p(90).toFixed(1),
    p95: p(95).toFixed(1),
    p99: p(99).toFixed(1),
  };
}

async function runConcurrentTest(name, userCount, taskFn) {
  console.log(`\n======================================================`);
  console.log(`🚀 RUNNING BENCHMARK: ${name}`);
  console.log(`⚡ Concurrency Level: ${userCount} simultaneous users`);
  console.log(`======================================================`);

  const startTime = performance.now();
  const latencies = [];
  const results = { success: 0, failed: 0, errors: [] };

  // Run all user tasks at the exact same moment
  const promises = Array.from({ length: userCount }, (_, i) => {
    return (async () => {
      const t0 = performance.now();
      try {
        const res = await taskFn(i);
        const t1 = performance.now();
        latencies.push(t1 - t0);
        if (res && res.success !== false) {
          results.success++;
        } else {
          results.failed++;
          if (res?.error) results.errors.push(res.error);
        }
      } catch (err) {
        const t1 = performance.now();
        latencies.push(t1 - t0);
        results.failed++;
        results.errors.push(err.message || String(err));
      }
    })();
  });

  await Promise.all(promises);
  const totalDuration = (performance.now() - startTime) / 1000;
  const stats = calcStats(latencies);
  const rps = (userCount / totalDuration).toFixed(1);

  console.log(`⏱️  Total Duration   : ${totalDuration.toFixed(2)}s`);
  console.log(`📈 Throughput       : ${rps} requests/sec`);
  console.log(`✅ Successes        : ${results.success} / ${userCount} (${((results.success / userCount) * 100).toFixed(1)}%)`);
  if (results.failed > 0) {
    console.log(`❌ Failures         : ${results.failed} / ${userCount}`);
    console.log(`⚠️  Sample Error     : ${results.errors[0] || 'Unknown'}`);
  }
  console.log(`📊 Latency Breakdown:`);
  console.log(`   • Min: ${stats.min} ms | Avg: ${stats.avg} ms | Median (p50): ${stats.p50} ms`);
  console.log(`   • 90th percentile (p90): ${stats.p90} ms`);
  console.log(`   • 95th percentile (p95): ${stats.p95} ms`);
  console.log(`   • Max latency          : ${stats.max} ms`);

  return { totalDuration, rps, stats, results };
}

async function main() {
  console.log("Setting up isolated in-memory MongoDB replica set...");
  process.env.DISABLE_RATE_LIMIT = "true";
  process.env.ORDER_ACCOUNT_LIMIT = "10000";
  process.env.ORDER_IP_LIMIT = "100000";
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  process.env.DEMO_PAYMENTS_ENABLED = "true";
  process.env.SEED_ADMIN_EMAIL = "admin@test.local";
  process.env.SEED_ADMIN_PASSWORD = "Test-Admin-Password-12345";

  const repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  await mongoose.connect(repl.getUri("amfaye_bites"));
  await seed();
  console.log("Database seeded successfully.\n");

  // Ensure high stock on all products & ingredients so stock exhaustion doesn't stop concurrency tests
  await M.Product.updateMany({}, { $set: { stock: 50000, available: true } });
  await M.Ingredient.updateMany({}, { $set: { stock: 500000 } });

  // Get active products
  const allProducts = await M.Product.find({ available: true }).lean();
  if (!allProducts.length) {
    console.error("No test products found!");
    process.exit(1);
  }

  // Pre-generate 100 test user accounts for the test
  console.log("Pre-creating 100 registered customer accounts for realistic login & checkout tests...");
  const testUsers = [];
  const defaultPassword = "ConcurrentPassword#123!";
  const sharedPasswordHash = await hashPassword(defaultPassword);

  for (let i = 0; i < 100; i++) {
    const email = `user_${i}_${Date.now()}@concurrency-test.local`;
    const username = `user_${i}_${Date.now()}`;
    const user = await M.User.create({
      name: `Concurrent User ${i}`,
      email,
      username,
      phone: `0917${String(i).padStart(7, "0")}`,
      passwordHash: sharedPasswordHash,
      role: "customer",
    });
    testUsers.push({ user, email, password: defaultPassword });
  }
  console.log("Created 100 test users.\n");

  // TEST 1: Concurrent Logins (CPU + Bcrypt + Auth lookup)
  // Testing 10, 25, 50 simultaneous logins
  for (const concurrency of [10, 25, 50]) {
    await runConcurrentTest("Simultaneous User Logins", concurrency, async (i) => {
      const u = testUsers[i % testUsers.length];
      const res = await request(app)
        .post("/api/auth/login")
        .send({ login: u.email, password: u.password });
      return { success: res.status === 200, error: res.body?.message };
    });
  }

  // Pre-generate tokens for all test users
  console.log("\nGenerating authenticated tokens for checkout concurrency tests...");
  const tokens = testUsers.map((u) => signToken(u.user));

  // TEST 2: Concurrent Menu Browsing & Cart Sync
  for (const concurrency of [50, 100]) {
    await runConcurrentTest("Simultaneous Menu & Product Browsing", concurrency, async (i) => {
      const token = tokens[i % tokens.length];
      const res = await request(app)
        .get("/api/products")
        .set("Authorization", `Bearer ${token}`);
      return { success: res.status === 200, error: res.body?.message };
    });
  }

  // Set huge stock on a few products so stock exhaustion isn't the limiting factor
  await M.Product.updateMany({}, { $set: { stock: 10000 } });
  await M.Ingredient.updateMany({}, { $set: { stock: 100000 } });

  // TEST 3: Simultaneous Concurrent Ordering (MongoDB Transactions + Stock Deductions)
  for (const concurrency of [10, 25, 50, 100]) {
    await runConcurrentTest("Simultaneous Order Creation (Transactions)", concurrency, async (i) => {
      const token = tokens[i % tokens.length];
      const product = allProducts[i % allProducts.length];
      const idempotencyKey = crypto.randomUUID();

      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          items: [
            {
              product: product._id,
              quantity: 1,
            },
          ],
          paymentMethod: "Cash",
          idempotencyKey,
        });

      return { success: res.status === 201, error: res.body?.message };
    });
  }

  // TEST 4: Real-world Mixed Traffic Burst (Logins + Menu Browsing + Cart + Checkout in Parallel)
  await runConcurrentTest("Mixed Real-World Burst (100 Simultaneous Actions: Login/Browse/Order)", 100, async (i) => {
    const actionType = i % 3;
    const u = testUsers[i % testUsers.length];
    const token = tokens[i % tokens.length];
    const product = allProducts[i % allProducts.length];

    if (actionType === 0) {
      // User Logging In
      const res = await request(app)
        .post("/api/auth/login")
        .send({ login: u.email, password: u.password });
      return { success: res.status === 200, error: res.body?.message };
    } else if (actionType === 1) {
      // User Browsing Menu
      const res = await request(app)
        .get("/api/products")
        .set("Authorization", `Bearer ${token}`);
      return { success: res.status === 200, error: res.body?.message };
    } else {
      // User Placing Order
      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          items: [{ product: product._id, quantity: 1 }],
          paymentMethod: "Cash",
          idempotencyKey: crypto.randomUUID(),
        });
      return { success: res.status === 201, error: res.body?.message };
    }
  });

  // Check database integrity
  const totalOrders = await M.Order.countDocuments();
  const negativeStockProducts = await M.Product.countDocuments({ stock: { $lt: 0 } });
  const negativeStockIngredients = await M.Ingredient.countDocuments({ stock: { $lt: 0 } });

  console.log("\n======================================================");
  console.log("🛡️ DATABASE INTEGRITY & TRANSACTION INTEGRITY CHECK");
  console.log("======================================================");
  console.log(`📦 Total Orders Placed in DB : ${totalOrders}`);
  console.log(`🔒 Products with negative stock   : ${negativeStockProducts} (MUST BE 0)`);
  console.log(`🔒 Ingredients with negative stock: ${negativeStockIngredients} (MUST BE 0)`);
  console.log("======================================================\n");

  await mongoose.disconnect();
  await repl.stop();
  console.log("Concurrency benchmark completed successfully!");
}

main().catch((err) => {
  console.error("Benchmark failed with error:", err);
  process.exit(1);
});
