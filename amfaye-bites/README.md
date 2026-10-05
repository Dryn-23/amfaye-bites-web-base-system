# amfaye-bites

Bakery system — React 19 (Vite) frontend + Express + Mongoose backend.

## Stack
- Frontend: React 19 + react-router-dom + lucide-react + Vite (`npm run dev` at `localhost:5173`; proxy `/api` → `:5000`)
- Backend: Express + Mongoose 8 + MongoDB Atlas (URI in `.env`)
- Tests: `node --test` + supertest + MongoMemoryReplSet (works even when standalone `seed/seedDatabase.js` times out)

## Endpoints (mounted /api)
- Auth: `/register`, `/login`, `/me`, `/logout`, `/profile`, `/password`
- Orders: `/orders` (post with `idempotencyKey`; put `/:id/status` — staff/admin only; cancellation restores inventory; `amountReceived` enforces cash collection rules)
- Products / categories / inventory / bundles / flash sales / add-ons
- Reports (admin only): `/reports/sales`, `/reports/products`, `/reports/inventory`, `/reports/categoryPerformance`, `/reports/peakHours`, `/reports/paymentMethods`, `/reports/monthlyComparison`, `/reports/cashDrawer` (D — cash drawer by cashier; expected = received − change)
- Promotions (`extraRoutes`): `GET /promotions` (public, active/unexpired), `POST/PUT/DELETE /promotions` (admin, `code` uppercased, `percent` 1-50, `expiresAt` datetime), `GET /promotions/all` (admin)
- Reviews (`reviewRoutes`): paginated `GET /admin`, `PUT /admin/:id` (audit + rate limit via `ReviewRateBucket`), customer eligibility requires completed+paid web order
- Payments / demo OTP / cart / notifications / chats / prep queue / users / settings

## Features completed this session
- D: Cash drawer / shift summary (`cashDrawer`) + `ShiftReport.jsx`; expected drawer = Σ(received − change), demo GCash excluded, voided excluded
- F: Vite `build.rollupOptions.output.manualChunks = { vendor: ["react","react-dom","react-router-dom"] }` — vendor 52 KB separate, main 760 KB; true deferred loading requires route-level `React.lazy()` (not done — offered follow-up)
- G: Promotion endpoint tests — CRUD validation, code uppercasing, percent/datetime bounds, 404 on unknown id, `useCount` incremented on checkout redemption (`SWEET10`), inactive/expired/unknown codes refused at order creation; 56 tests pass
- E: Review moderation already wired (routes + audit + rate limit + ManageReviews page); verified complete — nothing built

## Environment / build
- `PORT=5000`; `MONGODB_URI`; `JWT_SECRET`; `FRONTEND_URL` (default `http://localhost:5173`); `VAT_RATE` (default `0.12`); `DEMO_PAYMENTS_ENABLED=true`; seed email/password configurable via `.env`
- `npm test` from `backend/`; `npm run build` from `frontend/` (`vite build` produces split chunks)
- Cash math invariant (`orderService.js`): `vat = round(subtotal * VAT_RATE)`; `total = round(subtotal − discount + deliveryFee + vat)`; `change = round(received − total)`

## Notes
- `manualChunks` alone does not defer downloading — admin chunk still loaded statically via `App.jsx`; full deferral needs `import()` + `React.lazy()` per admin route
- Flash-sale / DB seeding blocked on standalone script (Mongo connection timeout); tests use `MongoMemoryReplSet` which works

Co-Authored-By: Claude Code <noreply@anthropic.com>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
