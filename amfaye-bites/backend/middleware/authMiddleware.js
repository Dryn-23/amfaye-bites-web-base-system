import { User } from "../models/index.js";
import { verifyToken } from "../utils/jwt.js";
import { fail, wrap } from "../utils/validators.js";
export const auth = wrap(async (req, res, next) => {
  let data;
  try {
    data = verifyToken(
      (req.headers.authorization || "").replace(/^Bearer /, ""),
    );
  } catch {
    throw fail(
      401,
      "Please sign in again. Your session is missing or expired.",
    );
  }
  const user = await User.findById(data.sub).select("+tokenVersion");
  if (!user || !user.active || data.v !== user.tokenVersion)
    throw fail(401, "This session is no longer valid. Please sign in.");
  req.user = user;
  next();
});
