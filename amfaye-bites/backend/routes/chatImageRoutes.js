import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import mongoose from "mongoose";
import Message from "../models/ChatMessage.js";
import { wrap, id, fail } from "../utils/validators.js";
import {
  ownedConversation,
  sendMessage,
  safeConversation,
} from "../services/chatService.js";
import {
  MAX_INPUT_BYTES,
  normalizeImage,
  storeImage,
  discardPending,
  bucket,
} from "../services/chatImageService.js";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_INPUT_BYTES,
    files: 1,
    fields: 2,
    parts: 3,
    fieldSize: 4000,
  },
}).single("image");
function parseUpload(req, res, next) {
  upload(req, res, (error) => {
    if (error)
      return next(
        fail(
          error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
          error.code === "LIMIT_FILE_SIZE"
            ? "Images must be 5 MB or smaller."
            : "Upload one image with an optional caption of up to 1,000 characters.",
        ),
      );
    next();
  });
}
let activeUploads = 0;
function uploadSlot(req, res, next) {
  if (activeUploads >= 3)
    return next(fail(503, "Uploads are busy. Please retry shortly."));
  activeUploads++;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      activeUploads--;
    }
  };
  res.once("finish", release);
  res.once("close", release);
  next();
}
export default function imageRoutes(writes) {
  const r = Router();
  r.post(
    "/:id/image-messages",
    writes,
    wrap(async (req, res, next) => {
      await ownedConversation(req.params.id, req.user);
      next();
    }),
    uploadSlot,
    parseUpload,
    wrap(async (req, res) => {
      const data = z
        .object({
          text: z.string().trim().max(1000).default(""),
          clientMessageId: z.string().min(8).max(100),
        })
        .parse(req.body);
      const image = await normalizeImage(req.file);
      // Retry short circuit avoids consuming storage quota again after a lost response.
      const existing = await Message.findOne({
        conversation: req.params.id,
        sender: req.user._id,
        clientMessageId: data.clientMessageId,
      });
      if (existing) {
        if (
          existing.text !== data.text ||
          existing.attachment?.sha256 !== image.sha256
        )
          throw fail(
            409,
            "This retry does not match the original message. Select the image again to send a new message.",
          );
        const c = await ownedConversation(req.params.id, req.user);
        return res
          .status(201)
          .json({
            message: existing,
            conversation: safeConversation(c, req.user),
          });
      }
      let attachment, result;
      try {
        attachment = await storeImage(image, req.params.id, req.user);
        result = await sendMessage(req.params.id, data, req.user, attachment);
      } finally {
        // Committed assets are attached and cannot be deleted here, even if the response failed.
        if (attachment)
          await discardPending(attachment.file).catch((e) =>
            console.error("Chat upload cleanup deferred:", e.name),
          );
      }
      res.status(201).json(result);
    }),
  );
  r.get(
    "/:id/messages/:messageId/image",
    wrap(async (req, res) => {
      await ownedConversation(req.params.id, req.user);
      const message = await Message.findOne({
        _id: id.parse(req.params.messageId),
        conversation: req.params.id,
      });
      if (!message?.attachment?.file) throw fail(404, "Image not found.");
      const file = await mongoose.connection.db
        .collection("chatImages.files")
        .findOne({ _id: message.attachment.file });
      if (!file) throw fail(404, "Image is unavailable.");
      res.set({
        "Content-Type": "image/jpeg",
        "Content-Length": String(file.length),
        "Content-Disposition": 'inline; filename="chat-image.jpg"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      const stream = bucket().openDownloadStream(message.attachment.file);
      res.on("close", () => stream.destroy());
      stream.on("error", () => {
        if (!res.headersSent) {
          res.removeHeader("Content-Length");
          res
            .status(503)
            .json({ message: "Image could not be loaded. Please retry." });
        } else res.destroy();
      });
      stream.pipe(res);
    }),
  );
  return r;
}
