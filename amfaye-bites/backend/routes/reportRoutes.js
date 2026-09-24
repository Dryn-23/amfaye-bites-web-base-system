import { Router } from "express";
import * as s from "../services/reportService.js";
import { auth } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/roleMiddleware.js";
import { wrap } from "../utils/validators.js";
const r = Router();
r.use(auth, admin);
for (const name of ["sales", "products", "inventory"])
  r.get(
    "/" + name,
    wrap(async (req, res) => res.json(await s[name](req.query))),
  );
export default r;
