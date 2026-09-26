# Amfaye Bites — Order Protection & Product Stock Alerts

Updated: 2026-09-26. This is a working source-code update, not an automatic change to your GitHub, Render or Vercel accounts.

## 1. Temporary ordering protection

Default settings:

| Rule | Default |
|---|---|
| Customer account | Up to 5 order-submission attempts per 60-second window |
| Shared IP/network | Up to 20 customer order-submission attempts per 60-second window |
| Block duration | 5 minutes (300 seconds) |

The **6th attempt from an account**, or the **21st attempt from an IP/network**, triggers a temporary order block. These are fixed windows anchored when the counter starts/resets, not sliding-window limits.

### Customer behavior

- Checkout displays **Ordering temporarily blocked** and a minutes/seconds countdown.
- The Place Order button is disabled until the local countdown ends; the server remains the authority on whether an order may be submitted.
- Refreshing the page, clearing browser storage, obtaining a new login token or opening another browser does not bypass an account ban.
- Switching IP addresses does not bypass an account ban. Switching customer accounts on the same blocked network does not bypass an IP ban.
- The restriction applies to **placing orders**, not a permanent account suspension. Customers can normally still browse, sign in, see order status/notifications and view their existing orders. Existing general API/authentication rate limits still apply to excessive requests to those endpoints.
- After the cooldown expires, ordering becomes available automatically. No admin action is needed.
- Repeated attempts during a block do **not** extend the block deadline. Requests sent after it expires can trigger a new block if the limit is exceeded again.
- Valid JSON order requests that fail business validation (bad items, insufficient stock, invalid payment, etc.) still consume attempts. Malformed JSON/unauthenticated requests are rejected earlier and remain subject to the existing global/auth rate limits.
- Retrying the same idempotency key also consumes an attempt. Existing order idempotency still prevents duplicate order creation.

### Staff and shared-network behavior

- Authenticated **admins and cashiers are exempt** from this new customer ordering guard, so legitimate POS work is not stopped by a customer sharing the shop Wi-Fi.
- Shared Wi-Fi/NAT users can be affected by an IP-wide block caused by others on that network. This is why the IP default is higher than the account limit. Tune it for your school demonstration or expected traffic.
- IPv4-mapped addresses are normalized. IPv6 addresses are grouped by **/64** to prevent simple IPv6 privacy-address rotation from bypassing the network limit.
- The source IP is taken from Express `req.ip`, never a user-supplied JSON field. This project uses `app.set('trust proxy', 1)` for the Render reverse-proxy deployment. Verify that the nearest proxy supplies a trustworthy forwarded client address. If exposing Node directly, set trust proxy to `false`; if changing hosting/proxy topology, configure trusted proxies accordingly. Do not blindly trust arbitrary client-supplied forwarding headers. Incorrect proxy configuration can make everyone share one IP or permit spoofing.

### Persistent and concurrency-safe

- Counters and block deadlines are stored in a new MongoDB `orderguards` collection.
- Account and IP budgets are updated together in a MongoDB transaction; parallel requests cannot bypass the account allowance by racing separate counters.
- The guard transaction is separate from order creation so failed submissions still count. A request rejected by the guard never reaches order creation, stock deduction, payment, sales or notification writes.
- Expired guard documents are cleaned up by a TTL index after a safety retention period. Cooldown expiry is checked by timestamp immediately; it does not depend on the TTL cleaner running at an exact time.
- Identifier keys use an HMAC; the counter collection does not contain plaintext IP addresses or account IDs. The default HMAC key is the backend JWT secret.
- Protection survives backend restarts and works across backend instances sharing the same MongoDB database and HMAC secret. Rotating the default JWT/HMAC secret starts a new key namespace, which resets effective counters. Optionally set a separate stable `ORDER_GUARD_SECRET` if you want counters preserved across JWT-secret rotations.
- This is application-level abuse protection, not a comprehensive bot/DDoS defense. Attackers controlling multiple accounts AND unrelated networks may bypass per-identity limits. CAPTCHA/WAF, email verification and additional operational monitoring can be added for a real public business.

### Optional Render configuration

No new variables are required: defaults work automatically. To customize them, go to **Render → your backend service → Environment**:

```env
ORDER_ACCOUNT_LIMIT=5
ORDER_IP_LIMIT=20
ORDER_WINDOW_SECONDS=60
ORDER_BLOCK_SECONDS=300
```

Optional backend-only secret:

```env
ORDER_GUARD_SECRET=YOUR_SEPARATE_RANDOM_PRIVATE_SECRET
```

Do not put these secrets in Vercel or commit them to GitHub. Invalid limits revert to safe defaults; zero does not disable security. Supported ranges: account limit 1–10,000; IP limit 1–100,000; window 10–3,600 seconds; cooldown 10–86,400 seconds.

## 2. Low-stock PRODUCT visibility

This is separate from the existing ingredient-inventory alerts.

### Admin Dashboard

A new **Product stock alerts** panel shows:

- Number of **Low-stock products**.
- Number of **Out-of-stock products**.
- Product names, category, current serving stock and minimum stock.
- Links to the relevant filtered Products page.
- A manual refresh button and automatic refresh every 30 seconds while visible, plus on returning to the page.

The dashboard previews up to eight affected products. Use **View all stock alerts** to open the complete matching list in Products.

### Admin → Products

New filters:

- All products
- Low stock
- Out of stock
- All stock alerts
- Unavailable

The stock column now explicitly shows **current servings, minimum servings and the appropriate stock badge**. Use **Refresh product stock** for current values; saving an edit also refreshes the list.

Rules:

```text
0 < stock <= minimumStock → Low stock
stock <= 0               → Out of stock
stock > minimumStock     → Healthy serving stock
```

Disabled/archived products are excluded from the active low/out-of-stock alerts, but remain visible under All products and Unavailable. Unavailable also includes products with recipe ingredient shortages/expiry; serving alerts do not replace ingredient checks. Increasing serving stock alone does not replenish ingredients.

To set the threshold: **Products → pencil icon → Minimum servings → Save changes**. Restock serving counts only when actual production/restocking justifies it. Continue using Inventory adjustments for ingredient stock.

## 3. Installation — preserve your brown theme and existing data

The ZIP is a **partial update**. It does not replace `frontend/src/styles.css`, your images, `.env`, deployment configuration or database contents. The new stock panel uses your current brown/green theme variables.

This package includes the previous **customer notification update** as well, so you may install it even if you have not yet applied that earlier ZIP.

1. Back up/commit your current project.
2. Download and extract `amfaye-bites-security-stock-update.zip`.
3. Open the extracted `amfaye-bites-security-stock-update` folder.
4. Merge its `backend` and `frontend` contents into your existing matching project folders. Replace the included files, but do not delete/recreate the whole backend or frontend directories.
5. If you changed any included source file yourself (e.g. Navbar, Dashboard, Manage or API client), merge the additions with your edits rather than overwriting unrelated work. Your brown `styles.css` is not in this package.
6. Leave your private `.env` files and existing Render/Vercel variables untouched. Optional limits can be added directly in Render later.
7. No new npm dependencies, new provider account or database seed/reset is needed. Mongoose creates the new collection/indexes automatically. The existing MongoDB replica-set/Atlas transaction requirement remains.

The new API client preserves `code` and cooldown metadata in error responses. Keep its existing `VITE_API_URL` deployment behavior. Your Vercel API variable should still be the Render service URL ending in `/api`.

### New security/stock source files

```text
backend/models/OrderGuard.js
backend/services/orderGuardService.js
backend/middleware/orderGuardMiddleware.js
frontend/src/hooks/useOrderCooldown.js
frontend/src/components/ProductStockAlerts.jsx
frontend/src/components/stockAlerts.css
```

### Updated security/stock source files

```text
backend/routes/orderRoutes.js
backend/routes/productRoutes.js
backend/controllers/productController.js
frontend/src/services/api.js
frontend/src/pages/Checkout.jsx
frontend/src/pages/admin/Dashboard.jsx
frontend/src/pages/admin/Manage.jsx
```

The package also contains the previous notification source files and the updated test files. See `NOTIFICATIONS-UPDATE.md` for notification behavior and installation details; do not reapply the older ZIP afterward because it could overwrite newer files.

## 4. Deploy the update

1. Copy/merge the files into your existing local GitHub working copy.
2. From the project folder:
   ```bash
   git status
   git add backend frontend
   git diff --cached --stat
   git commit -m "Add temporary order abuse protection and product stock alerts"
   git push origin main
   ```
   Inspect staged changes and confirm no secrets, `.env`, node_modules or build files are included.
3. On **Render**, deploy the latest commit of the active backend service. Wait for Live; verify `/api/health`.
4. On **Vercel**, confirm the same updated commit builds/deploys successfully. If it does not automatically deploy, deploy the new commit through the connected production branch.
5. Refresh the website with **Ctrl + Shift + R**.
6. Open Admin Dashboard and Products to verify the new stock panel/filters.
7. Test abuse protection with a test customer and disposable data—not repeated real paid orders. You can use the included tests locally to avoid polluting live orders.

### Safe manual cooldown demo

On a separate TEST deployment, temporarily use a small account allowance and a short cooldown, e.g. `ORDER_ACCOUNT_LIMIT=2`, `ORDER_BLOCK_SECONDS=30`. Submit more than two order requests within the same minute. The next request should show a cooldown and be rejected with HTTP 429. Restore your intended limits afterward. Existing block deadlines are not shortened retroactively when changing the configured duration.

Do not change your real stock levels merely to demonstrate a warning in production. Use local/demo data instead.

## 5. API behavior

```text
POST /api/orders
  Customer allowance available → normal order processing
  Account/network blocked     → HTTP 429, Retry-After header
```

Example blocked response (values illustrative):

```json
{
  "code": "ORDER_TEMPORARILY_BLOCKED",
  "message": "Ordering is temporarily blocked because too many order attempts came from your account or network. Please wait for the cooldown to finish. You can still browse and view your orders.",
  "blocked": true,
  "blockedUntil": "2026-09-26T12:05:00.000Z",
  "retryAfter": 300
}
```

```text
GET /api/orders/guard
  Authentication required; current account/network state only.
  Returns { blocked, blockedUntil, retryAfter }.
  Does not consume an attempt or expose anyone else's identifier/counter.

GET /api/products/stock-alerts
  Admin/cashier only.
  Returns { lowStockCount, outOfStockCount, totalAlerts, items }.
```

The `guard` and `stock-alerts` routes are registered before `/:id` routes, so they are not mistaken for MongoDB IDs.

## 6. Verification

Local checks completed:

- **23/23 backend integration scenarios passed.**
- Concurrent order attempts: only the allowed number succeeds; excess requests get 429.
- Account block holds across different IPs; IP block holds across different customer accounts.
- Admin/cashier POS is exempt from this new guard.
- Failed orders count; rejected guard requests create no orders, inventory deductions or notifications.
- Cooldown does not extend on retry and expiry automatically allows requests again (expiry simulated in the integration test).
- Hashed identifier storage and IPv4-mapped/IPv6 normalization tested.
- Stock threshold equality, zero stock, disabled-product exclusion, restocking and staff authorization tested.
- Chromium checkout: real blocked response, countdown, disabled submit, persistence after reload and existing-order browsing tested.
- Chromium admin: product-stock summary and low/out-of-stock filters tested; no horizontal dashboard overflow at 360, 390, 768, 1024 or 1440 pixels.
- Vite production build passed; no JavaScript page errors during the new browser flow.

These are local tests. Your live deployment is not updated or verified until you push/deploy the changes and test the live site.

### Run tests locally

```bash
cd backend
npm install
npm test
```

For the browser test, start the disposable backend (`npm run demo`) and frontend (`npm run dev`), then:

```bash
cd frontend
npx playwright install --with-deps chromium
DEMO_ADMIN_PASSWORD='YOUR_DISPOSABLE_DEMO_ADMIN_PASSWORD' node tests/security-stock.mjs
```

PowerShell:

```powershell
$env:DEMO_ADMIN_PASSWORD="YOUR_DISPOSABLE_DEMO_ADMIN_PASSWORD"
node tests/security-stock.mjs
```

Use the default guard settings for this browser test. It creates a test customer, submits intentionally invalid order attempts to trigger a cooldown, temporarily changes two product stock counts, checks the UI, and restores those original product counts afterward. Do not run it against live business data.
