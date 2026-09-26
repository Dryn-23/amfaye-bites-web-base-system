import {
  orderGuard,
  orderGuardStatus,
} from "../middleware/orderGuardMiddleware.js";
import { Router } from "express";
import * as c from "../controllers/orderController.js";
import { auth } from "../middleware/authMiddleware.js";
import { staff } from "../middleware/roleMiddleware.js";
import { wrap } from "../utils/validators.js";
const r = Router();
r.use(auth);
r.get("/", wrap(c.list));
r.post("/", orderGuard, wrap(c.create));
r.get("/guard", orderGuardStatus);
r.get("/:id", wrap(c.detail));
r.put("/:id/status", staff, wrap(c.status));
export default r;
