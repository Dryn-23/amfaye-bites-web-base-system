# Delivery verification

Recorded: **2026-09-24**.

## Verified in the development workspace

| Check | Result | Evidence |
|---|---|---|
| React/Vite development server | PASS | Served on 0.0.0.0:5173 with working API proxy |
| Frontend production build | PASS | `npm run build` completes; all imports resolve |
| Express development API | PASS | Health/catalog/auth/order endpoints respond on port 5000 |
| Normal production-style entry point | PASS locally | Automated child process starts `node server.js` in production mode on port 5051 and serves health using a test replica set |
| Real MongoDB connectivity | PASS locally | MongoDB 7.0.24 single-member replica set, not mocked storage |
| Backend integration tests | **16/16 PASS** | `backend/tests/api.test.js` |
| Chromium customer flow | PASS | Customize mango shake → guest bag → login redirect → registration → demo OTP/payment → receipt |
| Chromium cashier flow | PASS | Admin sign-in → POS item → cash amount → completed order → receipt link |
| Admin screens load | PASS | Dashboard, POS, orders, products, categories, inventory, customers, sales, reports, users and settings |
| Mobile overflow smoke checks | PASS at 390px | Home/menu/cart/about/promotions/POS have no horizontal document overflow |
| Browser JavaScript errors | NONE in tested flows | Playwright pageerror collection |
| Dependencies | No audit vulnerabilities reported at installation | `npm install` audits; rerun before deployment |

### Backend scenario coverage

1. Public catalog/categories/health, invalid IDs and unauthenticated guards.
2. Registration, bcrypt hashes, duplicate rejection, username login, wrong password, injected role rejection.
3. Customer denial on administrative endpoints and customer POS spoof rejection.
4. Cart persistence and invalid quantity validation.
5. Server-authoritative pricing, transactional stock deductions, idempotency, own-order access and cancellation restoration.
6. POS underpayment rejection/rollback, promotion discount, cash change, payment/sale/receipt creation.
7. Shake size/add-on pricing, customization snapshot, user-bound demo OTP, wrong-code rejection, one-time use and cancellation voiding.
8. Concurrent purchase of the last product serving: exactly one succeeds, stock never goes negative.
9. Insufficient/expired ingredients roll back product and order writes.
10. Pickup order transitions, unpaid completion rejection, cash collection and duplicate collection prevention.
11. Product/category create/update/archive, category dependency protection, recipe update.
12. Inventory adjustment history, insufficient-stock adjustment rejection and report aggregation.
13. Cashier creation/permissions and account-disable token invalidation.
14. Profile update, password hashing/change, old-token revocation and logout revocation.
15. Expired/forged JWT rejection and safe HTTP 503 during a simulated disconnected-database state.
16. Normal server startup with environment variables, production-mode entry point and health check.

The API tests create an isolated database and do not modify a user's configured Atlas deployment. The disconnected-database response test explicitly simulates the connection state; it is not a live Atlas outage test.

## Not tested / requires the project owner's deployment

- Authentication to the owner's actual MongoDB Atlas project.
- Atlas database-user permissions and IP access rules.
- Actual deployment/rebuild on Render or Vercel accounts.
- Vercel direct-route rewrites as deployed on the owner's domain.
- HTTPS/CORS connectivity between the owner's Vercel and Render deployments.
- Render-to-Atlas production network/TLS connection.
- Registration, authentication and ordering at the actual production URLs.
- Physical receipt-printer output, printer margins and real store procedures.
- Real financial processing, refunds, tax compliance or any real GCash integration (not implemented by design).
- Comprehensive accessibility/security audit, load testing or multi-instance operational certification.

**No claim of a completed cloud deployment is made.** Follow README's numbered setup steps and check off its deployment test list only after running it against your own services.

## Reproduce

```bash
# In the project root
npm run install:all
npm test
```

For browser checks, start `npm run demo` in backend and `npm run dev` in frontend, then run frontend `npm run test:browser` with the temporary admin password in `DEMO_ADMIN_PASSWORD`. See README for Chromium installation and PowerShell commands. The browser test writes test customers/orders; only run it against a disposable development database.
