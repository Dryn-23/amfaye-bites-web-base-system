import { chromium } from "playwright";
const base = process.env.TEST_BASE_URL || "http://localhost:5173";
const suffix = Date.now().toString(36);
if (!process.env.DEMO_ADMIN_PASSWORD)
  throw new Error(
    "Set DEMO_ADMIN_PASSWORD to your development admin password.",
  );
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);
await page.waitForSelector(".product-card");
await page
  .getByRole("button", { name: "Add Mango Shake", exact: true })
  .click();
await page.getByRole("button", { name: "Large", exact: true }).click();
await page.getByRole("button", { name: "25%", exact: true }).click();
await page.getByRole("button", { name: /Add to order/ }).click();
await page.waitForTimeout(700);
await page.goto(base + "/cart");
await page.getByText("Mango Shake", { exact: true }).waitFor();
await page.getByRole("link", { name: /Proceed to checkout/ }).click();
await page.waitForURL("**/login");
await page.getByRole("link", { name: "Create an account" }).click();
await page.getByLabel("Full name", { exact: true }).fill("Browser Tester");
await page.getByLabel("Username", { exact: true }).fill("browser" + suffix);
await page
  .getByLabel("Email address", { exact: true })
  .fill("browser" + suffix + "@test.local");
await page.getByLabel("Mobile number", { exact: true }).fill("09123456789");
await page.getByLabel("Password", { exact: true }).fill("Browser-Test-1234");
await page
  .getByLabel("Confirm password", { exact: true })
  .fill("Browser-Test-1234");
await page.getByRole("button", { name: "Create my account" }).click();
await page.waitForURL("**/checkout");
await page.getByRole("button", { name: "Demo GCash", exact: true }).click();
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.getByRole("button", { name: "Show Demo OTP" }).click();
const code = await page.locator(".demo-message>strong").textContent();
await page.getByLabel("Demo verification code").fill(code);
await page.getByRole("button", { name: "Verify demo code" }).click();
await page.getByText("Demo verification successful!").waitFor();
await page.getByRole("button", { name: "Place my order" }).click();
await page.waitForURL("**/orders/*");
await page.getByRole("button", { name: "Print receipt" }).waitFor();
console.log("Customer browser flow passed");
await page.evaluate(() => localStorage.clear());
await page.goto(base + "/login");
await page
  .getByLabel("Email or username")
  .fill(process.env.DEMO_ADMIN_EMAIL || "admin@amfayebites.demo");
await page
  .getByLabel("Password", { exact: true })
  .fill(process.env.DEMO_ADMIN_PASSWORD);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/admin/pos");
await page.locator(".pos-product").first().click();
await page.getByRole("button", { name: /Add to order/ }).click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Continue to payment" }).click();
await page.getByLabel("Amount received").fill("500");
await page.getByRole("button", { name: "Complete order" }).click();
await page.getByRole("link", { name: "View receipt" }).waitFor();
console.log("Cash POS browser flow passed");
for (const path of [
  "admin",
  "admin/orders",
  "admin/products",
  "admin/categories",
  "admin/inventory",
  "admin/customers",
  "admin/sales",
  "admin/reports",
  "admin/users",
  "admin/settings",
]) {
  await page.goto(base + "/" + path);
  await page.waitForTimeout(350);
  if (await page.locator(".error").count())
    throw new Error(
      "Error panel on " +
        path +
        ": " +
        (await page.locator(".error").allTextContents()),
    );
}
await page.goto(base + "/admin/pos");
await page.waitForSelector(".pos-product");
await page.setViewportSize({ width: 390, height: 844 });
for (const path of ["", "menu", "cart", "about", "promotions", "admin/pos"]) {
  await page.goto(base + "/" + path);
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  if (overflow) throw Error("Horizontal overflow: " + path);
}
console.log("Mobile widths passed");
console.log("Browser errors:", errors);
if (errors.length) throw Error(errors.join("\n"));
await browser.close();
