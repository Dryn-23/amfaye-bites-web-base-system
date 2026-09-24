export function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ message: "Invalid JSON request body." });
  if (err.name === "ZodError")
    return res
      .status(400)
      .json({
        message: err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
  if (err.code === 11000)
    return res
      .status(409)
      .json({
        message:
          "This value already exists. Use a different email, username or name.",
      });
  if (["CastError", "ValidationError"].includes(err.name))
    return res
      .status(400)
      .json({ message: "Invalid data. Check all fields and try again." });
  if (
    err.name === "MongoServerSelectionError" ||
    err.name === "MongooseServerSelectionError"
  )
    return res
      .status(503)
      .json({ message: "Database unavailable. Please try again shortly." });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res
    .status(status)
    .json({
      message:
        status === 500
          ? "Something went wrong. Please try again."
          : err.message,
    });
}
