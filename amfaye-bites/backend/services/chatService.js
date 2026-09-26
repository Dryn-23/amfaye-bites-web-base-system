import mongoose from "mongoose";
import { z } from "zod";
import { Order, User, AuditLog } from "../models/index.js";
import Conversation from "../models/ChatConversation.js";
import Message from "../models/ChatMessage.js";
import { fail, id } from "../utils/validators.js";

export function ownerFilter(user) {
  return user.role === "admin" ? {} : { customer: user._id };
}
export async function ownedConversation(conversationId, user, session) {
  const query = Conversation.findOne({
    _id: id.parse(conversationId),
    ...ownerFilter(user),
  });
  if (session) query.session(session);
  const conversation = await query;
  if (!conversation) throw fail(404, "Conversation not found.");
  return conversation;
}
export function safeConversation(c, user) {
  const o = c.toObject ? c.toObject() : c;
  return {
    _id: o._id,
    order: o.order,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    status: o.status,
    lastSequence: o.lastSequence,
    lastMessage: o.lastMessage,
    lastMessageAt: o.lastMessageAt,
    createdAt: o.createdAt,
    unreadCount: user.role === "admin" ? o.adminUnread : o.customerUnread,
    myReadSequence:
      user.role === "admin" ? o.adminReadSequence : o.customerReadSequence,
    theirReadSequence:
      user.role === "admin" ? o.customerReadSequence : o.adminReadSequence,
  };
}
export async function startConversation(orderId, user) {
  const order = await Order.findOne({
    _id: id.parse(orderId),
    ...(user.role === "admin" ? {} : { user: user._id }),
    source: "web",
  });
  if (!order) throw fail(404, "An eligible online order was not found.");
  const customer = await User.findOne({
    _id: order.user,
    role: "customer",
    active: true,
  });
  if (!customer)
    throw fail(400, "Chat is available for registered customer orders only.");
  const insert = {
    order: order._id,
    customer: order.user,
    orderNumber: order.number,
    customerName: customer.name,
  };
  let conversation;
  try {
    conversation = await Conversation.findOneAndUpdate(
      { order: order._id },
      { $setOnInsert: insert },
      { upsert: true, new: true, runValidators: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    conversation = await Conversation.findOne({ order: order._id });
  }
  return safeConversation(conversation, user);
}
export const messageInput = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Please enter a message.")
    .max(1000, "Messages may contain up to 1,000 characters."),
  clientMessageId: z.string().min(8).max(100),
});
export async function sendMessage(conversationId, body, user) {
  const data = messageInput.parse(body);
  let result;
  await mongoose.connection.transaction(async (session) => {
    const conversation = await ownedConversation(conversationId, user, session);
    const existing = await Message.findOne({
      conversation: conversation._id,
      sender: user._id,
      clientMessageId: data.clientMessageId,
    }).session(session);
    if (existing) {
      if (existing.text !== data.text)
        throw fail(
          409,
          "This message retry does not match the original. Send it as a new message.",
        );
      result = {
        message: existing,
        conversation: safeConversation(conversation, user),
      };
      return;
    }
    if (conversation.status === "Closed")
      throw fail(
        409,
        "This conversation is closed. Reopen it before sending another message.",
      );
    conversation.lastSequence += 1;
    conversation.lastMessage = data.text.slice(0, 180);
    conversation.lastMessageAt = new Date();
    if (user.role === "admin") conversation.customerUnread += 1;
    else conversation.adminUnread += 1;
    const [message] = await Message.create(
      [
        {
          conversation: conversation._id,
          sequence: conversation.lastSequence,
          sender: user._id,
          senderRole: user.role,
          senderName: user.name,
          text: data.text,
          clientMessageId: data.clientMessageId,
        },
      ],
      { session },
    );
    await conversation.save({ session });
    result = { message, conversation: safeConversation(conversation, user) };
  });
  return result;
}
export async function markRead(conversationId, through, user) {
  let result;
  await mongoose.connection.transaction(async (session) => {
    const c = await ownedConversation(conversationId, user, session);
    const sequence = Math.min(through, c.lastSequence);
    const field =
      user.role === "admin" ? "adminReadSequence" : "customerReadSequence";
    const countField = user.role === "admin" ? "adminUnread" : "customerUnread";
    if (sequence > c[field]) {
      const count = await Message.countDocuments({
        conversation: c._id,
        senderRole: user.role === "admin" ? "customer" : "admin",
        sequence: { $gt: c[field], $lte: sequence },
      }).session(session);
      c[field] = sequence;
      c[countField] = Math.max(0, c[countField] - count);
      await c.save({ session });
    }
    result = safeConversation(c, user);
  });
  return result;
}
export async function setStatus(conversationId, status, user) {
  if (status === "Closed" && user.role !== "admin")
    throw fail(403, "Only an admin can close a conversation.");
  let result;
  await mongoose.connection.transaction(async (session) => {
    const c = await ownedConversation(conversationId, user, session);
    if (c.status !== status) {
      c.status = status;
      await c.save({ session });
      await AuditLog.create(
        [
          {
            actor: user._id,
            action: `chat.${status.toLowerCase()}`,
            entity: "ChatConversation",
            entityId: c.id,
          },
        ],
        { session },
      );
    }
    result = safeConversation(c, user);
  });
  return result;
}
