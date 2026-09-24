import { Router } from "express";
import { z } from "zod";
import { User, Role, AuditLog } from "../models/index.js";
import { hashPassword } from "../utils/password.js";
import { auth } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/roleMiddleware.js";
import { wrap, fail, id } from "../utils/validators.js";
const r = Router();
r.use(auth, admin);
r.get(
  "/",
  wrap(async (req, res) =>
    res.json(await User.find().sort({ createdAt: -1 }).limit(500)),
  ),
);
r.post(
  "/",
  wrap(async (req, res) => {
    const d = z
      .object({
        name: z.string().min(2).max(100),
        email: z
          .string()
          .email()
          .transform((s) => s.toLowerCase()),
        username: z
          .string()
          .regex(/^[a-zA-Z0-9_]{3,30}$/)
          .transform((s) => s.toLowerCase()),
        password: z.string().min(8).max(72),
        role: z.enum(["admin", "cashier", "customer"]),
      })
      .parse(req.body);
    const role = await Role.findOne({ name: d.role });
    const u = await User.create({
      ...d,
      passwordHash: await hashPassword(d.password),
      roleRef: role?._id,
    });
    res.status(201).json({ id: u.id, name: u.name, role: u.role });
  }),
);
r.put(
  "/:id",
  wrap(async (req, res) => {
    const _id = id.parse(req.params.id);
    if (_id === req.user.id)
      throw fail(400, "You cannot change your own permissions.");
    const d = z
      .object({
        role: z.enum(["admin", "cashier", "customer"]),
        active: z.boolean(),
      })
      .parse(req.body);
    const role = await Role.findOne({ name: d.role });
    const u = await User.findByIdAndUpdate(
      _id,
      { $set: { ...d, roleRef: role?._id }, $inc: { tokenVersion: 1 } },
      { new: true, runValidators: true },
    );
    if (!u) throw fail(404, "User not found.");
    await AuditLog.create({
      actor: req.user._id,
      action: "user.permissions.updated",
      entityId: _id,
      details: d,
    });
    res.json(u);
  }),
);
export default r;
