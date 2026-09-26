import mongoose from "mongoose";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import OrderGuard from "../models/OrderGuard.js";

function setting(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  // Invalid configuration cannot silently disable protection.
  return Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}
export function guardConfig() {
  return {
    accountLimit: setting("ORDER_ACCOUNT_LIMIT", 5, 1, 10000),
    ipLimit: setting("ORDER_IP_LIMIT", 20, 1, 100000),
    windowSeconds: setting("ORDER_WINDOW_SECONDS", 60, 10, 3600),
    blockSeconds: setting("ORDER_BLOCK_SECONDS", 300, 10, 86400),
  };
}
export function normalizeOrderIp(value) {
  const ip = String(value || "unknown").split("%")[0];
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) return "unknown";
  // Expand IPv6, including dotted-quad tails, to recognize all IPv4-mapped forms.
  let address = ip.toLowerCase();
  if (address.includes(".")) {
    const i = address.lastIndexOf(":");
    const q = address
      .slice(i + 1)
      .split(".")
      .map(Number);
    address =
      address.slice(0, i + 1) +
      ((q[0] << 8) | q[1]).toString(16) +
      ":" +
      ((q[2] << 8) | q[3]).toString(16);
  }
  const halves = address.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups = (
    halves.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left
  ).map((x) => parseInt(x, 16));
  if (groups.slice(0, 5).every((x) => x === 0) && groups[5] === 65535) {
    return [
      groups[6] >> 8,
      groups[6] & 255,
      groups[7] >> 8,
      groups[7] & 255,
    ].join(".");
  }
  // Aggregate IPv6 privacy addresses by /64 so rotating suffixes cannot bypass limits.
  return (
    groups
      .slice(0, 4)
      .map((x) => x.toString(16))
      .join(":") + "::/64"
  );
}
function identities(user, ip) {
  const secret = process.env.ORDER_GUARD_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("Order protection requires a server secret.");
  return [
    ["account", String(user._id)],
    ["ip", normalizeOrderIp(ip)],
  ].map(([scope, value]) => ({
    scope,
    _id: createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex"),
  }));
}
function blockedResult(documents, now) {
  const deadlines = documents
    .filter((d) => d?.blockedUntil && d.blockedUntil.getTime() > now)
    .map((d) => d.blockedUntil.getTime());
  const end = deadlines.length ? Math.max(...deadlines) : 0;
  return {
    blocked: end > now,
    blockedUntil: end ? new Date(end).toISOString() : null,
    retryAfter: end ? Math.ceil((end - now) / 1000) : 0,
  };
}
export async function getOrderGuardStatus(user, ip) {
  if (user.role !== "customer")
    return { blocked: false, blockedUntil: null, retryAfter: 0 };
  const keys = identities(user, ip);
  return blockedResult(
    await OrderGuard.find({ _id: { $in: keys.map((k) => k._id) } }).lean(),
    Date.now(),
  );
}
export async function consumeOrderAttempt(user, ip) {
  if (user.role !== "customer")
    return { blocked: false, blockedUntil: null, retryAfter: 0 };
  const keys = identities(user, ip);
  const config = guardConfig();
  // Pre-create deterministic documents outside the transaction; concurrent first requests
  // may race on the same key, but _id uniqueness ensures there is just one counter.
  for (const key of keys) {
    try {
      await OrderGuard.updateOne(
        { _id: key._id },
        {
          $setOnInsert: {
            scope: key.scope,
            attempts: 0,
            windowStartedAt: new Date(),
            blockedUntil: null,
            expiresAt: new Date(Date.now() + 86400000),
          },
        },
        { upsert: true },
      );
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  let result;
  // Both budgets are consumed atomically across all API instances. This transaction is
  // intentionally separate from checkout: even rejected/invalid orders count as attempts.
  await mongoose.connection.transaction(async (session) => {
    const now = Date.now();
    const documents = [];
    for (const key of keys) {
      const document = await OrderGuard.findById(key._id).session(session);
      if (!document)
        throw new Error("Order counter expired during request. Retry shortly.");
      documents.push(document);
    }
    result = blockedResult(documents, now);
    if (result.blocked) return; // Never extend a ban just because someone retries.
    for (const doc of documents) {
      const blockExpired =
        doc.blockedUntil && doc.blockedUntil.getTime() <= now;
      if (
        blockExpired ||
        now - doc.windowStartedAt.getTime() >= config.windowSeconds * 1000
      ) {
        doc.attempts = 0;
        doc.windowStartedAt = new Date(now);
        doc.blockedUntil = null;
      }
      doc.attempts += 1;
      const limit =
        doc.scope === "account" ? config.accountLimit : config.ipLimit;
      if (doc.attempts > limit)
        doc.blockedUntil = new Date(now + config.blockSeconds * 1000);
      doc.expiresAt = new Date(
        Math.max(
          now + config.windowSeconds * 1000,
          doc.blockedUntil?.getTime() || 0,
        ) + 86400000,
      );
      await doc.save({ session });
    }
    result = blockedResult(documents, now);
  });
  return result;
}
