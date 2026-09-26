import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/authMiddleware.js";
import { staff } from "../middleware/roleMiddleware.js";
import { wrap } from "../utils/validators.js";
import { Order } from "../models/index.js";
const r = Router();
r.use(auth, staff);
r.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const page = z.coerce.number().int().min(1).max(10000).default(1);
const lanes = [
  ["confirmed", "Confirmed"],
  ["preparing", "Preparing"],
  ["ready", "Ready for Pickup"],
];
const projection = {
  _id: 1,
  number: 1,
  customerName: 1,
  status: 1,
  createdAt: 1,
  paymentMethod: 1,
  paymentStatus: 1,
  total: 1,
  notes: 1,
  "items.name": 1,
  "items.quantity": 1,
  "items.customization": 1,
};
r.get(
  "/",
  wrap(async (req, res) => {
    const query = z
      .object({
        q: z.string().trim().max(80).default(""),
        confirmedPage: page,
        preparingPage: page,
        readyPage: page,
      })
      .parse(req.query);
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const search = query.q
      ? {
          $or: [
            { number: { $regex: escaped, $options: "i" } },
            { customerName: { $regex: escaped, $options: "i" } },
          ],
        }
      : {};
    const facets = {
      pending: [{ $match: { status: "Pending" } }, { $count: "total" }],
    };
    for (const [key, status] of lanes) {
      const filter = { status, ...search };
      facets[key] = [
        { $match: filter },
        { $sort: { createdAt: 1, _id: 1 } },
        { $skip: (query[key + "Page"] - 1) * 8 },
        { $limit: 8 },
        { $project: projection },
      ];
      facets[key + "Count"] = [{ $match: filter }, { $count: "total" }];
    }
    const [result] = await Order.aggregate([
      {
        $match: {
          source: "web",
          status: { $in: ["Pending", ...lanes.map((x) => x[1])] },
        },
      },
      { $facet: facets },
    ]);
    res.json({
      serverTime: new Date().toISOString(),
      pendingCount: result.pending[0]?.total || 0,
      query: query.q,
      lanes: lanes.map(([key, status]) => {
        const total = result[key + "Count"][0]?.total || 0;
        return {
          key,
          status,
          items: result[key],
          total,
          page: query[key + "Page"],
          pages: Math.max(1, Math.ceil(total / 8)),
        };
      }),
    });
  }),
);
export default r;
