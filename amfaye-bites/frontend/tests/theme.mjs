import fs from "node:fs";
// UI test only; run against a disposable demo API. It creates one demo POS receipt.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.TEST_BASE_URL || "http://localhost:5173";
if (!process.env.DEMO_ADMIN_PASSWORD)
  throw new Error("Set DEMO_ADMIN_PASSWORD for the development admin.");
fs.mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "light",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function theme(expected) {
  await page.waitForFunction(
    (value) => document.documentElement.dataset.theme === value,
    expected,
  );
}
try {
  await page.goto(base + "/login");
  await theme("light");
  const originalLight = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--green"),
  );
  await page
    .getByLabel("Email or username")
    .fill(process.env.DEMO_ADMIN_EMAIL || "admin@amfayebites.demo");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/admin/pos");
  await page.goto(base + "/admin/settings");
  await page
    .getByRole("heading", { name: "Appearance", exact: true })
    .waitFor();
  await page.getByRole("radio", { name: /^Dark/ }).check();
  await theme("dark");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("ab-theme")),
    "dark",
  );
  assert.equal(
    await page
      .locator(".appearance-settings")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(37, 32, 27)",
  );
  assert.equal(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(25, 22, 18)",
  );
  await page.reload();
  await page.getByRole("radio", { name: /^Dark/ }).waitFor();
  await theme("dark");
  assert.equal(
    await page.getByRole("radio", { name: /^Dark/ }).isChecked(),
    true,
  );
  await page.screenshot({
    path: "test-results/theme-settings-desktop.png",
    fullPage: true,
  });
  // Preference updates another open tab on the same origin.
  const other = await context.newPage();
  await other.goto(base + "/");
  await other.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.getByRole("radio", { name: /^Light/ }).check();
  await theme("light");
  await other.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--green"),
    ),
    originalLight,
  );
  await page.getByRole("radio", { name: /^Light/ }).focus();
  await page.keyboard.press("ArrowRight");
  await theme("dark");
  await page.getByRole("radio", { name: /^System/ }).check();
  await theme("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await theme("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await theme("light");
  await page.getByRole("radio", { name: /^Dark/ }).check();
  await page.emulateMedia({ colorScheme: "light" });
  await theme("dark");
  // Appearance controls still work if read-only business settings cannot load.
  await page.route("**/api/settings", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Test server unavailable" }),
    }),
  );
  await page.reload();
  await page.getByText("Test server unavailable").waitFor();
  await page.getByRole("radio", { name: /^Light/ }).check();
  await theme("light");
  await page.getByRole("radio", { name: /^Dark/ }).check();
  await theme("dark");
  await page.unroute("**/api/settings");
  await page.reload();
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Settings overflow at " + width,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/theme-settings-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const path of [
    "/admin",
    "/admin/pos",
    "/admin/products",
    "/admin/inventory",
    "/admin/orders",
    "/menu",
    "/cart",
    "/profile",
    "/promotions",
    "/about",
    "/contact",
    "/",
  ]) {
    await page.goto(base + path);
    await theme("dark");
    await page.locator("main").first().waitFor();
    assert.equal(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(25, 22, 18)",
      path,
    );
  }
  await page.goto(base + "/admin/pos");
  await page.locator(".pos-product").first().waitFor();
  await page.screenshot({ path: "test-results/theme-pos.png", fullPage: true });
  await page.locator(".pos-product").first().click();
  await page.getByRole("button", { name: /Add to order/ }).waitFor();
  assert.equal(
    await page
      .locator(".product-modal")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(25, 22, 18)",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto(base + "/profile");
  await page
    .getByRole("heading", { name: "Appearance", exact: true })
    .waitFor();
  // Native inputs and customer-facing panels remain readable.
  const input = page.getByLabel("Full name", { exact: true });
  assert.equal(
    await input.evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(28, 24, 20)",
  );
  assert.equal(
    await input.evaluate((el) => getComputedStyle(el).color),
    "rgb(243, 234, 224)",
  );
  // Paid receipt must print on white in dark mode.
  const token = await page.evaluate(() => localStorage.getItem("ab-token"));
  const products = await (
    await page.request.get(base + "/api/products")
  ).json();
  const response = await page.request.post(base + "/api/orders", {
    headers: { Authorization: "Bearer " + token },
    data: {
      source: "pos",
      items: [{ product: products[0]._id, quantity: 1 }],
      paymentMethod: "Cash",
      amountReceived: 500,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  assert.equal(response.status(), 201);
  const order = await response.json();
  await page.goto(base + "/orders/" + order._id);
  await page.getByRole("button", { name: "Print receipt" }).waitFor();
  await page.emulateMedia({ media: "print" });
  assert.equal(
    await page
      .locator(".order-detail")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(255, 255, 255)",
  );
  assert.equal(
    await page
      .locator(".order-detail h2")
      .evaluate((el) => getComputedStyle(el).color),
    "rgb(0, 0, 0)",
  );
  await page.emulateMedia({ media: "screen" });
  // Bootstrap script resolves dark preference before React renders.
  const earlyContext = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        { origin: base, localStorage: [{ name: "ab-theme", value: "dark" }] },
      ],
    },
  });
  const earlyPage = await earlyContext.newPage();
  await earlyPage.route("**/src/main.jsx*", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "// React deliberately paused for bootstrap test",
    }),
  );
  await earlyPage.goto(base + "/");
  assert.equal(await earlyPage.getAttribute("html", "data-theme"), "dark");
  assert.equal(
    await earlyPage.locator("#root").evaluate((el) => el.children.length),
    0,
  );
  await earlyContext.close();
  // Storage failure must not crash the UI or claim that the choice was persisted.
  const restrictedContext = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: base,
          localStorage: [
            { name: "ab-token", value: token },
            { name: "ab-theme", value: "dark" },
          ],
        },
      ],
    },
  });
  await restrictedContext.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "ab-theme")
        throw new DOMException("Storage blocked", "SecurityError");
      return set.call(this, key, value);
    };
  });
  const restrictedPage = await restrictedContext.newPage();
  await restrictedPage.goto(base + "/profile");
  await restrictedPage.getByRole("radio", { name: /^Light/ }).check();
  await restrictedPage.getByText(/Browser storage is unavailable/).waitFor();
  assert.equal(
    await restrictedPage.getAttribute("html", "data-theme"),
    "light",
  );
  await restrictedContext.close();
  await page.goto(base + "/profile");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(base + "/");
  await theme("dark");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Light/Dark/System controls, persistent reload, cross-tab sync, live OS changes, explicit override, controls with API unavailable, responsive settings 360–1440px, site-wide dark surfaces/forms, white printed receipts, and preference after logout.",
  );
} finally {
  await browser.close();
}
