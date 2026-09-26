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

import sharp from "sharp";
import Asset from "../models/ChatImageAsset.js";
import Quota from "../models/ChatImageQuota.js";
import {
  storageLimit,
  cleanupExpired,
  discardPending,
  storeImage,
  normalizeImage,
  bucket,
} from "../services/chatImageService.js";
let png, jpeg;
before(async () => {
  await Promise.all([Asset.init(), Quota.init()]);
  png = await sharp({
    create: { width: 120, height: 80, channels: 3, background: "#a56b3e" },
  })
    .png()
    .toBuffer();
  jpeg = await sharp({
    create: { width: 40, height: 20, channels: 3, background: "#d0ad65" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
});
beforeEach(async () => {
  await Promise.all([
    Asset.deleteMany({}),
    Quota.deleteMany({}),
    mongoose.connection.db.collection("chatImages.files").deleteMany({}),
    mongoose.connection.db.collection("chatImages.chunks").deleteMany({}),
  ]);
});
function upload(
  c,
  token = alice.token,
  {
    buffer = png,
    mime = "image/png",
    text = "",
    key = crypto.randomUUID(),
  } = {},
) {
  const r = request(app).post("/api/chats/" + c._id + "/image-messages");
  if (token) r.set("Authorization", "Bearer " + token);
  return r
    .field("text", text)
    .field("clientMessageId", key)
    .attach("image", buffer, {
      filename: "private-original-name.png",
      contentType: mime,
    });
}
const imagePath = (c, m) => `/chats/${c._id}/messages/${m._id}/image`;
test("Image-only and caption messages persist in GridFS, with correct unread and sequence metadata", async () => {
  const c = await newChat();
  const r = await upload(c);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.message.text, "");
  assert.equal(r.body.message.attachment.mime, "image/jpeg");
  assert.equal(r.body.message.attachment.width, 120);
  assert.equal(r.body.conversation.lastMessage, "📷 Image");
  const asset = await Asset.findById(r.body.message.attachment.file);
  assert.equal(asset.state, "attached");
  assert.equal((await Conversation.findById(c._id)).adminUnread, 1);
  const second = await upload(c, admin.token, {
    text: "Here is your packed order.",
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.message.sequence, 2);
  assert.equal(
    second.body.conversation.lastMessage,
    "📷 Image: Here is your packed order.",
  );
  const page = await call("get", `/chats/${c._id}/messages`, alice.token);
  assert.equal(page.body.messages.length, 2);
  assert.ok(page.body.messages.every((m) => m.attachment));
  const bytes = await call("get", imagePath(c, r.body.message), admin.token);
  assert.equal(bytes.status, 200);
  assert.equal(bytes.headers["content-type"], "image/jpeg");
  assert.equal(bytes.headers["cache-control"], "private, no-store");
  assert.equal(bytes.headers["x-content-type-options"], "nosniff");
  assert.equal((await sharp(bytes.body).metadata()).format, "jpeg");
  const all = await Asset.find();
  assert.equal(
    (await Quota.findById("chat-images")).bytes,
    all.reduce((n, a) => n + a.bytes, 0),
  );
});
test("Private upload/download routes reject guests, nonowners, cashiers and cross-conversation image IDs", async () => {
  const c = await newChat();
  assert.equal((await upload(c, null)).status, 401);
  assert.equal((await upload(c, bob.token)).status, 404);
  assert.equal((await upload(c, cashier.token)).status, 403);
  assert.equal(await Asset.countDocuments(), 0);
  const m = (await upload(c)).body.message;
  assert.equal((await call("get", imagePath(c, m))).status, 401);
  assert.equal((await call("get", imagePath(c, m), bob.token)).status, 404);
  assert.equal((await call("get", imagePath(c, m), cashier.token)).status, 403);
  const other = await newChat(bob.token);
  assert.equal((await call("get", imagePath(other, m), bob.token)).status, 404);
});
test("Server decodes, reorients and strips EXIF from accepted JPEG/PNG/WebP images", async () => {
  const c = await newChat();
  const r = await upload(c, alice.token, { buffer: jpeg, mime: "image/jpeg" });
  assert.equal(r.status, 201);
  assert.equal(r.body.message.attachment.width, 20);
  assert.equal(r.body.message.attachment.height, 40);
  const response = await call("get", imagePath(c, r.body.message), alice.token);
  const info = await sharp(response.body).metadata();
  assert.equal(info.exif, undefined);
  assert.equal(info.orientation, undefined);
  const webp = await sharp(png).webp().toBuffer();
  assert.equal(
    (await upload(c, alice.token, { buffer: webp, mime: "image/webp" })).status,
    201,
  );
  const file = await mongoose.connection.db
    .collection("chatImages.files")
    .findOne({
      _id: new mongoose.Types.ObjectId(r.body.message.attachment.file),
    });
  assert.equal(file.filename, "chat-image.jpg");
});
test("Spoofed, unsupported, corrupt, oversized and excessive-pixel inputs fail without storing files", async () => {
  const c = await newChat();
  for (const [buffer, mime] of [
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/png"],
    [png, "image/jpeg"],
    [Buffer.from("not an image"), "image/png"],
    [png, "image/svg+xml"],
    [Buffer.from([255, 216, 255, 0]), "image/jpeg"],
  ])
    assert.equal((await upload(c, alice.token, { buffer, mime })).status, 400);
  assert.equal(
    (
      await upload(c, alice.token, {
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      })
    ).status,
    413,
  );
  const giant = await sharp({
    create: { width: 5000, height: 4000, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  assert.equal((await upload(c, alice.token, { buffer: giant })).status, 400);
  const missing = await call(
    "post",
    `/chats/${c._id}/image-messages`,
    alice.token,
    { text: "none", clientMessageId: crypto.randomUUID() },
  );
  assert.equal(missing.status, 400);
  assert.equal(await Asset.countDocuments(), 0);
  assert.equal(
    await mongoose.connection.db
      .collection("chatImages.files")
      .countDocuments(),
    0,
  );
});
test("Image retries and concurrent duplicates produce one message, one stored file and one unread increment", async () => {
  const c = await newChat(),
    key = crypto.randomUUID();
  const rs = await Promise.all([
    upload(c, alice.token, { key }),
    upload(c, alice.token, { key }),
  ]);
  assert.ok(
    rs.every((r) => r.status === 201),
    JSON.stringify(rs.map((r) => r.body)),
  );
  assert.equal(rs[0].body.message._id, rs[1].body.message._id);
  assert.equal(await Message.countDocuments({ conversation: c._id }), 1);
  assert.equal(await Asset.countDocuments(), 1);
  assert.equal(
    await mongoose.connection.db
      .collection("chatImages.files")
      .countDocuments(),
    1,
  );
  assert.equal((await Conversation.findById(c._id)).adminUnread, 1);
  const retry = await upload(c, alice.token, { key });
  assert.equal(retry.status, 201);
  assert.equal(retry.body.message._id, rs[0].body.message._id);
  assert.equal(
    (await upload(c, alice.token, { key, text: "Changed caption" })).status,
    409,
  );
  assert.equal(
    (await upload(c, alice.token, { key, buffer: jpeg, mime: "image/jpeg" }))
      .status,
    409,
  );
  const quota = await Quota.findById("chat-images");
  assert.equal(quota.bytes, rs[0].body.message.attachment.bytes);
});
test("Closed conversations roll back temporary uploads; client JSON cannot inject an attachment", async () => {
  const c = await newChat();
  await call("put", `/chats/${c._id}/status`, admin.token, {
    status: "Closed",
  });
  assert.equal((await upload(c)).status, 409);
  assert.equal(await Asset.countDocuments(), 0);
  assert.equal(
    await mongoose.connection.db
      .collection("chatImages.files")
      .countDocuments(),
    0,
  );
  assert.equal((await Quota.findById("chat-images")).bytes, 0);
  await call("put", `/chats/${c._id}/status`, admin.token, { status: "Open" });
  const r = await call("post", `/chats/${c._id}/messages`, alice.token, {
    text: "Text is still supported",
    clientMessageId: crypto.randomUUID(),
    attachment: { file: new mongoose.Types.ObjectId(), mime: "image/jpeg" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.message.attachment, undefined);
});
test("Shared storage budget fails safely without files, messages or stock/order/payment changes", async () => {
  const c = await newChat();
  const stock = (await Product.findById(product._id)).stock;
  const order = await Order.findById(c.order);
  await Quota.create({ _id: "chat-images", bytes: storageLimit() });
  const r = await upload(c);
  assert.equal(r.status, 507);
  assert.equal(await Asset.countDocuments(), 0);
  assert.equal(await Message.countDocuments({ conversation: c._id }), 0);
  assert.equal((await Product.findById(product._id)).stock, stock);
  const after = await Order.findById(c.order);
  assert.equal(after.status, order.status);
  assert.equal(after.paymentStatus, order.paymentStatus);
});
test("Cleanup removes stale unfinished GridFS files/chunks and releases quota, never committed images", async () => {
  const c = await newChat();
  const valid = (await upload(c)).body.message;
  const image = await normalizeImage({
    buffer: png,
    size: png.length,
    mimetype: "image/png",
  });
  const pending = await storeImage(image, c._id, { _id: alice.user.id });
  await Asset.updateOne(
    { _id: pending.file },
    { $set: { expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
  );
  assert.equal(await cleanupExpired(), 1);
  assert.equal(await cleanupExpired(), 0);
  assert.equal(await discardPending(valid.attachment.file), false);
  assert.equal(
    (await Quota.findById("chat-images")).bytes,
    valid.attachment.bytes,
  );
  assert.equal(
    await mongoose.connection.db
      .collection("chatImages.chunks")
      .countDocuments({ files_id: pending.file }),
    0,
  );
  assert.equal(
    (await call("get", imagePath(c, valid), alice.token)).status,
    200,
  );
});
test("Image uploads consume the existing persistent chat write allowance", async () => {
  const c = await newChat();
  await Bucket.deleteMany({});
  process.env.CHAT_WRITES_PER_MINUTE = "5";
  for (let i = 0; i < 5; i++) assert.equal((await upload(c)).status, 201);
  const blocked = await upload(c);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, "CHAT_RATE_LIMIT");
  assert.ok(blocked.headers["retry-after"]);
  assert.equal(await Asset.countDocuments(), 5);
});
