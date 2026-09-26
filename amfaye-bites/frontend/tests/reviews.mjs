// Against disposable local demo only: creates a customer, paid completed order and review.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { chromium } from "playwright";
const base = process.env.TEST_BASE_URL || "http://localhost:5173",
  apiBase = process.env.TEST_API_URL || "http://localhost:5000/api";
if (!process.env.DEMO_ADMIN_PASSWORD)
  throw Error("Set DEMO_ADMIN_PASSWORD for the disposable demo server.");
async function api(method, path, token, body) {
  const r = await fetch(apiBase + path, {
    method,
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
const stamp = Date.now(),
  customer = await api("POST", "/auth/register", null, {
    name: "Reviews Browser Customer",
    email: `reviews${stamp}@example.com`,
    username: `reviews${stamp}`,
    phone: "09123456789",
    password: "Reviews-Browser-123",
    confirmPassword: "Reviews-Browser-123",
  });
const admin = await api("POST", "/auth/login", null, {
  login: "admin@amfayebites.demo",
  password: process.env.DEMO_ADMIN_PASSWORD,
});
const products = await api("GET", "/products");
const product = products[0];
const order = await api("POST", "/orders", customer.token, {
  items: [{ product: product._id, quantity: 1 }],
  paymentMethod: "Cash",
  idempotencyKey: crypto.randomUUID(),
});
const publicName = "Pastry fan " + stamp;
const browser = await chromium.launch();
const errors = [];
async function session(token) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  if (token)
    await context.addInitScript(
      (t) => localStorage.setItem("ab-token", t),
      token,
    );
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
const c = await session(customer.token),
  a = await session(admin.token),
  g = await session();
const url = base + "/products/" + product._id + "/reviews";
try {
  await c.goto(url, { waitUntil: "domcontentloaded" });
  await c
    .getByText("You can review this product after your online order is")
    .waitFor();
  assert.equal(
    await c.getByRole("button", { name: "Publish review" }).count(),
    0,
  );
  await api("POST", "/payments/cash", admin.token, {
    order: order._id,
    amountReceived: 10000,
  });
  for (const status of [
    "Confirmed",
    "Preparing",
    "Ready for Pickup",
    "Completed",
  ])
    await api("PUT", `/orders/${order._id}/status`, admin.token, { status });
  await c.goto(base + "/orders/" + order._id, {
    waitUntil: "domcontentloaded",
  });
  await c
    .getByRole("link", { name: "Review " + product.name, exact: true })
    .click();
  await c.getByRole("radio", { name: "5 stars", exact: true }).check();
  await c.getByLabel("Public display name").fill(publicName);
  await c
    .getByLabel("Your review", { exact: true })
    .fill("Fresh pastry, lovely flavor and a thoughtful package.");
  await c.getByRole("button", { name: "Publish review", exact: true }).click();
  await c
    .getByRole("status")
    .filter({ hasText: "Your review has been saved" })
    .waitFor();
  await c.locator(".review-entry").filter({ hasText: publicName }).waitFor();
  await c.getByRole("radio", { name: "4 stars", exact: true }).check();
  await c
    .getByLabel("Your review", { exact: true })
    .fill("Lovely flavor. I would enjoy a slightly crispier finish.");
  await c.getByRole("button", { name: "Save changes", exact: true }).click();
  await c
    .locator(".review-entry")
    .filter({ hasText: publicName })
    .filter({ hasText: "slightly crispier" })
    .waitFor();
  // Network failure must retain draft and not pretend publication.
  const endpoint = "**/api/reviews/product/" + product._id + "/mine";
  await c.route(endpoint, (r) =>
    r.request().method() === "PUT"
      ? r.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"message":"Test review connection failure"}',
        })
      : r.continue(),
  );
  await c
    .getByLabel("Your review", { exact: true })
    .fill("My unsent review should survive a network failure.");
  await c.getByRole("button", { name: "Save changes", exact: true }).click();
  await c
    .getByRole("alert")
    .filter({ hasText: "Test review connection failure" })
    .waitFor();
  assert.equal(
    await c.getByLabel("Your review", { exact: true }).inputValue(),
    "My unsent review should survive a network failure.",
  );
  await c.unroute(endpoint);
  await c
    .getByLabel("Your review", { exact: true })
    .fill("Lovely flavor. I would enjoy a slightly crispier finish.");
  await c.getByRole("button", { name: "Save changes", exact: true }).click();
  await c
    .getByRole("status")
    .filter({ hasText: "Your review has been saved" })
    .waitFor();
  await g.goto(url, { waitUntil: "domcontentloaded" });
  await g.locator(".review-entry").filter({ hasText: publicName }).waitFor();
  assert.equal(
    await g.getByRole("button", { name: "Publish review" }).count(),
    0,
  );
  await g
    .locator(".review-form-panel")
    .getByRole("link", { name: "Sign in", exact: true })
    .waitFor();
  await a.goto(base + "/admin/reviews", { waitUntil: "domcontentloaded" });
  const card = a.locator(".review-admin-card").filter({ hasText: publicName });
  await card.getByRole("button", { name: "Hide review", exact: true }).click();
  await card
    .getByLabel("Reason for hiding this review")
    .fill("Test moderation: contains personal information.");
  await card.getByRole("button", { name: "Confirm hide", exact: true }).click();
  await card
    .locator(".review-visibility")
    .filter({ hasText: "Hidden" })
    .waitFor();
  await c.getByRole("button", { name: "Refresh", exact: true }).click();
  await c.getByText("Your review is hidden", { exact: true }).waitFor();
  await c
    .getByLabel("Your review", { exact: true })
    .fill("Revised text, with no personal information.");
  await c.getByRole("button", { name: "Save changes", exact: true }).click();
  await c.getByRole("status").filter({ hasText: "remains hidden" }).waitFor();
  await g.reload({ waitUntil: "domcontentloaded" });
  await g.locator(".review-list").waitFor();
  assert.equal(
    await g.locator(".review-entry").filter({ hasText: publicName }).count(),
    0,
  );
  await a.getByRole("button", { name: "Refresh", exact: true }).click();
  await card.getByText("Revised text, with no personal information.").waitFor();
  await card
    .getByRole("button", { name: "Restore review", exact: true })
    .click();
  await card
    .getByLabel("Reason for restoring this review")
    .fill("Revised text is appropriate for publication.");
  await card
    .getByRole("button", { name: "Confirm restore", exact: true })
    .click();
  await card
    .locator(".review-visibility")
    .filter({ hasText: "Visible" })
    .waitFor();
  await c.getByRole("button", { name: "Refresh", exact: true }).click();
  await c
    .locator(".review-entry")
    .filter({ hasText: publicName })
    .filter({ hasText: "Revised text" })
    .waitFor();
  await c.screenshot({
    path: "/home/user/reviews-desktop.png",
    fullPage: true,
  });
  for (const p of [c, a])
    for (const mode of ["light", "dark"])
      for (const width of [1440, 768, 390, 360]) {
        await p.setViewportSize({ width, height: 1000 });
        await p.evaluate((m) => {
          localStorage.setItem("ab-theme", m);
          document.documentElement.dataset.theme = m;
        }, mode);
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${mode} ${width} overflow`,
        );
      }
  await c.screenshot({
    path: "/home/user/reviews-mobile-dark.png",
    fullPage: true,
  });
  await a.screenshot({
    path: "/home/user/reviews-admin-mobile.png",
    fullPage: true,
  });
  // Catalog ratings link to reviews; product modal links work too.
  await g.goto(base + "/menu", { waitUntil: "domcontentloaded" });
  const productCard = g
    .locator(".product-card")
    .filter({ hasText: product.name })
    .first();
  await productCard.locator(".review-rating").waitFor();
  await productCard
    .locator(".review-rating")
    .filter({ hasText: /[0-9]\.[0-9].*review/ })
    .waitFor();
  await productCard
    .getByRole("button", { name: "View " + product.name, exact: true })
    .click();
  await g
    .getByRole("dialog")
    .getByRole("link", { name: "Read product reviews" })
    .click();
  await g.waitForURL("**/products/*/reviews");
  await g
    .locator(".review-entry")
    .filter({ hasText: publicName })
    .filter({ hasText: "Revised text" })
    .waitFor();
  assert.equal(await g.evaluate(() => document.body.style.overflow), "");
  assert.deepEqual(errors, []);
  console.log(
    "PASS reviews browser: eligibility, order link, publish/edit, failure draft, public privacy, admin hide/restore, hidden edits, catalog/modal links, light/dark 360–1440px; no page errors.",
  );
} catch (e) {
  await c.screenshot({ path: "/home/user/reviews-error.png", fullPage: true });
  throw e;
} finally {
  await browser.close();
}
