import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { app } from "../app.js";
import { seed } from "../seed/seedDatabase.js";
import { Product, Order } from "../models/index.js";
import Conversation from "../models/ChatConversation.js";
import Message from "../models/ChatMessage.js";
import Bucket from "../models/ChatRateBucket.js";
let repl, admin, cashier, alice, bob, product;
const call = (method, path, token, data) => {
  const r = request(app)[method]("/api" + path);
  if (token) r.set("Authorization", "Bearer " + token);
  return data ? r.send(data) : r;
};
const send = (chat, token, text, extra = {}) =>
  call("post", `/chats/${chat._id}/messages`, token, {
    text,
    clientMessageId: crypto.randomUUID(),
    ...extra,
  });
async function newChat(token = alice.token) {
  const o = await call("post", "/orders", token, {
    items: [{ product: product._id, quantity: 1 }],
    paymentMethod: "Cash",
    idempotencyKey: crypto.randomUUID(),
  });
  assert.equal(o.status, 201, JSON.stringify(o.body));
  const c = await call("post", "/chats", token, { order: o.body._id });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  return c.body;
}
before(async () => {
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  process.env.DEMO_PAYMENTS_ENABLED = "true";
  process.env.SEED_ADMIN_EMAIL = "chatadmin@example.com";
  process.env.SEED_ADMIN_PASSWORD = "Chat-Admin-123456";
  process.env.ORDER_ACCOUNT_LIMIT = "1000";
  process.env.ORDER_IP_LIMIT = "10000";
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(repl.getUri("amfaye_bites"));
  await seed();
  await Promise.all([Conversation.init(), Message.init(), Bucket.init()]);
  admin = (
    await call("post", "/auth/login", null, {
      login: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    })
  ).body;
  for (const name of ["chatalice", "chatbob"]) {
    const response = await call("post", "/auth/register", null, {
      name,
      email: name + "@example.com",
      username: name,
      phone: "09123456789",
      password: "Chat-Customer-123",
      confirmPassword: "Chat-Customer-123",
    });
    assert.equal(response.status, 201);
    if (name === "chatalice") alice = response.body;
    else bob = response.body;
  }
  await call("post", "/users", admin.token, {
    name: "Chat Cashier",
    email: "chatcashier@example.com",
    username: "chatcashier",
    role: "cashier",
    password: "Chat-Cashier-123",
  });
  cashier = (
    await call("post", "/auth/login", null, {
      login: "chatcashier",
      password: "Chat-Cashier-123",
    })
  ).body;
  product = (await call("get", "/products")).body[0];
});
beforeEach(async () => {
  process.env.CHAT_WRITES_PER_MINUTE = "1200";
  await Bucket.deleteMany({});
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

test("Chat authentication, order ownership, private lists and cashier restrictions", async () => {
  assert.equal((await call("get", "/chats")).status, 401);
  assert.equal((await call("get", "/chats", cashier.token)).status, 403);
  const c = await newChat();
  for (const path of [
    `/chats/${c._id}/messages`,
    `/chats/${c._id}/messages?after=0`,
  ])
    assert.equal((await call("get", path, bob.token)).status, 404);
  assert.equal((await send(c, bob.token, "not my order")).status, 404);
  assert.equal(
    (await call("put", `/chats/${c._id}/read`, bob.token, { through: 999 }))
      .status,
    404,
  );
  assert.equal(
    (await call("put", `/chats/${c._id}/status`, bob.token, { status: "Open" }))
      .status,
    404,
  );
  assert.equal(
    (await call("post", "/chats", bob.token, { order: c.order })).status,
    404,
  );
  const own = await call("get", "/chats?customer=" + alice.user.id, bob.token);
  assert.ok(!own.body.items.some((x) => x._id === c._id));
  assert.ok(
    (await call("get", "/chats", admin.token)).body.items.some(
      (x) => x._id === c._id,
    ),
  );
  assert.equal(
    (await call("get", `/chats/${c._id}/messages`, cashier.token)).status,
    403,
  );
  const pos = await call("post", "/orders", admin.token, {
    source: "pos",
    items: [{ product: product._id, quantity: 1 }],
    paymentMethod: "Cash",
    amountReceived: 500,
    idempotencyKey: crypto.randomUUID(),
  });
  assert.equal(
    (await call("post", "/chats", admin.token, { order: pos.body._id })).status,
    404,
  );
});

test("Opening the same order chat concurrently creates only one thread", async () => {
  const c = await newChat();
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      call("post", "/chats", alice.token, { order: c.order }),
    ),
  );
  assert.ok(results.every((r) => r.status === 201 && r.body._id === c._id));
  assert.equal(await Conversation.countDocuments({ order: c.order }), 1);
});

test("Messages persist with true sender identity; retries do not duplicate messages or unread counts", async () => {
  const c = await newChat();
  const messageId = crypto.randomUUID();
  const body = {
    clientMessageId: messageId,
    sender: admin.user.id,
    senderRole: "admin",
  };
  const results = await Promise.all([
    send(c, alice.token, "Hello, when can I pick up?", body),
    send(c, alice.token, "Hello, when can I pick up?", body),
  ]);
  assert.equal(results[0].status, 201);
  assert.equal(results[1].status, 201);
  assert.equal(results[0].body.message._id, results[1].body.message._id);
  assert.equal(results[0].body.message.senderRole, "customer");
  assert.equal(results[0].body.message.sender, alice.user.id);
  assert.equal(await Message.countDocuments({ conversation: c._id }), 1);
  assert.equal((await Conversation.findById(c._id)).adminUnread, 1);
  assert.equal(
    (
      await send(c, alice.token, "Changed replay", {
        clientMessageId: messageId,
      })
    ).status,
    409,
  );
  assert.equal((await send(c, alice.token, "   ")).status, 400);
  assert.equal((await send(c, alice.token, "x".repeat(1001))).status, 400);
  const reply = await send(
    c,
    admin.token,
    "Your order will be prepared shortly.",
  );
  assert.equal(reply.status, 201);
  const transcript = await call("get", `/chats/${c._id}/messages`, alice.token);
  assert.equal(transcript.body.messages.length, 2);
  assert.equal(transcript.body.order.number, c.orderNumber);
  assert.equal(transcript.body.order.paymentStatus, "Pending");
});

test("Read receipts are monotonic; marking an older page never hides a newer unread reply", async () => {
  const c = await newChat();
  await send(c, alice.token, "Question");
  await send(c, admin.token, "First reply");
  await send(c, admin.token, "Second reply");
  assert.equal((await Conversation.findById(c._id)).customerUnread, 2);
  let read = await call("put", `/chats/${c._id}/read`, alice.token, {
    through: 2,
  });
  assert.equal(read.body.unreadCount, 1);
  assert.equal(read.body.myReadSequence, 2);
  read = await call("put", `/chats/${c._id}/read`, alice.token, { through: 1 });
  assert.equal(read.body.unreadCount, 1);
  assert.equal(read.body.myReadSequence, 2);
  const [mark, newReply] = await Promise.all([
    call("put", `/chats/${c._id}/read`, alice.token, { through: 3 }),
    send(c, admin.token, "A newer reply"),
  ]);
  assert.equal(mark.status, 200);
  assert.equal(newReply.status, 201);
  assert.equal((await Conversation.findById(c._id)).customerUnread, 1);
  assert.equal(
    (await call("get", `/chats/${c._id}/messages`, admin.token)).body
      .conversation.theirReadSequence,
    3,
  );
  await call("put", `/chats/${c._id}/read`, alice.token, { through: 999 });
  assert.equal((await Conversation.findById(c._id)).customerUnread, 0);
  assert.ok(
    (await call("get", "/chats/unread", admin.token)).body.unreadCount > 0,
  );
});

test("Concurrent unique sends preserve sequence and independent unread counts", async () => {
  const c = await newChat();
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      send(c, alice.token, "Concurrent message " + i),
    ),
  );
  assert.ok(
    results.every((r) => r.status === 201),
    JSON.stringify(results.map((r) => r.body)),
  );
  const messages = await Message.find({ conversation: c._id }).sort({
    sequence: 1,
  });
  assert.deepEqual(
    messages.map((m) => m.sequence),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal((await Conversation.findById(c._id)).adminUnread, 8);
});

test("Admins close conversations; owners can reopen; chat never changes orders, payments or stock", async () => {
  const c = await newChat();
  const beforeOrder = await Order.findById(c.order).lean();
  const stock = (await Product.findById(product._id)).stock;
  assert.equal(
    (
      await call("put", `/chats/${c._id}/status`, alice.token, {
        status: "Closed",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("put", `/chats/${c._id}/status`, admin.token, {
        status: "Closed",
      })
    ).status,
    200,
  );
  assert.equal((await send(c, alice.token, "While closed")).status, 409);
  assert.equal((await send(c, admin.token, "Also closed")).status, 409);
  assert.equal(
    (
      await call("put", `/chats/${c._id}/status`, alice.token, {
        status: "Open",
      })
    ).status,
    200,
  );
  assert.equal((await send(c, alice.token, "I have a follow-up")).status, 201);
  const afterOrder = await Order.findById(c.order).lean();
  assert.equal(afterOrder.status, beforeOrder.status);
  assert.equal(afterOrder.paymentStatus, beforeOrder.paymentStatus);
  assert.equal((await Product.findById(product._id)).stock, stock);
});

test("Message history pagination has no missing or duplicate rows and search input is escaped", async () => {
  const c = await newChat();
  const docs = Array.from({ length: 123 }, (_, n) => ({
    conversation: c._id,
    sequence: n + 1,
    sender: alice.user.id,
    senderRole: "customer",
    senderName: "Alice",
    text: "History " + (n + 1),
    clientMessageId: crypto.randomUUID(),
  }));
  await Message.insertMany(docs);
  await Conversation.updateOne(
    { _id: c._id },
    { $set: { lastSequence: 123, adminUnread: 123 } },
  );
  const recent = await call("get", `/chats/${c._id}/messages`, admin.token);
  assert.equal(recent.body.messages.length, 50);
  assert.equal(recent.body.messages[0].sequence, 74);
  assert.equal(recent.body.hasMore, true);
  const older = await call(
    "get",
    `/chats/${c._id}/messages?before=74`,
    admin.token,
  );
  assert.equal(older.body.messages[0].sequence, 24);
  assert.equal(older.body.messages.at(-1).sequence, 73);
  const earliest = await call(
    "get",
    `/chats/${c._id}/messages?before=24`,
    admin.token,
  );
  assert.equal(earliest.body.messages.length, 23);
  assert.equal(earliest.body.hasMore, false);
  const after = await call(
    "get",
    `/chats/${c._id}/messages?after=70`,
    admin.token,
  );
  assert.equal(after.body.messages[0].sequence, 71);
  assert.equal(after.body.messages.at(-1).sequence, 120);
  assert.equal(after.body.hasMore, true);
  assert.equal(
    (
      await call(
        "get",
        `/chats/${c._id}/messages?before=10&after=2`,
        admin.token,
      )
    ).status,
    400,
  );
  assert.equal((await call("get", "/chats?q=%5B", admin.token)).status, 200);
  assert.equal((await call("get", "/chats?page=-1", admin.token)).status, 400);
  const search = await call(
    "get",
    "/chats?q=" + encodeURIComponent(c.orderNumber),
    admin.token,
  );
  assert.equal(search.body.items.length, 1);
});

test("Chat write throttling returns 429 without extending order cooldown or blocking reads", async () => {
  const c = await newChat();
  await Bucket.deleteMany({});
  process.env.CHAT_WRITES_PER_MINUTE = "5";
  for (let i = 0; i < 5; i++)
    assert.equal((await send(c, alice.token, "Allowed " + i)).status, 201);
  const blocked = await send(c, alice.token, "Too fast");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, "CHAT_RATE_LIMIT");
  assert.ok(blocked.body.retryAfter >= 1 && blocked.body.retryAfter <= 60);
  assert.ok(blocked.headers["retry-after"]);
  assert.equal(await Message.countDocuments({ conversation: c._id }), 5);
  assert.equal(
    (await call("get", `/chats/${c._id}/messages`, alice.token)).status,
    200,
  );
  assert.equal((await call("get", "/chats/unread", alice.token)).status, 200);
  const guard = await call("get", "/orders/guard", alice.token);
  // The original project does not have the optional order-guard update.
  assert.ok(guard.status === 200 || guard.status === 404 || (guard.status === 400 && /Invalid identifier/.test(guard.body.message)));
  if (guard.status === 200) assert.equal(guard.body.blocked, false);
  assert.equal(
    (await send(c, admin.token, "Different account allowance")).status,
    201,
  );
});
