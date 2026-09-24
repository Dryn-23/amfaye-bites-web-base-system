import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as c from "../controllers/paymentController.js";
import { auth } from "../middleware/authMiddleware.js";
import { staff } from "../middleware/roleMiddleware.js";
import { wrap } from "../utils/validators.js";
const r = Router();
r.use(auth);
r.use(
  rateLimit({
    windowMs: 60000,
    limit: 20,
    message: { message: "Please wait before trying again." },
  }),
);
r.post("/demo-otp", wrap(c.otp));
r.post("/demo-verify", wrap(c.verify));
r.post("/cash", staff, wrap(c.collect));
export default r;
