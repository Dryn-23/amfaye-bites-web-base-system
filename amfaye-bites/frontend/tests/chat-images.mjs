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
import { fileURLToPath } from "node:url";
const photo = fileURLToPath(
  new URL("../public/products/croissant.jpg", import.meta.url),
);
try {
  await c.goto(base + "/orders/" + order._id, {
    waitUntil: "domcontentloaded",
  });
  await c.getByRole("button", { name: "Chat with admin" }).click();
  await c.waitForURL("**/messages/*");
  const id = new URL(c.url()).pathname.split("/").at(-1);
  const chooser = c.getByLabel("Choose chat image");
  await chooser.setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await c.getByRole("alert").filter({ hasText: "not supported" }).waitFor();
  await chooser.setInputFiles(photo);
  await c.getByAltText("Selected image preview").waitFor();
  await c.getByRole("button", { name: "Remove attached image" }).click();
  assert.equal(await c.getByAltText("Selected image preview").count(), 0);
  await chooser.setInputFiles(photo);
  await c
    .getByLabel("Message admin", { exact: true })
    .fill("Can you help me with this pastry?");
  await c.getByRole("button", { name: "Send message", exact: true }).click();
  await c.locator(".chat-image-open img").waitFor();
  await c.waitForFunction(
    () => document.querySelector(".chat-image-open img")?.naturalWidth > 0,
  );
  assert.equal(await c.getByAltText("Selected image preview").count(), 0);
  await a.goto(base + "/admin/messages/" + id, {
    waitUntil: "domcontentloaded",
  });
  await a.locator(".chat-image-open img").waitFor({ timeout: 15000 });
  await a.waitForFunction(
    () => document.querySelector(".chat-image-open img")?.naturalWidth > 0,
  );
  await a
    .getByRole("button", { name: "View attached image", exact: true })
    .click();
  await a.getByRole("dialog", { name: "Attached chat image" }).waitFor();
  const download = a.waitForEvent("download");
  await a.getByRole("link", { name: "Save image", exact: true }).click();
  assert.equal((await download).suggestedFilename(), "chat-image.jpg");
  await a.keyboard.press("Escape");
  assert.equal(
    await a.getByRole("dialog", { name: "Attached chat image" }).isVisible(),
    false,
  );
  // Admin can send an image without a caption.
  await a.getByLabel("Choose chat image").setInputFiles(photo);
  await a.getByRole("button", { name: "Send message", exact: true }).click();
  await c
    .locator(".chat-message.incoming .chat-image-open img")
    .waitFor({ timeout: 15000 });
  // Simulate a lost response AFTER the backend commits, then retry the same image.
  await c.evaluate(() => {
    const original = window.fetch;
    window.__restoreImageFetch = () => {
      window.fetch = original;
    };
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (String(args[0]).endsWith("/image-messages") && response.ok) {
        window.__imageResponseLost = true;
        return new Response(
          JSON.stringify({ message: "Test upload response lost" }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }
      return response;
    };
  });
  await chooser.setInputFiles(photo);
  await c
    .getByLabel("Message admin", { exact: true })
    .fill("Retried attachment");
  await c.getByRole("button", { name: "Send message", exact: true }).click();
  await c
    .getByRole("alert")
    .filter({ hasText: "Test upload response lost" })
    .waitFor();
  assert.equal(await c.evaluate(() => window.__imageResponseLost), true);
  assert.equal(
    await c.getByLabel("Message admin", { exact: true }).inputValue(),
    "Retried attachment",
  );
  await c.getByAltText("Selected image preview").waitFor();
  await c.evaluate(() => window.__restoreImageFetch());
  await c.getByRole("button", { name: "Send message", exact: true }).click();
  await c.getByAltText("Selected image preview").waitFor({ state: "hidden" });
  const transcript = await api("/chats/" + id + "/messages", customer.token);
  assert.equal(
    transcript.messages.filter((m) => m.text === "Retried attachment").length,
    1,
  );
  assert.equal(transcript.messages.length, 3);
  // Close preserves viewing but disables new uploads; customer can reopen.
  await a
    .getByRole("button", { name: "Close conversation", exact: true })
    .click();
  await c.locator(".chat-closed-note").waitFor({ timeout: 15000 });
  assert.equal(
    await c
      .getByRole("button", { name: "Attach image", exact: true })
      .isDisabled(),
    true,
  );
  await c
    .getByRole("button", { name: "Reopen conversation", exact: true })
    .click();
  await c.locator(".chat-closed-note").waitFor({ state: "hidden" });
  for (const p of [c, a])
    for (const width of [1440, 768, 390, 360]) {
      await p.setViewportSize({ width, height: 1000 });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Overflow " + width,
      );
    }
  await c.evaluate(() => {
    localStorage.setItem("ab-theme", "dark");
    document.documentElement.dataset.theme = "dark";
  });
  await c
    .getByRole("button", { name: "View attached image", exact: true })
    .last()
    .click();
  await c.getByRole("dialog").waitFor();
  const bounds = await c.getByRole("dialog").boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 360);
  await c.getByRole("button", { name: "Close image preview" }).click();
  await c.screenshot({
    path: "/home/user/chat-image-mobile.png",
    fullPage: true,
  });
  await a.setViewportSize({ width: 1440, height: 1000 });
  await a.locator(".chat-inbox-item").first().waitFor();
  await a.screenshot({
    path: "/home/user/chat-image-admin.png",
    fullPage: true,
  });
  await c.reload({ waitUntil: "domcontentloaded" });
  await c.locator(".chat-image-open img").last().waitFor();
  await c.waitForFunction(() =>
    [...document.querySelectorAll(".chat-image-open img")].some(
      (i) => i.naturalWidth > 0,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS image chat browser: customer/admin attachments, optional caption, preview/remove, authenticated loading, viewer/download/Escape, lost-response retry deduplication, close/reopen, reload persistence, mobile/dark layouts and no page errors.",
  );
} finally {
  await browser.close();
}
