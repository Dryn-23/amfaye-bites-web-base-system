# AMFAYE BITES — Customer/admin chat update

## What is included

Order-based, text-only support chat using the existing React/Vite + Express + MongoDB application. No new npm dependencies, external chat provider, or separate server.

- **Customer:** My Orders → open an online order → **Chat with admin**. The header Messages icon opens their conversation list.
- **Admin:** **Messages** in the staff sidebar → select an order conversation → reply. Admins can also open a customer's online order and start its conversation.
- One persistent conversation per registered customer's online order. Guests, cashiers, POS orders and other customers cannot access that conversation.
- Sent/seen indicators, unread badges, order context, search, All/Open/Closed filters, conversation pagination and older-message history.
- Admins can close or reopen conversations. The owning customer can reopen for a follow-up, but cannot close.
- Plain text, up to 1,000 characters. Enter sends; Shift+Enter inserts a newline. Failed sends retain the draft, and retries with the same message ID are deduplicated.
- Light/dark and mobile layouts. Existing theme support is used if installed; chat also works without the previous theme/notification updates.

**This package is a partial update for your existing project, not a replacement project. The live Render/Vercel sites have not been changed.**

## Install without overwriting your customized colors/navigation

1. Back up or commit your existing GitHub project first.
2. Extract `amfaye-bites-chat-update.zip`.
3. **Merge** its `backend` and `frontend` folders into the matching folders of your existing project. Do not delete/replace entire directories. Copy `install-chat.mjs` and this guide into your project root, alongside `backend/` and `frontend/`.
4. From that existing project root, run:

   ```sh
   node install-chat.mjs
   npm test --prefix backend
   npm run build --prefix frontend
   ```

   If dependencies are not installed, run `npm ci --prefix backend` and `npm ci --prefix frontend` first. Node 20.19+ is required by the project.

The ZIP contains new chat feature files, tests and an optional index initializer. It deliberately does **not** replace `styles.css`, `theme.css`, Navbar, Sidebar, App, MyOrders, backend `app.js`, package manifests or `.env` files.

The installer adds only the necessary imports, links, protected routes, order action, backend router entry and error metadata to your existing integration files. It preserves your current brown palette, theme toggles, notifications and other routes. All expected insertion points are validated before integration files are written. Changed originals are backed up in `.chat-update-backup/<timestamp>/`; rerunning is safe. Review the Git diff before committing. Keep backup folders out of your commit.

If the installer reports a customized insertion point, it stops rather than overwriting your layout. Use the manual integration checklist below or send the affected source file for adjustment.

## Deploy both services

1. **Render backend first:** commit/push the merged backend files and patched `backend/app.js`. Keep the existing `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL` and production start command `npm start`. Continue using MongoDB Atlas. Do not use the disposable demo server in production.
2. Verify `/api/health` is healthy and authenticated `/api/chats` returns a conversation list rather than 404.
3. **Vercel frontend:** deploy the merged frontend files and patched frontend integration files. Keep your existing `VITE_API_URL` pointed to the Render API with `/api` at the end. Keep the SPA rewrite configuration.
4. Hard-refresh the website, then test with a customer account and an admin account in separate browsers/private windows.

No new mandatory environment variables. Optional backend setting:

```dotenv
# Default 30 chat write attempts per account per fixed minute.
CHAT_WRITES_PER_MINUTE=30
```

Supported range: 5–1200; invalid settings fall back to 30. Starting a conversation, sending a message and changing its open/closed status consume this budget. Read requests do not. A 429 response supplies a retry countdown. The existing global API limiter still applies, including to read requests, so many users sharing a network can hit that independent limit.

## Database and indexes

Atlas supports the transactions used to keep messages, sequence numbers and unread counters consistent. Local MongoDB, if used for development, must run as a replica set; a standalone server is insufficient.

The new collections are `chatconversations`, `chatmessages`, and `chatratebuckets`. Mongoose normally creates their indexes automatically with this project's existing configuration. To explicitly create/verify the declared indexes before enabling chat, run from `backend/` with your backend environment configured:

```sh
node scripts/init-chat.js
```

This command creates declared indexes; it does not seed, reset, drop collections or run `syncIndexes`. Required unique indexes enforce one conversation per order, one sequence per conversation, and one message per conversation/sender/client retry ID. Rate bucket documents have a TTL cleanup index; chat messages do **not** expire automatically. Include the new collections in your normal Atlas backups and define a retention policy appropriate to your school project.

## Privacy and behavior

- Backend authorization uses the authenticated account, not customer IDs supplied by the browser. Non-owners receive a not-found response. Cashiers are denied chat access.
- Authorized admins share one inbox and **one admin-side read state**. “Seen” means the other side has opened/fetched the thread; it is not an individual-admin or guaranteed-attention receipt.
- Active threads poll every **5 seconds**; inboxes/badges every **10 seconds** while the tab is visible. This is polling, **not instant WebSocket chat**. Render cold starts or connection failures can delay updates.
- No attachments, push notifications, email alerts, audio, guest chat, customer-to-customer chat or automatic replies.
- Chat is ordinary authenticated HTTPS application traffic, **not end-to-end encrypted**. Store no passwords, PINs, real OTPs or financial credentials in messages.
- Chat never changes order status, inventory or payment status. Staff must continue using the normal order/payment controls. Existing Demo GCash behavior is unchanged.
- Messages are plain text rendered as text, not HTML. There is no edit/delete feature in this release.

## Manual integration checklist

Use these only if the automatic installer cannot recognize a customized file. Preserve existing imports and routes.

1. `Navbar.jsx`: import `ChatNavLink` from `./ChatNavLink`; add `<ChatNavLink />` inside header `nav-actions`. It renders only for customers.
2. `Sidebar.jsx`: import the same component; add `<ChatNavLink staff />` inside the sidebar navigation. It renders only for admins. Do not also add a duplicate ordinary Messages link.
3. `MyOrders.jsx`: import `OrderChatButton` from `../components/OrderChatButton`; add `<OrderChatButton order={data} />` in the order-detail panel, using your actual loaded order variable if renamed.
4. `App.jsx`: import `Messages` from `./pages/Messages`. Inside the storefront layout, add:
   ```jsx
   <Route path="messages/:chatId?" element={<ProtectedRoute roles={["customer"]}><Messages /></ProtectedRoute>} />
   ```
   Inside the existing `/admin` layout, add:
   ```jsx
   <Route path="messages/:chatId?" element={<ProtectedRoute roles={["admin"]}><Messages /></ProtectedRoute>} />
   ```
5. `backend/app.js`: import `chats` from `./routes/chatRoutes.js`; add `chats` to the existing router registry, so it mounts at `/api/chats` after the existing JSON/CORS/database middleware and before the 404 handler.
6. `frontend/src/services/api.js`: retain the existing thrown error's `status: res.status`; include `code: data.code` and `retryAfter: data.retryAfter` in its metadata so the composer can show the server-supplied countdown.

## Verification performed

- **31/31 backend tests passed** on real temporary MongoDB replica sets, including 8 chat scenarios covering authentication/ownership, uniqueness, retry deduplication, concurrent sends, unread/read races, close/reopen permissions, pagination, search, throttling and unchanged stock/order/payment state.
- **Chromium browser flow passed:** customer starts from order details, admin replies, polling updates both sides, seen/unread badges, close/reopen, failed-send retry with retained draft, literal HTML-like text, light/dark layouts and widths 360–1440px. No JavaScript page errors. A narrow-header overflow found during testing was fixed.
- Production frontend build passed.
- Installer tested against the original pre-theme/pre-notifications source: installation, idempotent rerun and frontend build passed. The previous updates are not required for chat.

The browser test is `frontend/tests/chat.mjs`. Run it only against a **disposable demo API and local Vite server**, with `DEMO_ADMIN_PASSWORD` matching that test server. It creates a test customer, order and messages; never aim it at production. Chat history pagination was tested through the API, not through the browser test. No production deployment, production-data migration or large-scale load testing was performed.
