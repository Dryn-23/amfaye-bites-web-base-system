# AMFAYE BITES — Verified-purchase reviews

This update adds **reviews only**. Pickup scheduling, order again, the preparation queue and favorites are not included yet.

Built from the existing workspace project. **Your live Render and Vercel deployments have not been changed.** This is a partial update, not a replacement project.

## Features

- Customers give **1–5 stars** and a **5–1,000 character comment**.
- Backend checks for the signed-in customer's own **Completed + Paid online order containing that product**. Pending, cancelled, unpaid, voided, POS, guest/staff-owned and other customers' orders do not qualify.
- **One review per customer per product**, enforced by a MongoDB unique index. Customers can edit their review; repeated submissions do not create extra reviews.
- A chosen **public display name** (2–40 characters) is shown instead of account/contact details. The default is “Verified customer”; no real name is automatically copied into the public review.
- Product cards and product dialogs show average ratings/counts and link to the full review page. Full reviews are on `/products/:id/reviews`, with a rating distribution and paginated comments.
- Completed, paid order details show **Review [product]** links.
- Admin sidebar **Reviews** opens `/admin/reviews`: All/Visible/Hidden filters, pagination and hide/restore actions.
- Hiding/restoring requires a reason, saved with the action in the audit log. The owner can see the reason. Hidden reviews are excluded from public comments, counts and averages.
- Customer edits do **not** unhide a moderated review. An admin must restore it.
- Plain text only, mobile layouts and existing light/dark theme support. No new dependencies or external review service.

## Install — Windows PowerShell

### 1. Back up first

Commit your current project or make a backup. Extract `amfaye-bites-reviews-update.zip`.

**Merge** the extracted `backend` and `frontend` folders into the matching folders of your existing project. Do not delete or replace entire folders. Copy `install-reviews.mjs` and this guide into the existing project root, alongside `backend/` and `frontend/`.

The package deliberately does not replace your `styles.css`, `theme.css`, package manifests, `.env`, App, Sidebar, product components or order page. The installer patches the integration points in your current files instead, preserving existing colors, chat, notifications and other navigation.

### 2. Run the installer using Node

From your existing project root:

```powershell
node .\install-reviews.mjs
```

**Include `node` at the beginning.** Do not type `install-reviews.mjs` alone in PowerShell.

If dependencies are missing:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
```

Then verify:

```powershell
npm test --prefix backend
npm run build --prefix frontend
```

Use Node.js 20.19+ as required by the existing project. Tests use a disposable local MongoDB replica set, not your Atlas production database; the first test run may download a MongoDB binary.

The installer checks all expected insertion points before writing integration changes. Changed originals are backed up under `.reviews-update-backup/<timestamp>/`. Rerunning is safe. Keep that backup folder out of your Git commit.

If an insertion point was customized beyond recognition, the installer stops rather than replacing your layout. Use the manual checklist below or send the affected file for adjustment.

### 3. Commit and deploy BOTH services

1. Review your Git changes. Commit the new feature files **and** the existing files changed by the installer. Do not commit `.env`, credentials, `node_modules`, build output or backup folders.
2. Push to your GitHub deployment branch.
3. Deploy the backend on **Render first** using the existing root `backend` and `npm start` command. Keep the existing Atlas URI, JWT secret and exact frontend CORS origin.
4. Verify the backend health endpoint. `/api/reviews/summary` should return a JSON array, initially `[]` if there are no reviews, rather than a 404.
5. Deploy the frontend on **Vercel**, keeping the current `VITE_API_URL`, root `frontend`, build command and SPA rewrite.
6. Hard-refresh the website with **Ctrl + Shift + R**.

Running the installer on your computer does not update the live website. No new environment variables are required.

## How to use

### Customer

1. Sign in and place an online order.
2. Staff collect/verify payment and complete the order through the normal existing controls.
3. Open **My Orders → that completed order → Review [product]**.
4. Select stars, choose a public nickname and write a comment.
5. Click **Publish review**. Return to the same product's reviews page to **Save changes** later.

Customers with earlier qualifying orders can review them too; no backfill or database reset is needed. One review covers a product, not every order, size or add-on combination.

### Visitor

Click the rating or “No reviews yet” link on a product card, or the rating link in the product dialog, to read reviews. Visitors cannot submit reviews until signed in with a qualifying customer purchase.

### Admin

Open **Reviews** in the sidebar. Use Hide/Restore with a specific, respectful reason. **A low rating alone is not grounds for hiding a review.** The software records moderation; it cannot automatically judge whether an admin's reason is fair.

The moderation inbox and full review pages have a **Refresh** button. Product rating summaries are shared across cards and refresh approximately every 30 seconds while visible; the saving browser invalidates its summaries after review/moderation changes. Another browser may briefly show its previous rating summary.

## Database and security

New collections: `reviews` and `reviewratebuckets`. Existing `auditlogs` stores moderation actions.

Mongoose normally creates indexes with this project's default configuration. You can explicitly initialize declared indexes from `backend/`, using the existing backend environment:

```powershell
node .\scripts\init-reviews.js
```

This creates declared indexes without seeding/resetting your database, dropping collections or running `syncIndexes`. The `product + customer` unique index is required. Rate-bucket TTL indexes clean up temporary counters; reviews do not auto-expire. Include reviews in your Atlas backups.

Keep **MongoDB Atlas** in production. Moderation and its audit record are transactional; local MongoDB, if used, must be a replica set rather than a standalone server.

Additional safeguards:

- Backend role and order ownership checks—not only hidden frontend buttons.
- Per-account **10 review write attempts per fixed minute**, covering submission/edit/moderation, with MongoDB-backed counters and HTTP 429/Retry-After. Reads remain available under this limiter; the existing global API limiter still applies.
- Public review responses contain only review ID, rating, comment, chosen display name, dates and verified-purchase marker—not customer/order IDs, phone numbers or emails.
- Plain text is rendered as text, not interpreted as HTML.
- Reviews never update order status, inventory, totals or payment state.

Please avoid putting phone numbers, addresses, passwords, PINs or real OTPs in reviews or display names. This version has no automatic profanity/spam classifier, photo uploads, replies, helpful votes, deletion UI or full revision-history archive. Moderation actions are audited; ordinary customer text edits overwrite the prior text. Eligibility is checked when writing; reviews are not automatically removed if an order is later changed outside the normal workflow.

## Manual integration checklist

Only use this if the installer cannot recognize a customized file. Keep existing imports and features.

1. **Backend `app.js`:** import `reviews` from `./routes/reviewRoutes.js`, then add `reviews` to the existing router registry so it mounts at `/api/reviews` before the 404 handler.
2. **Frontend `App.jsx`:** import `Reviews` from `./pages/Reviews` and `ManageReviews` from `./pages/admin/Reviews`. Add inside the storefront layout:
   ```jsx
   <Route path="products/:id/reviews" element={<Reviews />} />
   ```
   Inside the existing `/admin` layout:
   ```jsx
   <Route path="reviews" element={<ProtectedRoute roles={["admin"]}><ManageReviews /></ProtectedRoute>} />
   ```
3. **`ProductCard.jsx`:** import default `ProductRating` from `./ReviewLinks`; render `<ProductRating product={product._id} />` after the description, outside the product's buttons.
4. **`ProductModal.jsx`:** import the same `ProductRating`; render `<ProductRating product={p._id} />` below the product title, using your actual product variable if renamed.
5. **`MyOrders.jsx`:** import `{ OrderReviewLinks }` from `../components/ReviewLinks`; render `<OrderReviewLinks order={data} />` inside the order-detail panel. This component shows links only for eligible customer orders.
6. **`Sidebar.jsx`:** import `{ ReviewNavLink }` from `./ReviewLinks`; render `<ReviewNavLink />` inside the navigation. The component renders only for admins.

The review components import their own additive stylesheet; no global CSS replacement is needed. Reviews do not require installing chat, notifications or the theme update first.

## Verification performed

- **40/40 backend tests passed** on the current cumulative workspace project, including **9 review-specific tests**: eligibility, ownership/roles, validation, concurrent uniqueness, edits, public privacy, audited moderation, hidden-edit protection, averages, pagination, rate limits and unchanged stock/order/payment state.
- **Chromium browser tests passed:** unpaid eligibility message; completing/paying an order through normal APIs; starting from order detail; publish/edit; failed-send draft retention; public reading; admin hide/restore; hidden edits; product-card/dialog links; light/dark layouts at 360–1440px; no page errors.
- Production frontend build passed.
- Installer tested against the original pre-chat/pre-theme project: install, idempotent rerun, frontend build and **25/25 backend tests** passed.
- Review pagination was tested through the API, not through the browser test. No production deployment or large-scale load test was performed.

Optional browser test: `frontend/tests/reviews.mjs`. Run only against disposable local Vite/demo servers, with `DEMO_ADMIN_PASSWORD` matching that temporary server. It creates a customer, order, payment and review—**never run it against production**.
