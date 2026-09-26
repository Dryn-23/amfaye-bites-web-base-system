// Only run against disposable development data. Never run against a real business database.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.TEST_BASE_URL || "http://localhost:5173";
if (!process.env.DEMO_ADMIN_PASSWORD)
  throw new Error("Set DEMO_ADMIN_PASSWORD for your disposable demo admin.");
const browser = await chromium.launch({ headless: true });
const customerContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const adminContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await customerContext.newPage();
const staff = await adminContext.newPage();
const errors = [];
for (const p of [page, staff]) p.on("pageerror", (e) => errors.push(e.message));
async function api(method, path, token, data, expected = 200) {
  const res = await page.request.fetch(base + "/api" + path, {
    method,
    headers: token ? { Authorization: "Bearer " + token } : {},
    data,
  });
  assert.equal(res.status(), expected, await res.text());
  return res.json();
}
let original = [],
  admin;
function editable(p, stock) {
  return {
    name: p.name,
    description: p.description,
    category: p.category._id,
    price: p.price,
    image: p.image,
    stock,
    minimumStock: p.minimumStock,
    available: p.enabled,
    featured: p.featured,
    customizable: p.customizable,
    badge: p.badge || "",
  };
}
try {
  const suffix = Date.now().toString(36);
  const login = "security" + suffix;
  const password = "Security-Test-1234";
  const user = await api(
    "POST",
    "/auth/register",
    null,
    {
      name: "Security Test Customer",
      email: login + "@example.com",
      username: login,
      phone: "09123456789",
      password,
      confirmPassword: password,
    },
    201,
  );
  admin = await api("POST", "/auth/login", null, {
    login: process.env.DEMO_ADMIN_EMAIL || "admin@amfayebites.demo",
    password: process.env.DEMO_ADMIN_PASSWORD,
  });
  const products = await api("GET", "/products");
  original = products.slice(0, 2);
  await api(
    "PUT",
    "/products/" + original[0]._id,
    admin.token,
    editable(original[0], 3),
  );
  await api(
    "PUT",
    "/products/" + original[1]._id,
    admin.token,
    editable(original[1], 0),
  );
  await page.goto(base + "/login");
  await page.getByLabel("Email or username").fill(login);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/menu");
  await page
    .getByRole("button", { name: "Add " + products[2].name, exact: true })
    .click();
  await page.getByRole("button", { name: /Add to order/ }).click();
  await page.locator(".product-modal").waitFor({ state: "hidden" });
  await page.goto(base + "/checkout");
  await page
    .getByRole("button", { name: "Place my order", exact: true })
    .waitFor();
  for (let n = 0; n < 5; n++)
    await api("POST", "/orders", user.token, { items: [] }, 400);
  await page
    .getByRole("button", { name: "Place my order", exact: true })
    .click();
  await page
    .getByText("Ordering temporarily blocked", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Try again in/ }).isDisabled(),
    true,
  );
  const first = await page
    .getByRole("button", { name: /Try again in/ })
    .textContent();
  await page.waitForTimeout(1100);
  assert.notEqual(
    await page.getByRole("button", { name: /Try again in/ }).textContent(),
    first,
  );
  await page.reload();
  await page
    .getByText("Ordering temporarily blocked", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Try again in/ }).isDisabled(),
    true,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.goto(base + "/orders");
  await page.getByRole("heading", { name: "Your happy history." }).waitFor();
  await staff.goto(base + "/login");
  await staff
    .getByLabel("Email or username")
    .fill(process.env.DEMO_ADMIN_EMAIL || "admin@amfayebites.demo");
  await staff
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_ADMIN_PASSWORD);
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await staff.waitForURL("**/admin/pos");
  await staff.goto(base + "/admin");
  await staff
    .getByRole("heading", { name: "Product stock alerts", exact: true })
    .waitFor();
  await staff
    .locator(".stock-alert-row")
    .filter({ hasText: original[0].name })
    .waitFor();
  await staff
    .locator(".stock-alert-row")
    .filter({ hasText: original[1].name })
    .waitFor();
  await staff.getByRole("link", { name: /Low-stock products/ }).click();
  await staff
    .locator("tbody tr")
    .filter({ hasText: original[0].name })
    .waitFor();
  assert.equal(
    await staff
      .locator("tbody tr")
      .filter({ hasText: original[1].name })
      .count(),
    0,
  );
  await staff.getByRole("button", { name: /^Out of stock \(/ }).click();
  await staff
    .locator("tbody tr")
    .filter({ hasText: original[1].name })
    .waitFor();
  assert.equal(
    await staff
      .locator("tbody tr")
      .filter({ hasText: original[0].name })
      .count(),
    0,
  );
  await staff.goto(base + "/admin");
  await staff.locator(".stock-summary").first().waitFor();
  for (const width of [1440, 1024, 768, 390, 360]) {
    await staff.setViewportSize({ width, height: 900 });
    assert.equal(
      await staff.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Dashboard overflow at " + width,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real order-block response, countdown, disabled checkout, persistence after reload, browsing during cooldown, dashboard alerts, product filters, responsive stock UI.",
  );
} finally {
  if (admin)
    for (const p of original)
      await api(
        "PUT",
        "/products/" + p._id,
        admin.token,
        editable(p, p.stock),
      ).catch(() => {});
  await browser.close();
}
