import { Router } from "express";
import { z } from "zod";
import Notification from "../models/Notification.js";
import { auth } from "../middleware/authMiddleware.js";
import { fail, id, wrap } from "../utils/validators.js";

const router = Router();
router.use(auth);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.get(
  "/",
  wrap(async (req, res) => {
    const [items, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id })
        .sort({ createdAt: -1, _id: -1 })
        .limit(50)
        .lean(),
      Notification.countDocuments({ user: req.user._id, readAt: null }),
    ]);
    res.json({ items, unreadCount });
  }),
);
router.put(
  "/read-all",
  wrap(async (req, res) => {
    // Mark only up to the newest notification the client actually displayed.
    // A notification arriving while the menu is open remains unread.
    const { through } = z
      .object({ through: z.string().datetime() })
      .parse(req.body);
    await Notification.updateMany(
      {
        user: req.user._id,
        readAt: null,
        createdAt: { $lte: new Date(through) },
      },
      { $set: { readAt: new Date() } },
    );
    res.json({ message: "Notifications marked as read." });
  }),
);
router.put(
  "/:id/read",
  wrap(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: id.parse(req.params.id), user: req.user._id },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!notification) throw fail(404, "Notification not found.");
    res.json(notification);
  }),
);
export default router;
