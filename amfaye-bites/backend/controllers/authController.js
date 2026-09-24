import { z } from "zod";
import mongoose from "mongoose";
import { User, CustomerProfile, Role, AuditLog } from "../models/index.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { fail } from "../utils/validators.js";
const safe = (u) => ({
  id: u.id,
  _id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  username: u.username,
  role: u.role,
  active: u.active,
});
const password = z.string().min(8).max(72);
export async function register(req, res) {
  const d = z
    .object({
      name: z.string().trim().min(2).max(100),
      email: z
        .string()
        .email()
        .max(150)
        .transform((v) => v.toLowerCase()),
      phone: z.string().regex(/^09\d{9}$/, "Use an 11-digit PH mobile number"),
      username: z
        .string()
        .regex(/^[a-zA-Z0-9_]{3,30}$/)
        .transform((v) => v.toLowerCase()),
      password,
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: "Passwords do not match",
    })
    .parse(req.body);
  const passwordHash = await hashPassword(d.password);
  let user;
  await mongoose.connection.transaction(async (session) => {
    const role = await Role.findOne({ name: "customer" }).session(session);
    [user] = await User.create(
      [
        {
          name: d.name,
          email: d.email,
          phone: d.phone,
          username: d.username,
          passwordHash,
          role: "customer",
          roleRef: role?._id,
        },
      ],
      { session },
    );
    await CustomerProfile.create([{ user: user._id }], { session });
  });
  res.status(201).json({ user: safe(user), token: signToken(user) });
}
export async function login(req, res) {
  const d = z
    .object({
      login: z.string().min(1).max(150),
      password: z.string().min(1).max(72),
    })
    .parse(req.body);
  const login = d.login.toLowerCase().trim();
  const user = await User.findOne({
    $or: [{ email: login }, { username: login }],
  }).select("+passwordHash +tokenVersion");
  if (
    !user ||
    !user.active ||
    !(await verifyPassword(d.password, user.passwordHash))
  )
    throw fail(401, "Incorrect email, username or password.");
  res.json({ user: safe(user), token: signToken(user) });
}
export async function me(req, res) {
  res.json(safe(req.user));
}
export async function logout(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.json({ message: "Signed out successfully." });
}
export async function profile(req, res) {
  const d = z
    .object({
      name: z.string().trim().min(2).max(100),
      phone: z.string().regex(/^09\d{9}$/),
    })
    .parse(req.body);
  res.json(
    safe(
      await User.findByIdAndUpdate(
        req.user.id,
        { $set: d },
        { new: true, runValidators: true },
      ),
    ),
  );
}
export async function changePassword(req, res) {
  const d = z
    .object({
      currentPassword: z.string(),
      password,
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: "Passwords do not match",
    })
    .parse(req.body);
  const u = await User.findById(req.user.id).select("+passwordHash");
  if (!(await verifyPassword(d.currentPassword, u.passwordHash)))
    throw fail(400, "Current password is incorrect.");
  u.passwordHash = await hashPassword(d.password);
  u.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await u.save();
  res.json({ message: "Password changed. Please sign in again." });
}
