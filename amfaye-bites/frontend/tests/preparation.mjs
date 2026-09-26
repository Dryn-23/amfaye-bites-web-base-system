// Run against a disposable demo database, never production.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { chromium } from "playwright";
const base = process.env.TEST_BASE_URL || "http://localhost:5173";
const apiBase = process.env.TEST_API_URL || "http://localhost:5000/api";
if (!process.env.DEMO_ADMIN_PASSWORD)
  throw Error("Set DEMO_ADMIN_PASSWORD for the disposable demo API.");
async function api(path, token, body, method) {
  const r = await fetch(apiBase + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  assert.ok(r.ok, path + " " + JSON.stringify(data));
  return data;
}
const suffix = Date.now();
const customer = await api("/auth/register", null, {
  name: "Queue Browser Customer",
  email: `queue${suffix}@example.com`,
  username: `queue${suffix}`,
  phone: "09123456789",
  password: "Browser-Queue-123",
  confirmPassword: "Browser-Queue-123",
});
const admin = await api("/auth/login", null, {
  login: "admin@amfayebites.demo",
  password: process.env.DEMO_ADMIN_PASSWORD,
});
const products = await api("/products");
const shake =
  products.find((p) => p.customizable) ||
  products.find((p) => /shake/i.test(p.name)) ||
  products[0];
const order = await api("/orders", customer.token, {
  items: [
    {
      product: shake._id,
      quantity: 2,
      ...(shake.customizable
        ? {
            customization: {
              size: "Large",
              sugar: "25%",
              ice: "Less Ice",
              addons: [],
            },
          }
        : {}),
    },
  ],
  paymentMethod: "Cash",
  notes: "Please pack the shakes separately.",
  idempotencyKey: crypto.randomUUID(),
});
const second = await api("/orders", customer.token, {
  items: [{ product: products[0]._id, quantity: 1 }],
  paymentMethod: "Cash",
  idempotencyKey: crypto.randomUUID(),
});
const cashierPassword = "Browser-Cashier-123";
await api("/users", admin.token, {
  name: "Queue Browser Cashier",
  email: `queuecashier${suffix}@example.com`,
  username: `queuecashier${suffix}`,
  role: "cashier",
  password: cashierPassword,
});
const cashier = await api("/auth/login", null, {
  login: `queuecashier${suffix}`,
  password: cashierPassword,
});
const browser = await chromium.launch();
const errors = [];
async function session(token, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  if (token)
    await context.addInitScript(
      (t) => localStorage.setItem("ab-token", t),
      token,
    );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return page;
}
const lane = (page, name) => page.locator(`section[aria-label="${name}"]`);
const card = (page, name, number) =>
  lane(page, name).locator(`article[aria-label="Order ${number}"]`);
const a = await session(admin.token);
await a.goto(base + "/admin/preparation");
await a.getByRole("heading", { name: "Preparation queue" }).waitFor();

// Pending orders stay out of the lanes until staff confirm them.
await a
  .getByText(/orders? need|order needs/)
  .first()
  .waitFor();
assert.equal(await card(a, "To prepare", order.number).count(), 0);
await api(
  `/orders/${order._id}/status`,
  admin.token,
  { status: "Confirmed" },
  "PUT",
);
await api(
  `/orders/${second._id}/status`,
  admin.token,
  { status: "Confirmed" },
  "PUT",
);

// Auto-refresh picks the order up without a manual reload.
await card(a, "To prepare", order.number).waitFor({ timeout: 20000 });
const details = card(a, "To prepare", order.number);
assert.match(await details.innerText(), /2×/);
assert.match(await details.innerText(), /Please pack the shakes separately\./);
if (shake.customizable) assert.match(await details.innerText(), /Large/);
assert.match(await details.innerText(), /Less than 1m|1m/);

// Cashier works the same queue from a second screen.
const c = await session(cashier.token);
await c.goto(base + "/admin/preparation");
await card(c, "To prepare", order.number).waitFor({ timeout: 20000 });
await card(c, "To prepare", order.number)
  .getByRole("button", { name: "Start preparing" })
  .click();
await card(c, "In preparation", order.number).waitFor();
assert.equal(await card(c, "To prepare", order.number).count(), 0);

// The other screen converges on the same status without duplicating the order.
await card(a, "In preparation", order.number).waitFor({ timeout: 20000 });
assert.equal(
  await a.locator(`article[aria-label="Order ${order.number}"]`).count(),
  1,
);

// A stale button click reports the conflict instead of skipping a step.
await a.getByRole("button", { name: "Refresh queue" }).click();
await card(a, "In preparation", order.number)
  .getByRole("button", { name: "Mark ready" })
  .click();
await card(a, "Ready for pickup", order.number).waitFor();
await card(c, "Ready for pickup", order.number).waitFor({ timeout: 20000 });

// Unpaid orders cannot be completed from the queue.
const ready = card(a, "Ready for pickup", order.number);
assert.match(
  await ready.innerText(),
  /Collect payment before completing this order\./,
);
assert.equal(
  await ready.getByRole("button", { name: "Mark collected" }).count(),
  0,
);
await ready.getByRole("link", { name: "Collect payment in Orders" }).waitFor();
const detail = await api(`/orders/${order._id}`, admin.token);
await api("/payments/cash", admin.token, {
  order: order._id,
  amountReceived: detail.total,
});
await a.getByRole("button", { name: "Refresh queue" }).click();
await ready
  .getByRole("button", { name: "Mark collected" })
  .waitFor({ timeout: 20000 });
a.once("dialog", (d) => d.accept());
await ready.getByRole("button", { name: "Mark collected" }).click();
await a.getByText(`${order.number} is now Completed.`).waitFor();
await card(a, "Ready for pickup", order.number).waitFor({ state: "detached" });
assert.equal(
  (await api(`/orders/${order._id}`, admin.token)).status,
  "Completed",
);

// Search filters every lane and can be cleared.
await a.getByLabel("Search queue").fill(second.number);
await card(a, "To prepare", second.number).waitFor();
await a.getByText("1 matching order").waitFor();
await a.getByLabel("Search queue").fill("[no-such-order]");
await a.getByText("0 matching orders").waitFor();
await a.getByRole("button", { name: "Clear" }).click();
await card(a, "To prepare", second.number).waitFor();

// Customers cannot reach the queue page or its data.
const guest = await session(customer.token);
await guest.goto(base + "/admin/preparation");
await guest.waitForTimeout(2500);
assert.equal(
  await guest.locator("section[aria-label='To prepare']").count(),
  0,
);
assert.ok(
  !guest.url().includes("/admin/preparation"),
  "customer stayed on queue URL",
);
const denied = await fetch(apiBase + "/preparation", {
  headers: { Authorization: "Bearer " + customer.token },
});
assert.equal(denied.status, 403);

// Mobile and dark rendering.
for (const width of [390, 768, 1440]) {
  await a.setViewportSize({ width, height: 900 });
  await a.waitForTimeout(400);
  await card(a, "To prepare", second.number).waitFor();
}
await a.evaluate(() =>
  document.documentElement.setAttribute("data-theme", "dark"),
);
await a.waitForTimeout(500);
await a.setViewportSize({ width: 390, height: 900 });
await a.waitForTimeout(400);
await a.screenshot({
  path: "/home/user/preparation-mobile.png",
  fullPage: true,
});
await a.setViewportSize({ width: 1440, height: 1000 });
await a.evaluate(() =>
  document.documentElement.setAttribute("data-theme", "light"),
);
await a.waitForTimeout(500);
await a.screenshot({
  path: "/home/user/preparation-queue.png",
  fullPage: true,
});
await browser.close();
assert.deepEqual(errors, [], "page errors: " + errors.join(" | "));
console.log("Preparation queue browser checks passed.");
