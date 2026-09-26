// Run only against a disposable development database; this creates test accounts/orders.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.TEST_BASE_URL || "http://localhost:5173";
if (!process.env.DEMO_ADMIN_PASSWORD)
  throw new Error("Set DEMO_ADMIN_PASSWORD for your test admin.");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function api(method, path, token, data) {
  const res = await page.request.fetch(base + "/api" + path, {
    method,
    headers: token ? { Authorization: "Bearer " + token } : {},
    data,
  });
  assert.ok(res.ok(), await res.text());
  return res.json();
}
try {
  const suffix = Date.now().toString(36);
  const login = "notify" + suffix;
  const password = "Demo-Notifications-1234";
  const customer = await api("POST", "/auth/register", null, {
    name: "Notification Tester",
    email: login + "@example.com",
    username: login,
    phone: "09123456789",
    password,
    confirmPassword: password,
  });
  const admin = await api("POST", "/auth/login", null, {
    login: process.env.DEMO_ADMIN_EMAIL || "admin@amfayebites.demo",
    password: process.env.DEMO_ADMIN_PASSWORD,
  });
  const products = await api("GET", "/products");
  await page.goto(base + "/login");
  await page.getByLabel("Email or username").fill(login);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/menu");
  await page
    .getByRole("button", { name: "Order notifications, 0 unread", exact: true })
    .click();
  await page.getByText("No updates just yet.").waitFor();
  await page.getByRole("button", { name: "Close notifications" }).click();
  const order = await api("POST", "/orders", customer.token, {
    items: [{ product: products[0]._id, quantity: 1 }],
    paymentMethod: "Cash",
    idempotencyKey: crypto.randomUUID(),
  });
  await page
    .locator(".order-toast")
    .filter({ hasText: "We've received your order" })
    .waitFor({ timeout: 16000 });
  await page
    .getByRole("button", { name: "Dismiss order notification" })
    .click();
  await api("PUT", `/orders/${order._id}/status`, admin.token, {
    status: "Confirmed",
  });
  await page
    .locator(".order-toast")
    .filter({ hasText: "Your order is confirmed" })
    .waitFor({ timeout: 16000 });
  await page.getByRole("button", { name: "View my order" }).click();
  await page.waitForURL("**/orders/" + order._id);
  await page
    .getByRole("button", { name: "Order notifications, 1 unread", exact: true })
    .waitFor();
  await api("PUT", `/orders/${order._id}/status`, admin.token, {
    status: "Preparing",
  });
  await api("PUT", `/orders/${order._id}/status`, admin.token, {
    status: "Ready for Pickup",
  });
  await page
    .locator(".order-toast")
    .filter({ hasText: "Your order is ready for pickup!" })
    .waitFor({ timeout: 16000 });
  await page
    .locator(".order-detail .status")
    .filter({ hasText: "Ready for Pickup" })
    .waitFor();
  await page
    .getByRole("button", { name: "Order notifications, 3 unread", exact: true })
    .click();
  await page
    .locator(".notification-panel")
    .getByText("Your order is ready for pickup!", { exact: true })
    .waitFor();
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Overflow at " + width,
    );
    const bounds = await page.locator(".notification-panel").boundingBox();
    assert.ok(
      bounds.x >= 0 && bounds.x + bounds.width <= width,
      "Panel offscreen at " + width,
    );
  }
  // Read-all and persisted state survive refresh without replaying old toasts.
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await page
    .getByRole("button", { name: "Order notifications, 0 unread", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Order notifications, 0 unread", exact: true })
    .click();
  await page
    .locator(".notification-panel")
    .getByText("Your order is ready for pickup!", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".order-toast").count(), 0);
  // Server failure is visible without discarding existing notifications, then retry recovers.
  await page.route("**/api/notifications", (route) => route.abort());
  await page.getByRole("button", { name: "Refresh notifications" }).click();
  await page.locator(".notification-error").waitFor();
  await page.unroute("**/api/notifications");
  await page.getByRole("button", { name: "Refresh notifications" }).click();
  await page.locator(".notification-error").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Close notifications" }).click();
  await page.goto(base + "/profile");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(base + "/");
  assert.equal(await page.locator(".notification-toggle").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: status popups, unread bell, order navigation and live status refresh, read persistence, read-all, responsive panel (360–1440px), offline recovery and logout privacy.",
  );
} finally {
  await browser.close();
}
