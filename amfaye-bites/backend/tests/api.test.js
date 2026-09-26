import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { app } from "../app.js";
import { seed } from "../seed/seedDatabase.js";
import * as M from "../models/index.js";
let repl, customer, admin, other, products;
const req = (method, path, token, body) => {
  const r = request(app)[method]("/api" + path);
  if (token) r.set("Authorization", "Bearer " + token);
  return body ? r.send(body) : r;
};
const makeOrder = (p, extra = {}) => ({
  items: [{ product: p._id, quantity: 1 }],
  paymentMethod: "Cash",
  idempotencyKey: crypto.randomUUID(),
  ...extra,
});
before(async () => {
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  process.env.DEMO_PAYMENTS_ENABLED = "true";
  process.env.SEED_ADMIN_EMAIL = "admin@test.local";
  process.env.SEED_ADMIN_PASSWORD = "Test-Admin-Only-12345";
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(repl.getUri("amfaye_bites"));
  await seed();
  const a = await req("post", "/auth/login", null, {
    login: "admin@test.local",
    password: "Test-Admin-Only-12345",
  });
  assert.equal(a.status, 200);
  admin = a.body.token;
  products = (await req("get", "/products")).body;
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});
test("Public catalog, health, categories, search data and private route enforcement", async () => {
  assert.equal((await req("get", "/health")).status, 200);
  assert.equal(products.length, 15);
  assert.equal((await req("get", "/categories")).body.length, 4);
  assert.equal((await req("get", "/orders")).status, 401);
  assert.equal((await req("get", "/products/not-valid")).status, 400);
});
test("Registration hashes passwords, rejects duplicates and ignores injected role", async () => {
  const data = {
    name: "Test Customer",
    email: "customer@test.local",
    username: "testcustomer",
    phone: "09123456789",
    password: "Customer-Test-123",
    confirmPassword: "Customer-Test-123",
    role: "admin",
  };
  const r = await req("post", "/auth/register", null, data);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  customer = r.body.token;
  assert.equal(r.body.user.role, "customer");
  assert.equal(r.body.user.passwordHash, undefined);
  const u = await M.User.findOne({ email: data.email }).select("+passwordHash");
  assert.match(u.passwordHash, /^\$2/);
  assert.notEqual(u.passwordHash, data.password);
  assert.equal((await req("post", "/auth/register", null, data)).status, 409);
  assert.equal(
    (
      await req("post", "/auth/login", null, {
        login: data.username,
        password: data.password,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("post", "/auth/login", null, {
        login: data.username,
        password: "incorrect",
      })
    ).status,
    401,
  );
  const r2 = await req("post", "/auth/register", null, {
    ...data,
    email: "other@test.local",
    username: "othercustomer",
  });
  other = r2.body.token;
});
test("Admin/customer authorization enforced on all management routes", async () => {
  for (const path of [
    "/users",
    "/customers",
    "/reports/sales",
    "/reports/products",
    "/reports/inventory",
    "/settings",
    "/inventory",
  ])
    assert.equal((await req("get", path, customer)).status, 403, path);
  assert.equal((await req("post", "/products", customer, {})).status, 403);
  assert.equal(
    (
      await req(
        "post",
        "/orders",
        customer,
        makeOrder(products[0], { source: "pos" }),
      )
    ).status,
    403,
  );
  assert.equal((await req("get", "/users", admin)).status, 200);
});
test("Cart API stores validated customizations", async () => {
  const r = await req("put", "/cart", customer, {
    items: [{ product: products[0]._id, quantity: 2 }],
  });
  assert.equal(r.status, 200);
  assert.equal((await req("get", "/cart", customer)).body.items[0].quantity, 2);
  assert.equal(
    (
      await req("put", "/cart", customer, {
        items: [{ product: products[0]._id, quantity: -1 }],
      })
    ).status,
    400,
  );
});
test("Order creation is authoritative, atomic and idempotent; cancellation restores inventory", async () => {
  const p = products[0];
  const initial = await M.Product.findById(p._id);
  const recipe = await M.ProductRecipe.findOne({ product: p._id });
  const ingredient = await M.Ingredient.findById(
    recipe.ingredients[0].ingredient,
  );
  const body = makeOrder(p, { total: 1 });
  const r = await req("post", "/orders", customer, body);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.total, p.price);
  assert.equal(r.body.paymentStatus, "Pending");
  assert.equal((await M.Product.findById(p._id)).stock, initial.stock - 1);
  assert.ok(
    (await M.Ingredient.findById(ingredient._id)).stock < ingredient.stock,
  );
  const again = await req("post", "/orders", customer, body);
  assert.equal(again.body._id, r.body._id);
  assert.equal((await M.Product.findById(p._id)).stock, initial.stock - 1);
  assert.equal((await req("get", "/orders/" + r.body._id, other)).status, 403);
  assert.equal((await req("get", "/orders", other)).body.length, 0);
  assert.equal(
    (
      await req("put", "/orders/" + r.body._id + "/status", customer, {
        status: "Confirmed",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("put", "/orders/" + r.body._id + "/status", admin, {
        status: "Completed",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("put", "/orders/" + r.body._id + "/status", admin, {
        status: "Cancelled",
      })
    ).status,
    200,
  );
  assert.equal((await M.Product.findById(p._id)).stock, initial.stock);
  assert.equal(
    (await M.Ingredient.findById(ingredient._id)).stock,
    ingredient.stock,
  );
});
test("POS validates cash amount, creates sale, payment, receipt and change", async () => {
  const p = products[1];
  const before = (await M.Product.findById(p._id)).stock;
  assert.equal(
    (
      await req(
        "post",
        "/orders",
        admin,
        makeOrder(p, { source: "pos", amountReceived: 1 }),
      )
    ).status,
    400,
  );
  assert.equal((await M.Product.findById(p._id)).stock, before);
  const r = await req(
    "post",
    "/orders",
    admin,
    makeOrder(p, { source: "pos", amountReceived: 200, promoCode: "SWEET10" }),
  );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.total, Math.round(p.price * 0.9 * 100) / 100);
  const d = await req("get", "/orders/" + r.body._id, admin);
  assert.equal(
    d.body.payment.change,
    Math.round((200 - r.body.total) * 100) / 100,
  );
  assert.ok(d.body.receipt);
  assert.equal(r.body.status, "Completed");
  assert.ok(await M.Sale.exists({ order: r.body._id }));
});
test("Shake pricing, add-ons, demo OTP, one-time verification and payment void", async () => {
  const p = products.find((p) => p.customizable);
  const addons = (await req("get", "/addons")).body;
  const body = makeOrder(p, {
    paymentMethod: "Demo GCash",
    items: [
      {
        product: p._id,
        quantity: 2,
        customization: {
          size: "Large",
          sugar: "25%",
          ice: "Less Ice",
          addons: [addons[0]._id],
        },
      },
    ],
  });
  assert.equal((await req("post", "/orders", customer, body)).status, 400);
  const otp = (await req("post", "/payments/demo-otp", customer, {})).body;
  assert.equal(
    (
      await req("post", "/payments/demo-verify", other, {
        sessionId: otp.sessionId,
        code: otp.demoCode,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("post", "/payments/demo-verify", customer, {
        sessionId: otp.sessionId,
        code: "000000",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("post", "/payments/demo-verify", customer, {
        sessionId: otp.sessionId,
        code: otp.demoCode,
      })
    ).status,
    200,
  );
  const r = await req("post", "/orders", customer, {
    ...body,
    otpSession: otp.sessionId,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.total, 2 * (p.price + 40 + addons[0].price));
  assert.equal(r.body.items[0].customization.sugar, "25%");
  assert.equal(
    (
      await req("post", "/orders", customer, {
        ...body,
        otpSession: otp.sessionId,
        idempotencyKey: crypto.randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("put", "/orders/" + r.body._id + "/status", admin, {
        status: "Cancelled",
      })
    ).status,
    200,
  );
  assert.equal(
    (await M.Payment.findOne({ order: r.body._id })).status,
    "Voided",
  );
});
test("Stock race: one remaining serving cannot be oversold", async () => {
  const p = products[4];
  await M.Product.updateOne({ _id: p._id }, { $set: { stock: 1 } });
  const responses = await Promise.all([
    req("post", "/orders", customer, makeOrder(p)),
    req("post", "/orders", other, makeOrder(p)),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await M.Product.findById(p._id)).stock, 0);
  const list = (await req("get", "/products")).body;
  assert.equal(list.find((x) => x._id === p._id).available, false);
});
test("Insufficient or expired ingredients rollback product and order writes", async () => {
  const p = products[3];
  const recipe = await M.ProductRecipe.findOne({ product: p._id });
  const i = await M.Ingredient.findById(recipe.ingredients[0].ingredient);
  const stock = (await M.Product.findById(p._id)).stock;
  await M.Ingredient.updateOne({ _id: i._id }, { $set: { stock: 0 } });
  assert.equal(
    (await req("post", "/orders", customer, makeOrder(p))).status,
    409,
  );
  assert.equal((await M.Product.findById(p._id)).stock, stock);
  await M.Ingredient.updateOne(
    { _id: i._id },
    { $set: { stock: i.stock, expirationDate: new Date(0) } },
  );
  assert.equal(
    (await req("post", "/orders", customer, makeOrder(p))).status,
    409,
  );
  await M.Ingredient.updateOne(
    { _id: i._id },
    { $set: { expirationDate: null } },
  );
});
test("Collect pickup cash and advance through valid order statuses", async () => {
  const r = await req("post", "/orders", customer, makeOrder(products[5]));
  assert.equal(r.status, 201);
  for (const status of ["Confirmed", "Preparing", "Ready for Pickup"])
    assert.equal(
      (await req("put", "/orders/" + r.body._id + "/status", admin, { status }))
        .status,
      200,
    );
  assert.equal(
    (
      await req("put", "/orders/" + r.body._id + "/status", admin, {
        status: "Completed",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("post", "/payments/cash", admin, {
        order: r.body._id,
        amountReceived: 200,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("post", "/payments/cash", admin, {
        order: r.body._id,
        amountReceived: 200,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("put", "/orders/" + r.body._id + "/status", admin, {
        status: "Completed",
      })
    ).status,
    200,
  );
});
test("Product/category CRUD and recipe validation", async () => {
  const c = await req("post", "/categories", admin, { name: "Test category" });
  assert.equal(c.status, 201);
  assert.equal(
    (
      await req("put", "/categories/" + c.body._id, admin, {
        name: "Edited category",
      })
    ).status,
    200,
  );
  const body = {
    name: "Test pastry",
    description: "Test only",
    category: c.body._id,
    price: 50,
    image: "/hero.png",
    stock: 5,
  };
  const p = await req("post", "/products", admin, body);
  assert.equal(p.status, 201);
  assert.equal(
    (await req("put", "/products/" + p.body._id, admin, { ...body, price: 60 }))
      .body.price,
    60,
  );
  assert.equal(
    (await req("delete", "/categories/" + c.body._id, admin)).status,
    409,
  );
  assert.equal(
    (await req("delete", "/products/" + p.body._id, admin)).status,
    200,
  );
  assert.equal((await M.Product.findById(p.body._id)).available, false);
  const unused = await req("post", "/categories", admin, {
    name: "Unused category",
  });
  assert.equal(
    (await req("delete", "/categories/" + unused.body._id, admin)).status,
    200,
  );
  const ing = await M.Ingredient.findOne();
  assert.equal(
    (
      await req("put", "/recipes/" + p.body._id, admin, {
        ingredients: [{ ingredient: String(ing._id), quantity: 1 }],
      })
    ).status,
    200,
  );
});
test("Inventory adjustments have history, cannot go negative, reports aggregate", async () => {
  const r = await req("post", "/inventory", admin, {
    name: "Test ingredient",
    unit: "kg",
    stock: 5,
    minimumStock: 2,
  });
  assert.equal(r.status, 201);
  const adj = await req("post", "/inventory/" + r.body._id + "/adjust", admin, {
    delta: -4,
    reason: "Test use",
  });
  assert.equal(adj.body.stock, 1);
  assert.equal(
    (
      await req("post", "/inventory/" + r.body._id + "/adjust", admin, {
        delta: -2,
        reason: "Too much",
      })
    ).status,
    409,
  );
  assert.equal(
    (await req("get", "/inventory/history?ingredient=" + r.body._id, admin))
      .body.length,
    2,
  );
  assert.ok(
    (await req("get", "/reports/inventory", admin)).body.some(
      (i) => i._id === r.body._id,
    ),
  );
  assert.ok(
    (await req("get", "/reports/sales", admin)).body.summary.revenue > 0,
  );
  assert.ok((await req("get", "/reports/products", admin)).body.length > 0);
});
test("Cashier restrictions and user management", async () => {
  const r = await req("post", "/users", admin, {
    name: "Cashier Test",
    email: "cashier@test.local",
    username: "cashiertest",
    password: "Cashier-Test-1234",
    role: "cashier",
  });
  assert.equal(r.status, 201);
  const login = await req("post", "/auth/login", null, {
    login: "cashiertest",
    password: "Cashier-Test-1234",
  });
  const token = login.body.token;
  assert.equal((await req("get", "/orders", token)).status, 200);
  assert.equal((await req("get", "/inventory", token)).status, 200);
  assert.equal((await req("get", "/reports/sales", token)).status, 403);
  assert.equal((await req("post", "/inventory", token, {})).status, 403);
  assert.equal(
    (
      await req("put", "/users/" + r.body.id, admin, {
        role: "cashier",
        active: false,
      })
    ).status,
    200,
  );
  assert.equal((await req("get", "/orders", token)).status, 401);
});
test("Profile update, password change and logout invalidate JWTs", async () => {
  assert.equal(
    (
      await req("put", "/auth/profile", customer, {
        name: "Updated Name",
        phone: "09987654321",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("put", "/auth/password", customer, {
        currentPassword: "Customer-Test-123",
        password: "Changed-Test-1234",
        confirmPassword: "Changed-Test-1234",
      })
    ).status,
    200,
  );
  assert.equal((await req("get", "/auth/me", customer)).status, 401);
  const login = await req("post", "/auth/login", null, {
    login: "testcustomer",
    password: "Changed-Test-1234",
  });
  assert.equal(login.status, 200);
  assert.equal(
    (await req("post", "/auth/logout", login.body.token, {})).status,
    200,
  );
  assert.equal((await req("get", "/auth/me", login.body.token)).status, 401);
});

test("Expired or forged JWTs are rejected and database outages return a safe response", async () => {
  const jwt = await import("jsonwebtoken");
  const user = await M.User.findOne({ role: "admin" });
  const expired = jwt.default.sign(
    { sub: user.id, v: 0 },
    process.env.JWT_SECRET,
    { expiresIn: -1 },
  );
  assert.equal((await req("get", "/auth/me", expired)).status, 401);
  assert.equal((await req("get", "/auth/me", "not-a-valid-token")).status, 401);
  const state = mongoose.connection.readyState;
  mongoose.connection.readyState = 0;
  try {
    const health = await req("get", "/health");
    assert.equal(health.status, 503);
    const products = await req("get", "/products");
    assert.equal(products.status, 503);
    assert.equal(
      products.body.message,
      "Database unavailable. Please try again shortly.",
    );
    assert.equal(products.body.stack, undefined);
  } finally {
    mongoose.connection.readyState = state;
  }
});

test("Production entry point starts with environment configuration and serves health", async () => {
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, ["server.js"], {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env,
      PORT: "5051",
      MONGODB_URI: repl.getUri("amfaye_bites"),
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Server startup timed out: " + output)),
        15000,
      );
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.includes("Server running on port 5051")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        reject(new Error("Server exited " + code + ": " + output));
      });
    });
    const response = await fetch("http://127.0.0.1:5051/api/health");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
  } finally {
    child.kill("SIGTERM");
  }
});

test("Customer notifications persist for each order status and are owner-only", async () => {
  const login = await req("post", "/auth/login", null, {
    login: "testcustomer",
    password: "Changed-Test-1234",
  });
  const token = login.body.token;
  assert.equal(login.status, 200);
  assert.equal((await req("get", "/notifications")).status, 401);
  const body = makeOrder(products[1]);
  const placed = await req("post", "/orders", token, body);
  assert.equal(placed.status, 201);
  const orderId = placed.body._id;
  const retried = await req("post", "/orders", token, body);
  assert.equal(retried.body._id, orderId);
  assert.equal(await M.Notification.countDocuments({ order: orderId }), 1);
  for (const status of ["Confirmed", "Preparing", "Ready for Pickup"]) {
    assert.equal(
      (await req("put", `/orders/${orderId}/status`, admin, { status })).status,
      200,
    );
  }
  // Failed completion must never send a completion notification.
  assert.equal(
    (
      await req("put", `/orders/${orderId}/status`, admin, {
        status: "Completed",
      })
    ).status,
    400,
  );
  assert.equal(
    await M.Notification.countDocuments({
      order: orderId,
      status: "Completed",
    }),
    0,
  );
  const feed = await req("get", "/notifications", token);
  assert.equal(feed.status, 200);
  const notifications = feed.body.items.filter((n) => n.order === orderId);
  assert.deepEqual(
    notifications.map((n) => n.status).sort(),
    ["Confirmed", "Pending", "Preparing", "Ready for Pickup"].sort(),
  );
  const ready = notifications.find((n) => n.status === "Ready for Pickup");
  assert.match(ready.title, /ready for pickup/i);
  assert.equal(ready.orderNumber, placed.body.number);
  assert.equal(ready.readAt, null);
  // Query strings cannot override the authenticated owner.
  const foreign = await req("get", `/notifications?user=${ready.user}`, other);
  assert.ok(!foreign.body.items.some((n) => n.order === orderId));
  assert.equal(
    (await req("put", `/notifications/${ready._id}/read`, other, {})).status,
    404,
  );
  const marked = await req(
    "put",
    `/notifications/${ready._id}/read`,
    token,
    {},
  );
  assert.ok(marked.body.readAt);
  const again = await req("get", "/notifications", token);
  assert.equal(again.body.unreadCount, feed.body.unreadCount - 1);
  const through = again.body.items[0].createdAt;
  assert.equal(
    (await req("put", "/notifications/read-all", token, { through })).status,
    200,
  );
  assert.equal((await req("get", "/notifications", token)).body.unreadCount, 0);
  await req("post", "/payments/cash", admin, {
    order: orderId,
    amountReceived: 500,
  });
  assert.equal(
    (
      await req("put", `/orders/${orderId}/status`, admin, {
        status: "Completed",
      })
    ).status,
    200,
  );
  const final = await req("get", "/notifications", token);
  assert.equal(final.body.items[0].status, "Completed");
  assert.equal(final.body.unreadCount, 1);
  // An old read-all cutoff must not swallow a newer update.
  await req("put", "/notifications/read-all", token, { through });
  assert.equal((await req("get", "/notifications", token)).body.unreadCount, 1);
  const cancelledOrder = await req(
    "post",
    "/orders",
    token,
    makeOrder(products[1]),
  );
  await req("put", `/orders/${cancelledOrder.body._id}/status`, admin, {
    status: "Cancelled",
  });
  assert.ok(
    await M.Notification.exists({
      order: cancelledOrder.body._id,
      status: "Cancelled",
    }),
  );
  const before = await M.Notification.countDocuments();
  assert.equal(
    (await req("post", "/orders", token, makeOrder(products[4]))).status,
    409,
  );
  assert.equal(await M.Notification.countDocuments(), before);
  const pos = await req(
    "post",
    "/orders",
    admin,
    makeOrder(products[1], { source: "pos", amountReceived: 500 }),
  );
  assert.equal(pos.status, 201);
  assert.equal(await M.Notification.countDocuments({ order: pos.body._id }), 0);
});
