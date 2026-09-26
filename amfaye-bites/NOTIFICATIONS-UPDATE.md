# Amfaye Bites — Customer Order Notifications

## What was added

- A notification bell beside the account/cart controls for signed-in **customers**.
- A badge showing the number of unread notifications.
- A notification dropdown showing the latest 50 updates, their order number, status and time.
- A visible popup when a new order/status notification arrives while the website is open.
- Click a notification or **View my order** to open the related order and mark that notification as read.
- **Mark all as read**, refresh, dismissal and keyboard Escape support.
- Automatic order-details refresh when a new notification is detected.
- Read/unread state saved in MongoDB, so it survives reloads and works across devices.
- Server-side ownership checks: a customer cannot view or mark another customer's notifications.
- Notification writes occur in the same MongoDB transaction as the order/status update.
- No SMS, email, browser permission prompt, third-party provider or extra environment variables.

### Status messages

| Order status | Notification |
|---|---|
| Pending | We've received your order |
| Confirmed | Your order is confirmed |
| Preparing | A little happiness is in the making |
| Ready for Pickup | Your order is ready for pickup! |
| Completed | Order completed. Thank you! |
| Cancelled | Your order was cancelled |

These are status notifications, not proof of payment. The existing rule still requires staff to collect cash before completing an unpaid order.

## Important: your live site is not automatically updated

The code is updated in the supplied workspace/ZIP. This does **not** change your GitHub repository, Render account or Vercel deployment automatically. Publish the changed files below to update your live website.

## Install the update without losing your brown theme

The ZIP is a **partial update**, not a standalone application. It intentionally excludes `frontend/src/styles.css`, images, package files and `.env` files. The new notification CSS uses your existing `--green`, `--green-dark`, `--light`, `--cream` and other theme variables; if you changed those values to brown, notifications inherit that brown palette too.

1. Download `amfaye-bites-notifications-update.zip` and extract it.
2. Back up your existing project (or commit your current changes to Git).
3. Inside the extracted `amfaye-bites-notifications-update` folder, locate `backend` and `frontend`.
4. Copy their files into the matching **existing** `backend` and `frontend` folders of your project. Merge the folders; replace matching files. **Do not delete your existing folders or upload only the partial ZIP as a new project.**
5. Leave your existing `.env`, brown `styles.css`, product images and deployment settings alone.
6. If you previously modified any of the five replacement source files listed below beyond the supplied base project, merge the new notification additions rather than discarding your own edits. A `notification-changes.patch` file is supplied as an optional review aid for Git users.

### New source files

```text
backend/models/Notification.js
backend/services/notificationService.js
backend/routes/notificationRoutes.js
frontend/src/components/NotificationBell.jsx
frontend/src/components/notifications.css
```

### Existing source files updated

```text
backend/models/index.js              # Exports the Notification model
backend/services/orderService.js     # Persists notification within order transactions
backend/app.js                       # Registers /api/notifications routes
frontend/src/components/Navbar.jsx   # Renders the customer bell
frontend/src/pages/MyOrders.jsx      # Reacts to newly received status notifications
```

### Included test files

```text
backend/tests/api.test.js            # Adds notification integration coverage
frontend/tests/notifications.mjs     # End-to-end notification browser test
```

No database reset or re-seed is needed. Mongoose creates the new `notifications` collection/indexes. Existing accounts, orders, payments and stock are preserved. Notifications start when a new order is placed or an existing order changes status **after this backend update**. Historical transitions are not backfilled.

## Push to GitHub

From your existing repository folder:

```bash
git status
git add backend/app.js backend/models/index.js backend/models/Notification.js backend/services/orderService.js backend/services/notificationService.js backend/routes/notificationRoutes.js backend/tests/api.test.js frontend/src/components/Navbar.jsx frontend/src/components/NotificationBell.jsx frontend/src/components/notifications.css frontend/src/pages/MyOrders.jsx frontend/tests/notifications.mjs
git diff --cached --stat
git commit -m "Add customer order status notifications"
git push origin main
```

If the repository has an outer `amfaye-bites` folder, prefix those paths with `amfaye-bites/`, or run the commands inside that folder. Confirm no `.env` or credentials are staged.

If using GitHub's browser uploader instead: open the matching folder in your repository and use **Add file → Upload files**, preserving each file's relative directory. Upload all update files before redeploying. Do not upload the ZIP file itself and expect Render/Vercel to extract it.

## Deploy both services

### Render — backend first

1. Open your active service: `amfaye-bites-web-base-system-1`.
2. If auto-deploy is enabled, wait for the deployment triggered by the commit. Otherwise select **Manual Deploy → Deploy latest commit**.
3. Keep the existing backend root directory and `npm start` command.
4. Keep `FRONTEND_URL` set to your exact frontend origin, for example:
   ```env
   FRONTEND_URL=https://amfaye-bites-web-base-system-gtdy.vercel.app
   ```
5. Wait for **Live** and verify `/api/health`.
6. A direct unauthenticated visit to `/api/notifications` should return a **401 sign-in message**, not 404. That is expected: the endpoint is private.

### Vercel — frontend

1. Open your Vercel project → Deployments.
2. Confirm the new commit deployed successfully. If needed, redeploy the deployment associated with the updated commit/branch.
3. Keep your existing Vite/frontend root settings and:
   ```env
   VITE_API_URL=https://amfaye-bites-web-base-system-1.onrender.com/api
   ```
4. Once Ready, open the website and press **Ctrl + Shift + R** to load the new assets.

No new packages, secrets, API keys or environment variables are required.

## How to demonstrate it

1. Open a normal browser window and sign in as a **customer** (not the admin).
2. Place an online order. Look for the bell in the top navigation.
3. Leave the customer website visible.
4. In another browser or an incognito window, sign in as **admin** and open Orders.
5. Change that customer's order from Pending to Confirmed, then Preparing, then Ready for Pickup.
6. Return to the customer window. A new popup and unread badge should appear after the next check (normally within about 10 seconds while the page is visible).
7. Click the popup or bell entry to open the order. The read count decreases.
8. Open the bell and click **Mark all as read**. Reload to verify it stays read.
9. For Completed, first record any pending cash payment, then complete the pickup order. Cancellation notifications follow the original allowed cancellation rules.

**Why no bell on the admin screen?** This feature is for customers. Admins already manage order statuses in the staff portal. Staff-owned walk-in POS orders do not notify unrelated customers.

## Timing and limitations

- This uses lightweight polling, not WebSockets: every 10 seconds while the page is visible, and when the window regains focus or the connection comes back.
- Updates may take longer if the network is slow or a free Render service is sleeping.
- If the site/browser is closed, no popup is delivered outside the website. Updates remain stored; the customer sees unread entries when they sign in again.
- Old unread entries do not replay as popups on login/reload. The bell shows them instead.
- At most 3 popup cards appear at once; they remain until dismissed/opened. Dismissal alone does not mark a notification as read.
- The dropdown shows the latest 50 entries; its unread count includes all stored unread notifications. Mark-all clears entries up to the newest displayed timestamp, leaving later updates unread.
- Past transitions before this update are not recreated. Updating an existing order after installation will produce a notification.
- If a payment is merely recorded without a status change, this version does not send a separate payment notification.

## API additions

All require `Authorization: Bearer TOKEN` and operate only on the authenticated user's notifications.

```text
GET /api/notifications
→ { items: [...latest50], unreadCount: number }

PUT /api/notifications/:id/read
→ updated notification; 404 for an unknown or another user's notification

PUT /api/notifications/read-all
Body: { "through": "ISO timestamp of newest displayed notification" }
→ marks only the user's entries at/before that timestamp as read
```

Order statuses are server-derived; clients cannot create notifications or change their ownership through these endpoints. Transaction rollback, rejected status changes and order submission retries do not generate duplicate/false updates.

## Tests verified locally — 2026-09-26

- Backend: **17/17 integration scenarios passed**, including notification creation, each status, private ownership, read persistence, cutoff-safe mark-all, cancellation, invalid transition rollback, failed stock validation and POS exclusion.
- Frontend: `npm run build` passed.
- Chromium: actual polling delivered popups; bell count, order navigation, automatic order refresh, read-all, reload persistence, offline recovery and logout privacy passed.
- Notification menu stayed within the viewport at 360, 390, 768, 1024 and 1440 pixels.
- No browser JavaScript errors in the notification test.

To reproduce:

```bash
cd backend
npm test
# In a separate terminal, start a disposable test API with npm run demo.
# In another terminal, start frontend with npm run dev.
cd ../frontend
npx playwright install --with-deps chromium
DEMO_ADMIN_PASSWORD='YOUR_DISPOSABLE_DEMO_PASSWORD' node tests/notifications.mjs
```

Use disposable test data. The browser test creates a customer/order and changes its statuses. Your deployed notification feature has not been verified until you publish this update and run the demonstration steps above.
