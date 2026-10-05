# AMFAYE BITES — Preparation queue

A kitchen screen for admins and cashiers. Confirmed online orders move through three lanes — **To prepare → In preparation → Ready for pickup** — using your existing order statuses, notifications and permissions.

**This is a source update. Your live Render/Vercel websites have not been changed.**

## What staff see

Open **Preparation queue** in the staff sidebar, or go to `/admin/preparation`.

- **Three lanes**, oldest order first, so nothing waits at the bottom of a list.
- Each card shows order number, customer, time placed, **minutes waiting**, item quantities, shake customizations (size, sugar, ice, add-ons), customer notes, total and payment status. Cards older than 20 minutes highlight their waiting time.
- One button per card advances the order: **Start preparing**, **Mark ready**, then **Mark collected** (which asks for confirmation before completing).
- The queue **auto-refreshes every 10 seconds**, and immediately when the tab regains focus or the network reconnects. A "Last synced" line and an "Updates delayed" warning show whether the screen is current; buttons pause while updates are stalled so nobody acts on stale information.
- **Search** filters all lanes by order number or customer name. Each lane pages 8 orders at a time, so a busy day still loads quickly.
- Pending orders are **not** in the lanes. A banner counts them and links to **Orders**, keeping confirmation where it already is.

This is a view over your existing workflow — it does not create a second order system. Status changes still appear in Orders, still write audit logs and still send the existing customer notifications. Cancelling remains in Orders, deliberately kept off the kitchen screen.

### Payment safety

An unpaid order cannot be completed from the queue. Its card shows **"Collect payment before completing this order"** and links to Orders, where **Collect cash** already calculates change. This matches the existing backend rule that payment must be collected before an order is completed.

### What it does not do

- It does not schedule pickup times, promise preparation deadlines, or measure how long preparation takes. The timer counts from when the order was **placed**.
- It does not change stock, ingredients, prices, payments or receipts.
- It does not include POS walk-in sales — those are already completed at the counter.
- It has no sound alerts, printing or per-item ticking. Tell me if you want any of those next.

## Install in your existing project — PowerShell

### 1. Merge the files

Commit or back up your project first. Extract `amfaye-bites-preparation-queue-update.zip` and **merge** its `backend` and `frontend` folders into your existing project, keeping the same folder structure. Copy `install-preparation-queue.mjs` and this guide to the project root, beside `backend/` and `frontend/`.

Every file in the ZIP is new. **No existing file is overwritten**, so your customized theme, chat, images, reviews and navigation stay exactly as they are.

### 2. Run the installer

```powershell
node .\install-preparation-queue.mjs
npm test --prefix backend
npm run build --prefix frontend
```

Include **`node`** before the filename. The installer makes three small additions:

| File | Addition |
|---|---|
| `backend/app.js` | Registers the `/api/preparation` route |
| `frontend/src/App.jsx` | Adds the `/admin/preparation` page for admin and cashier |
| `frontend/src/components/Sidebar.jsx` | Adds the sidebar link |

Originals are backed up to `.preparation-update-backup/` before any change, and rerunning the installer makes no further changes. If it cannot find an expected spot in your files, it stops **without changing anything** and you can add those three lines manually.

**No new dependency is installed**, so `package.json`, `package-lock.json` and `npm install` are untouched by this update. Use Node.js 20.19+.

### 3. Deploy both services

1. Commit and push the new files plus the three edited files. Keep `.env`, credentials, `node_modules` and build output out of the commit.
2. Redeploy the **Render backend**, then the **Vercel frontend**, with your existing environment variables unchanged.
3. Hard-refresh with **Ctrl + Shift + R**, sign in as admin or cashier and open **Preparation queue**.

Copying files locally does not update your live website until you push and redeploy.

## Permissions

- **Admin and cashier** see the sidebar link, the page and the data.
- **Customers and visitors** are redirected away from the page, and `GET /api/preparation` returns **403** for them — enforced on the backend, not just by hiding the link.
- Advancing an order uses the existing staff-only status endpoint and its existing rules, so the queue cannot skip steps or bypass checks.
- Queue responses send `Cache-Control: no-store` and expose only what the kitchen needs: order number, customer name, items, note, totals, payment status and timestamps. Customer accounts, addresses and internal order fields are not included.

If two staff members advance the same order at the same time, exactly one succeeds. The other sees **"This order changed on another screen"** and the queue refreshes, so an order cannot be double-advanced or skipped.

## Verification

- **55/55 backend tests passed**, including **6 new queue tests**: role and guest access, lane contents versus pending orders, POS exclusion, stable oldest-first paging with 200+ completed orders present, escaped and case-insensitive search, rejected invalid paging, customization/note snapshots left unchanged, concurrent staff actions resolving to one winner, the unpaid-completion guard, and status changes that create the expected notifications without altering stock or inventory history.
- **Chromium queue checks passed:** pending order excluded then appearing after confirmation, auto-refresh pickup within seconds, admin and cashier on the same order from two sessions, full lane progression, payment guard, search and clear, customer blocked from the page and the API, plus 390 / 768 / 1440 px and dark mode with no page errors.
- All existing admin pages were re-checked with the queue installed and rendered without errors.
- Frontend production build passed (1,704 modules).
- **Compatibility:** starting from the original project, the installer, **22/22 backend tests** and the production build passed; starting from the original project plus the chat and image updates, the installer, **39/39 backend tests** and the build passed. Reviews and other updates are not prerequisites.
- **Honest limitation:** the older full end-to-end browser walk (`frontend/tests/browser.mjs`) could not finish in this sandbox — Chromium ran out of resources midway. The **unmodified original project failed the same way here**, and every page it covers was verified individually, so this is an environment limit rather than a regression. Please run it on your own machine after installing.

No production deployment, production database change or load test was performed. Optional browser test: `frontend/tests/preparation.mjs`, run only against a disposable local demo database, never production — it creates customers, orders and a cashier account.
