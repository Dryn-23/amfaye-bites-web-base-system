import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../middleware/authMiddleware.js";
import { roles } from "../middleware/roleMiddleware.js";
import { wrap, id, fail } from "../utils/validators.js";
import { Product, Order, AuditLog } from "../models/index.js";
import Review from "../models/Review.js";
import Bucket from "../models/ReviewRateBucket.js";
const r = Router();
r.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const pageInput = z.coerce.number().int().min(1).max(10000).default(1);
const input = z.object({
  rating: z.number().int().min(1).max(5),
  text: z
    .string()
    .trim()
    .min(5, "Please write at least 5 characters.")
    .max(1000),
  displayName: z.string().trim().min(2).max(40),
});
const publicReview = (x) => ({
  _id: x._id,
  rating: x.rating,
  text: x.text,
  displayName: x.displayName,
  createdAt: x.createdAt,
  updatedAt: x.updatedAt,
  verifiedPurchase: true,
});
const ownReview = (x) =>
  x
    ? {
        ...publicReview(x),
        hidden: x.hidden,
        moderationReason: x.moderationReason,
      }
    : null;
const eligible = (product, user) =>
  Order.findOne({
    user: user._id,
    source: "web",
    status: "Completed",
    paymentStatus: "Paid",
    "items.product": product,
  })
    .select("_id")
    .sort({ createdAt: -1 });
async function productId(value) {
  const p = id.parse(value);
  if (!(await Product.exists({ _id: p })))
    throw fail(404, "Product not found.");
  return p;
}
const writes = wrap(async (req, res, next) => {
  const minute = Math.floor(Date.now() / 60000),
    key = `${req.user.id}:${minute}`;
  let bucket;
  try {
    bucket = await Bucket.findByIdAndUpdate(
      key,
      {
        $inc: { attempts: 1 },
        $setOnInsert: { expiresAt: new Date((minute + 3) * 60000) },
      },
      { upsert: true, new: true },
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
    bucket = await Bucket.findByIdAndUpdate(
      key,
      { $inc: { attempts: 1 } },
      { new: true },
    );
  }
  if (!bucket || bucket.attempts > 10) {
    const retryAfter = Math.max(
      1,
      Math.ceil(((minute + 1) * 60000 - Date.now()) / 1000),
    );
    res.set("Retry-After", String(retryAfter));
    return res
      .status(429)
      .json({
        code: "REVIEW_RATE_LIMIT",
        retryAfter,
        message: `Too many review updates. Please wait ${retryAfter} seconds.`,
      });
  }
  next();
});
r.get(
  "/summary",
  wrap(async (req, res) => {
    const items = await Review.aggregate([
      { $match: { hidden: false } },
      {
        $group: {
          _id: "$product",
          average: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);
    res.json(items);
  }),
);
r.get(
  "/admin",
  auth,
  roles("admin"),
  wrap(async (req, res) => {
    const q = z
      .object({
        page: pageInput,
        status: z.enum(["All", "Visible", "Hidden"]).default("All"),
      })
      .parse(req.query);
    const filter = q.status === "All" ? {} : { hidden: q.status === "Hidden" };
    const [items, total] = await Promise.all([
      Review.find(filter)
        .populate("product", "name")
        .sort({ createdAt: -1, _id: -1 })
        .skip((q.page - 1) * 20)
        .limit(20)
        .lean(),
      Review.countDocuments(filter),
    ]);
    res.json({
      items: items.map((x) => ({
        ...ownReview(x),
        product: x.product
          ? { _id: x.product._id, name: x.product.name }
          : null,
      })),
      total,
      page: q.page,
      pages: Math.max(1, Math.ceil(total / 20)),
    });
  }),
);
r.put(
  "/admin/:id",
  auth,
  roles("admin"),
  writes,
  wrap(async (req, res) => {
    const reviewId = id.parse(req.params.id);
    const data = z
      .object({
        hidden: z.boolean(),
        reason: z
          .string()
          .trim()
          .min(5, "Give a moderation reason (at least 5 characters).")
          .max(300),
      })
      .parse(req.body);
    let result;
    await mongoose.connection.transaction(async (session) => {
      const review = await Review.findById(reviewId).session(session);
      if (!review) throw fail(404, "Review not found.");
      review.hidden = data.hidden;
      review.moderationReason = data.reason;
      await review.save({ session });
      await AuditLog.create(
        [
          {
            actor: req.user._id,
            action: data.hidden ? "review.hide" : "review.restore",
            entity: "Review",
            entityId: review.id,
            details: { reason: data.reason },
          },
        ],
        { session },
      );
      result = ownReview(review);
    });
    res.json(result);
  }),
);
r.get(
  "/product/:product/mine",
  auth,
  roles("customer"),
  wrap(async (req, res) => {
    const p = await productId(req.params.product);
    const [order, review] = await Promise.all([
      eligible(p, req.user),
      Review.findOne({ product: p, customer: req.user._id }).lean(),
    ]);
    res.json({ eligible: !!order, review: ownReview(review) });
  }),
);
r.put(
  "/product/:product/mine",
  auth,
  roles("customer"),
  writes,
  wrap(async (req, res) => {
    const p = await productId(req.params.product);
    const data = input.parse(req.body);
    const order = await eligible(p, req.user);
    if (!order)
      throw fail(
        403,
        "Reviews require your own completed, paid online order containing this product.",
      );
    const filter = { product: p, customer: req.user._id };
    let review;
    try {
      review = await Review.findOneAndUpdate(
        filter,
        { $set: data, $setOnInsert: { order: order._id } },
        { upsert: true, new: true, runValidators: true },
      );
    } catch (e) {
      if (e.code !== 11000) throw e;
      review = await Review.findOneAndUpdate(
        filter,
        { $set: data },
        { new: true, runValidators: true },
      );
    }
    res.json(ownReview(review));
  }),
);
r.get(
  "/product/:product",
  wrap(async (req, res) => {
    const p = await productId(req.params.product);
    const page = pageInput.parse(req.query.page);
    const filter = { product: p, hidden: false };
    const [items, summary] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 10)
        .limit(10)
        .lean(),
      Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(p), hidden: false } },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
      ]),
    ]);
    const count = summary.reduce((n, x) => n + x.count, 0);
    res.json({
      items: items.map(publicReview),
      count,
      average: count
        ? summary.reduce((n, x) => n + x._id * x.count, 0) / count
        : 0,
      distribution: Object.fromEntries(summary.map((x) => [x._id, x.count])),
      page,
      pages: Math.max(1, Math.ceil(count / 10)),
    });
  }),
);
export default r;
