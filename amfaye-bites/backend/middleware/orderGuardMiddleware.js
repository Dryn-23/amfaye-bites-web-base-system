import {
  consumeOrderAttempt,
  getOrderGuardStatus,
} from "../services/orderGuardService.js";
import { wrap } from "../utils/validators.js";

export const orderGuard = wrap(async (req, res, next) => {
  // req.ip comes from Express's trusted reverse-proxy configuration, never request JSON.
  const result = await consumeOrderAttempt(req.user, req.ip);
  if (!result.blocked) return next();
  res.set("Cache-Control", "no-store");
  res.set("Retry-After", String(result.retryAfter));
  res.status(429).json({
    code: "ORDER_TEMPORARILY_BLOCKED",
    message:
      "Ordering is temporarily blocked because too many order attempts came from your account or network. Please wait for the cooldown to finish. You can still browse and view your orders.",
    ...result,
  });
});
export const orderGuardStatus = wrap(async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(await getOrderGuardStatus(req.user, req.ip));
});
