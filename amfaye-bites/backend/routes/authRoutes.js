import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as c from "../controllers/authController.js";
import { auth } from "../middleware/authMiddleware.js";
import { wrap } from "../utils/validators.js";
const r = Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  message: { message: "Too many attempts. Try again in 15 minutes." },
});
r.post("/register", limit, wrap(c.register));
r.post("/login", limit, wrap(c.login));
r.get("/me", auth, wrap(c.me));
r.post("/logout", auth, wrap(c.logout));
r.put("/profile", auth, wrap(c.profile));
r.put("/password", auth, limit, wrap(c.changePassword));
export default r;
