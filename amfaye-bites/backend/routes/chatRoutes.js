import imageRoutes from "./chatImageRoutes.js";
import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/authMiddleware.js";
import { roles } from "../middleware/roleMiddleware.js";
import { wrap, id } from "../utils/validators.js";
import { Order } from "../models/index.js";
import Conversation from "../models/ChatConversation.js";
import Message from "../models/ChatMessage.js";
import Bucket from "../models/ChatRateBucket.js";
import * as service from "../services/chatService.js";

const r = Router();
r.use(auth, roles("admin", "customer"));
r.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
// MongoDB-backed per-account write allowance survives service restarts and shares
// the budget across instances. It does not reuse or extend the order cooldown.
const writes = wrap(async (req, res, next) => {
  const configured = Number(process.env.CHAT_WRITES_PER_MINUTE || 30);
  const limit =
    Number.isInteger(configured) && configured >= 5 && configured <= 1200
      ? configured
      : 30;
  const now = Date.now(),
    bucket = Math.floor(now / 60000);
  const key = `${req.user.id}:${bucket}`;
  const change = {
    $inc: { attempts: 1 },
    $setOnInsert: { expiresAt: new Date((bucket + 3) * 60000) },
  };
  let result;
  try {
    result = await Bucket.findByIdAndUpdate(key, change, {
      upsert: true,
      new: true,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    result = await Bucket.findByIdAndUpdate(
      key,
      { $inc: { attempts: 1 } },
      { new: true },
    );
  }
  if (!result || result.attempts > limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil(((bucket + 1) * 60000 - now) / 1000),
    );
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      code: "CHAT_RATE_LIMIT",
      retryAfter,
      message: `You're sending chat updates too quickly. Please wait ${retryAfter} seconds.`,
    });
  }
  next();
});
r.get(
  "/unread",
  wrap(async (req, res) => {
    const field =
      req.user.role === "admin" ? "$adminUnread" : "$customerUnread";
    const [summary] = await Conversation.aggregate([
      { $match: service.ownerFilter(req.user) },
      { $group: { _id: null, unreadCount: { $sum: field } } },
    ]);
    res.json({ unreadCount: summary?.unreadCount || 0 });
  }),
);
r.get(
  "/",
  wrap(async (req, res) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        status: z.enum(["All", "Open", "Closed"]).default("All"),
        q: z.string().trim().max(80).default(""),
      })
      .parse(req.query);
    const filter = { ...service.ownerFilter(req.user) };
    if (query.status !== "All") filter.status = query.status;
    if (query.q) {
      const regex = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { orderNumber: { $regex: regex, $options: "i" } },
        { customerName: { $regex: regex, $options: "i" } },
      ];
    }
    const [items, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ lastMessageAt: -1, _id: -1 })
        .skip((query.page - 1) * 30)
        .limit(30)
        .lean(),
      Conversation.countDocuments(filter),
    ]);
    res.json({
      items: items.map((c) => service.safeConversation(c, req.user)),
      total,
      page: query.page,
      pages: Math.max(1, Math.ceil(total / 30)),
    });
  }),
);
r.post(
  "/",
  writes,
  wrap(async (req, res) => {
    const { order } = z.object({ order: id }).parse(req.body);
    res.status(201).json(await service.startConversation(order, req.user));
  }),
);
r.get(
  "/:id/messages",
  wrap(async (req, res) => {
    const query = z
      .object({
        before: z.coerce.number().int().min(1).optional(),
        after: z.coerce.number().int().min(0).optional(),
      })
      .refine((q) => !(q.before !== undefined && q.after !== undefined), {
        message: "Use before or after, not both.",
      })
      .parse(req.query);
    const c = await service.ownedConversation(req.params.id, req.user);
    const sequence = { $lte: c.lastSequence };
    if (query.before !== undefined) sequence.$lt = query.before;
    if (query.after !== undefined) sequence.$gt = query.after;
    const ascending = query.after !== undefined;
    const rows = await Message.find({ conversation: c._id, sequence })
      .sort({ sequence: ascending ? 1 : -1 })
      .limit(51)
      .lean();
    const hasMore = rows.length > 50;
    const messages = rows.slice(0, 50);
    if (!ascending) messages.reverse();
    const order = await Order.findById(c.order)
      .select("number status total paymentStatus source")
      .lean();
    res.json({
      conversation: service.safeConversation(c, req.user),
      order,
      messages,
      hasMore,
    });
  }),
);
r.post(
  "/:id/messages",
  writes,
  wrap(async (req, res) =>
    res
      .status(201)
      .json(
        await service.sendMessage(id.parse(req.params.id), req.body, req.user),
      ),
  ),
);
r.put(
  "/:id/read",
  wrap(async (req, res) => {
    const { through } = z
      .object({ through: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) })
      .parse(req.body);
    res.json(
      await service.markRead(id.parse(req.params.id), through, req.user),
    );
  }),
);
r.put(
  "/:id/status",
  writes,
  wrap(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["Open", "Closed"]) })
      .parse(req.body);
    res.json(
      await service.setStatus(id.parse(req.params.id), status, req.user),
    );
  }),
);
r.use(imageRoutes(writes));
export default r;
