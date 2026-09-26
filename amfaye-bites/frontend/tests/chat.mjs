// Run against a disposable demo database, never production.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import crypto from "node:crypto";
const base = process.env.TEST_BASE_URL || "http://localhost:5173";
const apiBase = process.env.TEST_API_URL || "http://localhost:5000/api";
if (!process.env.DEMO_ADMIN_PASSWORD)
  throw Error("Set DEMO_ADMIN_PASSWORD for the disposable demo API.");
async function api(path, token, body) {
  const r = await fetch(apiBase + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
}
const suffix = Date.now();
const customer = await api("/auth/register", null, {
  name: "Chat Browser Customer",
  email: `chat${suffix}@example.com`,
  username: `chat${suffix}`,
  phone: "09123456789",
  password: "Browser-Chat-123",
  confirmPassword: "Browser-Chat-123",
});
const admin = await api("/auth/login", null, {
  login: "admin@amfayebites.demo",
  password: process.env.DEMO_ADMIN_PASSWORD,
});
const products = await api("/products");
const order = await api("/orders", customer.token, {
  items: [{ product: products[0]._id, quantity: 1 }],
  paymentMethod: "Cash",
  idempotencyKey: crypto.randomUUID(),
});
const browser = await chromium.launch();
const errors = [];
async function session(token) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(
    (t) => localStorage.setItem("ab-token", t),
    token,
  );
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
const c = await session(customer.token),
  a = await session(admin.token);
try {
  await c.goto(base + "/orders/" + order._id, {
    waitUntil: "domcontentloaded",
  });
  await c.getByRole("button", { name: "Chat with admin" }).click();
  await c.waitForURL("**/messages/*");
  const id = new URL(c.url()).pathname.split("/").at(-1);
  await c
    .getByLabel("Message admin", { exact: true })
    .fill("Hello! What time can I pick up my order?");
  await c.getByRole("button", { name: "Send message", exact: true }).click();
  await c.locator(".chat-bubble").filter({ hasText: "What time" }).waitFor();
  await a.goto(base + "/admin/messages", { waitUntil: "domcontentloaded" });
  await a.locator(".chat-inbox-item").filter({ hasText: order.number }).click();
  await a.locator(".chat-bubble").filter({ hasText: "What time" }).waitFor();
  await a
    .getByLabel("Message customer", { exact: true })
    .fill("Hello! We will update your order when it is ready for pickup.");
  await a.getByRole("button", { name: "Send message", exact: true }).click();
  await c
    .locator(".chat-bubble")
    .filter({ hasText: "We will update" })
    .waitFor({ timeout: 15000 });
  await c
    .locator(".chat-message.own .chat-message-meta")
    .filter({ hasText: "Seen" })
    .waitFor({ timeout: 15000 });
  await a
    .getByRole("button", { name: "Close conversation", exact: true })
    .click();
  await c.locator(".chat-closed-note").waitFor({ timeout: 15000 });
  assert.equal(
    await c.getByLabel("Message admin", { exact: true }).isDisabled(),
    true,
  );
  await c
    .getByRole("button", { name: "Reopen conversation", exact: true })
    .click();
  await c.locator(".chat-closed-note").waitFor({ state: "hidden" });
  // Failed POST keeps draft and can be retried, without pretending delivery.
  const endpoint = "**/api/chats/" + id + "/messages";
  await c.route(endpoint, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Test connection interruption" }),
        })
      : route.continue(),
  );
  await c
    .getByLabel("Message admin", { exact: true })
    .fill("A follow-up after reconnecting.");
  await c.getByRole("button", { name: "Send message", exact: true }).click();
  await c
    .getByRole("alert")
    .filter({ hasText: "Test connection interruption" })
    .waitFor();
  assert.equal(
    await c.getByLabel("Message admin", { exact: true }).inputValue(),
    "A follow-up after reconnecting.",
  );
  await c.unroute(endpoint);
  await c.getByRole("button", { name: "Send message", exact: true }).click();
  await c
    .locator(".chat-bubble")
    .filter({ hasText: "A follow-up after reconnecting." })
    .waitFor();
  assert.equal(
    await c
      .locator(".chat-bubble")
      .filter({ hasText: "A follow-up after reconnecting." })
      .count(),
    1,
  );
  // Markup stays literal, never interpreted as HTML.
  const literal = "<img src=x onerror=alert(1)>";
  await c.getByLabel("Message admin", { exact: true }).fill(literal);
  await c.getByRole("button", { name: "Send message", exact: true }).click();
  await c.locator(".chat-bubble").filter({ hasText: literal }).waitFor();
  assert.equal(await c.locator(".chat-bubble img").count(), 0);
  await c.screenshot({
    path: "/home/user/chat-customer-desktop.png",
    fullPage: true,
  });
  for (const p of [c, a])
    for (const width of [1440, 768, 390, 360]) {
      await p.setViewportSize({ width, height: 900 });
      await p.evaluate(() => localStorage.setItem("ab-theme", "dark"));
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.locator(".chat-thread textarea").waitFor();
      if (
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      ) {
        console.log(
          "OVERFLOW",
          p.url(),
          await p.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .filter((e) => e.getBoundingClientRect().right > innerWidth)
              .map((e) => [
                e.tagName,
                e.className,
                e.getBoundingClientRect().right,
              ])
              .slice(0, 20),
          ),
        );
        await p.screenshot({
          path: "/home/user/chat-overflow.png",
          fullPage: true,
        });
      }
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Overflow " + width,
      );
      const box = await p
        .getByRole("button", { name: "Send message", exact: true })
        .boundingBox();
      assert.ok(
        box.x >= 0 && box.x + box.width <= width,
        "Send button offscreen",
      );
    }
  await c.screenshot({
    path: "/home/user/chat-mobile-dark.png",
    fullPage: true,
  });
  await a.setViewportSize({ width: 1440, height: 1000 });
  await a.screenshot({
    path: "/home/user/chat-admin-dark.png",
    fullPage: true,
  });
  // Away from thread: polling surfaces unread; opening it clears badge.
  await c.goto(base + "/menu", { waitUntil: "domcontentloaded" });
  await api("/chats/" + id + "/messages", admin.token, {
    text: "Your support update is here.",
    clientMessageId: crypto.randomUUID(),
  });
  await c
    .getByRole("link", { name: /Messages, [1-9]\d* unread/ })
    .waitFor({ timeout: 20000 });
  await c.goto(base + "/messages/" + id, { waitUntil: "domcontentloaded" });
  await c
    .locator(".chat-bubble")
    .filter({ hasText: "Your support update is here." })
    .waitFor();
  await c
    .getByRole("link", { name: "Messages, 0 unread", exact: true })
    .waitFor({ timeout: 15000 });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: customer/admin browser chat, polling, seen/unread, close/reopen, failure/retry, literal text, light/dark and 360–1440px with no page errors.",
  );
} finally {
  await browser.close();
}
