import jwt from "jsonwebtoken";
export const signToken = (user) =>
  jwt.sign(
    { sub: user.id, v: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d", algorithm: "HS256" },
  );
export const verifyToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
