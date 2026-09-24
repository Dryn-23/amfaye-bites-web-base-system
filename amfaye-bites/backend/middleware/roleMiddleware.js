import { fail } from "../utils/validators.js";
export const roles =
  (...allowed) =>
  (req, res, next) =>
    allowed.includes(req.user?.role)
      ? next()
      : next(fail(403, "You do not have permission to access this feature."));
export const staff = roles("admin", "cashier");
export const admin = roles("admin");
