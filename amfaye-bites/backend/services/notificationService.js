import Notification from "../models/Notification.js";

const messages = {
  Pending: [
    "We've received your order",
    "Your order is waiting for the team to confirm it.",
  ],
  Confirmed: [
    "Your order is confirmed",
    "The team has accepted your order. We'll let you know when preparation starts.",
  ],
  Preparing: [
    "A little happiness is in the making",
    "We're preparing your pastries and shakes. Please wait for the pickup notification.",
  ],
  "Ready for Pickup": [
    "Your order is ready for pickup!",
    "Your order is ready. You can now collect it from the store.",
  ],
  Completed: [
    "Order completed. Thank you!",
    "Your order has been marked completed. Thank you for choosing Amfaye Bites.",
  ],
  Cancelled: [
    "Your order was cancelled",
    "The team has cancelled this order. Open the order to review its details.",
  ],
};

// Called inside the SAME MongoDB transaction as order creation/status changes.
// POS walk-ins are owned by staff and must not generate customer notifications.
export async function notifyOrderStatus(order, session) {
  if (order.source !== "web") return;
  const [title, message] = messages[order.status];
  await Notification.create(
    [
      {
        user: order.user,
        order: order._id,
        orderNumber: order.number,
        status: order.status,
        title,
        message,
      },
    ],
    { session },
  );
}
