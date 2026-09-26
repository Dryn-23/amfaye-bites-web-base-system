import mongoose from "mongoose";
import sharp from "sharp";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import Asset from "../models/ChatImageAsset.js";
import Quota from "../models/ChatImageQuota.js";
import { fail } from "../utils/validators.js";
sharp.cache({ memory: 16, files: 0, items: 10 });
export const MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 1024 * 1024;
export const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "chatImages",
  });
export function storageLimit() {
  const mb = Number(process.env.CHAT_IMAGE_STORAGE_MB || 100);
  return (
    (Number.isInteger(mb) && mb >= 10 && mb <= 1000 ? mb : 100) * 1024 * 1024
  );
}
// Limit expensive decoding concurrency within one API process.
let processing = 0;
export async function normalizeImage(file) {
  if (!file) throw fail(400, "Choose one JPEG, PNG or WebP image.");
  if (file.size > MAX_INPUT_BYTES)
    throw fail(413, "Images must be 5 MB or smaller.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
    throw fail(400, "Only JPEG, PNG and WebP images are supported.");
  if (processing >= 2)
    throw fail(503, "Image processing is busy. Please retry shortly.");
  const b = file.buffer;
  const signature =
    file.mimetype === "image/jpeg"
      ? b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255
      : file.mimetype === "image/png"
        ? b.length > 8 &&
          b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : b.length > 12 &&
          b.toString("ascii", 0, 4) === "RIFF" &&
          b.toString("ascii", 8, 12) === "WEBP";
  if (!signature)
    throw fail(400, "Image contents do not match a supported image type.");
  processing++;
  try {
    const decoder = sharp(file.buffer, {
      limitInputPixels: 16000000,
      failOn: "warning",
    }).timeout({ seconds: 15 });
    const meta = await decoder.metadata();
    const formats = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    if (
      formats[meta.format] !== file.mimetype ||
      !meta.width ||
      !meta.height ||
      (meta.pages || 1) > 1
    )
      throw fail(400, "Use a valid, non-animated JPEG, PNG or WebP image.");
    // Decode and re-encode: never serve user bytes, filenames, EXIF or GPS metadata.
    const { data, info } = await decoder
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > MAX_OUTPUT_BYTES)
      throw fail(
        413,
        "This image is too detailed. Resize it and try again (processed image limit: 1 MB).",
      );
    return {
      buffer: data,
      bytes: data.length,
      width: info.width,
      height: info.height,
      mime: "image/jpeg",
      sha256: crypto.createHash("sha256").update(data).digest("hex"),
    };
  } catch (e) {
    if (e.status) throw e;
    throw fail(
      400,
      "Image could not be read. Use a non-animated JPEG, PNG or WebP under 5 MB and 16 megapixels.",
    );
  } finally {
    processing--;
  }
}
export async function storeImage(image, conversation, user) {
  const fileId = new mongoose.Types.ObjectId();
  // A persistent shared quota accounts for both attachments and unfinished uploads.
  try {
    await Quota.updateOne(
      { _id: "chat-images" },
      { $setOnInsert: { bytes: 0 } },
      { upsert: true },
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
  }
  await mongoose.connection.transaction(async (session) => {
    const quota = await Quota.findOneAndUpdate(
      { _id: "chat-images", bytes: { $lte: storageLimit() - image.bytes } },
      { $inc: { bytes: image.bytes } },
      { new: true, session },
    );
    if (!quota)
      throw fail(
        507,
        "Chat image storage is full. Please send a text message and contact the admin.",
      );
    await Asset.create(
      [
        {
          _id: fileId,
          conversation,
          sender: user._id,
          bytes: image.bytes,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      ],
      { session },
    );
  });
  try {
    await pipeline(
      Readable.from([image.buffer]),
      bucket().openUploadStreamWithId(fileId, "chat-image.jpg", {
        metadata: { conversation: String(conversation), mime: "image/jpeg" },
      }),
    );
  } catch (e) {
    await discardPending(fileId).catch(() => {});
    throw e;
  }
  return {
    file: fileId,
    mime: image.mime,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    sha256: image.sha256,
  };
}
export async function attachImage(attachment, conversation, user, session) {
  const asset = await Asset.findOneAndUpdate(
    {
      _id: attachment.file,
      conversation,
      sender: user._id,
      state: "pending",
      expiresAt: { $gt: new Date() },
    },
    { $set: { state: "attached" } },
    { new: true, session },
  );
  if (!asset)
    throw fail(409, "This upload expired. Select the image again and retry.");
}
// Claim cleanup atomically against attachImage. Attached images can never be swept.
export async function discardPending(fileId, { expiredOnly = false } = {}) {
  const filter = { _id: fileId, state: { $in: ["pending", "deleting"] } };
  if (expiredOnly) filter.expiresAt = { $lte: new Date() };
  const asset = await Asset.findOneAndUpdate(
    filter,
    { $set: { state: "deleting" } },
    { new: true },
  );
  if (!asset) return false;
  // Explicitly remove both collections, including chunks left by a crashed upload.
  await mongoose.connection.db
    .collection("chatImages.files")
    .deleteOne({ _id: asset._id });
  await mongoose.connection.db
    .collection("chatImages.chunks")
    .deleteMany({ files_id: asset._id });
  await mongoose.connection.transaction(async (session) => {
    const removed = await Asset.findOneAndDelete({
      _id: asset._id,
      state: "deleting",
    }).session(session);
    if (removed)
      await Quota.updateOne(
        { _id: "chat-images" },
        { $inc: { bytes: -removed.bytes } },
        { session },
      );
  });
  return true;
}
export async function cleanupExpired() {
  const rows = await Asset.find({
    state: { $in: ["pending", "deleting"] },
    expiresAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  })
    .select("_id")
    .limit(200)
    .lean();
  let count = 0;
  for (const row of rows)
    if (await discardPending(row._id, { expiredOnly: true })) count++;
  return count;
}
