# Amfaye Bites REST API

Base path: `/api`. Requests and responses are JSON. Authenticated endpoints require `Authorization: Bearer TOKEN`. The frontend API client supplies this header automatically.

Error shape: `{"message":"User-friendly explanation"}`. Common statuses: 400 invalid data/payment, 401 missing/expired/revoked login, 403 forbidden, 404 missing record, 409 duplicate or stock/state conflict, 429 rate limit, 503 database unavailable.

## Roles

- Public: no account needed.
- Customer: owns their cart/orders/profile.
- Staff: admin or cashier.
- Admin: administrative management only.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API/database readiness |
| POST | `/auth/register` | Public, rate-limited | Register customer |
| POST | `/auth/login` | Public, rate-limited | Email/username login |
| GET | `/auth/me` | Authenticated | Safe user details |
| POST | `/auth/logout` | Authenticated | Revoke user's current token version |
| PUT | `/auth/profile` | Authenticated | Change own name/phone |
| PUT | `/auth/password` | Authenticated | Check current password, change password, revoke old tokens |
| GET | `/products` | Public | Catalog with computed availability |
| GET | `/products/:id` | Public | Single catalog record |
| POST | `/products` | Admin | Create product |
| PUT | `/products/:id` | Admin | Replace editable product fields |
| DELETE | `/products/:id` | Admin | Archive product |
| GET | `/categories` | Public | Categories |
| POST | `/categories` | Admin | Create category |
| PUT | `/categories/:id` | Admin | Update category |
| DELETE | `/categories/:id` | Admin | Delete only if unused |
| GET | `/addons` | Public | Active shake add-ons |
| GET | `/promotions` | Public | Active, unexpired offers |
| POST | `/promotions` | Admin | Create offer |
| GET | `/cart` | Authenticated | Own cart |
| PUT | `/cart` | Authenticated | Replace own cart's validated item selections |
| POST | `/orders` | Authenticated | Authoritative order/payment/inventory transaction |
| GET | `/orders` | Authenticated | Customer's own orders; staff sees all; optional `status` |
| GET | `/orders/:id` | Owner or staff | Order, payment and receipt references |
| PUT | `/orders/:id/status` | Staff | Validated state transition |
| POST | `/payments/demo-otp` | Authenticated | Create user-bound demo session/code |
| POST | `/payments/demo-verify` | Authenticated | Verify simulated code |
| POST | `/payments/cash` | Staff | Collect cash for pending online cash order |
| GET | `/inventory` | Staff | Ingredients |
| POST | `/inventory` | Admin | Ingredient + opening history |
| PUT | `/inventory/:id` | Admin | Ingredient metadata, not stock |
| POST | `/inventory/:id/adjust` | Admin | Atomic adjustment + history/audit |
| GET | `/inventory/history` | Staff | Recent history; optional `ingredient` ID |
| GET | `/recipes/:id` | Admin | Product recipe (`id` is product ID) |
| PUT | `/recipes/:id` | Admin | Validated ingredient recipe |
| GET | `/customers` | Admin | Customer accounts without hashes |
| GET | `/users` | Admin | User accounts without hashes |
| POST | `/users` | Admin | Create staff/customer account |
| PUT | `/users/:id` | Admin | Update role/active, revoke tokens |
| GET | `/reports/sales` | Admin | Paid sales, net summary and daily aggregation |
| GET | `/reports/products` | Admin | Sold quantities and gross item revenue |
| GET | `/reports/inventory` | Admin | Low-stock ingredients |
| GET | `/settings` | Admin | Safe read-only system configuration |

Report `from` and `to` query parameters accept `YYYY-MM-DD`; `to` includes that day in Asia/Manila time. Bounded result sizes are documented in README.

## Request examples

### Registration

```json
{
  "name": "Demo Customer",
  "email": "demo@example.com",
  "phone": "09123456789",
  "username": "democustomer",
  "password": "YOUR_TEST_PASSWORD",
  "confirmPassword": "YOUR_TEST_PASSWORD"
}
```

Registration always creates a customer even if a role is injected. Login body:

```json
{"login":"demo@example.com","password":"YOUR_TEST_PASSWORD"}
```

Login/register response: `{ "user": { ...safeFields }, "token": "..." }`.

### Cart

```json
{
  "items": [
    {
      "product": "PRODUCT_OBJECT_ID",
      "quantity": 2,
      "customization": {
        "size": "Medium",
        "sugar": "50%",
        "ice": "Less Ice",
        "addons": ["ADDON_OBJECT_ID"]
      }
    }
  ]
}
```

Identifiers in these examples are placeholders; replace them with real 24-character MongoDB ObjectIds from the API. Quantity must be 1–99, at most 50 lines. Do not send UI-only product objects to the API.

### Customer cash-at-pickup order

```json
{
  "items": [{"product":"PRODUCT_OBJECT_ID","quantity":1}],
  "source": "web",
  "paymentMethod": "Cash",
  "promoCode": "SWEET10",
  "notes": "Demo order only",
  "idempotencyKey": "YOUR_UNIQUE_UUID"
}
```

No `amountReceived` is permitted on a web cash order. The customer cannot mark it Paid. The API returns the persisted Order with server-computed subtotal, discount and total.

### POS cash order

Use `source: "pos"`, `paymentMethod: "Cash"`, `amountReceived: 500` and optional `customerName`. Staff auth is required. The cash amount must cover the calculated total.

### Demo GCash

1. `POST /payments/demo-otp` with `{}` returns `{sessionId,demoCode,message,expiresIn}`.
2. Display `demoCode` ONLY in the clearly labeled simulated Messages interface.
3. `POST /payments/demo-verify` with `{"sessionId":"...","code":"123456"}`.
4. Create the order with `paymentMethod: "Demo GCash"` and `otpSession: "SESSION_OBJECT_ID"`.
5. The session must belong to the current user, be unexpired, verified and unused. Consumption occurs in the same transaction as the order.

### Cash pickup collection

```json
{"order":"ORDER_OBJECT_ID","amountReceived":500}
```

### Order status

```json
{"status":"Preparing"}
```

Only permitted transitions succeed. Cash collection is required before completing an unpaid order. Cancellation has explicit restoration/void rules; see README.

### Inventory adjustment

```json
{"delta":10,"reason":"Supplier delivery"}
```

Negative values deduct; zero or negative resulting stock is rejected.

### Recipe

```json
{"ingredients":[{"ingredient":"INGREDIENT_OBJECT_ID","quantity":0.15}]}
```

### User permission update

```json
{"role":"cashier","active":true}
```

Current admins cannot change their own permissions. This endpoint invalidates the changed user's prior tokens.

## Integrity notes

- Product names, unit prices, add-on labels and customization choices are stored as order item snapshots.
- Online order stock is reserved at placement, not deducted again on confirmation or pickup.
- Product and ingredient conditional writes are retried/rolled back through Mongoose transactions.
- The frontend carries one order idempotency key through retries. New orders require new keys.
- Demo paid-order cancellation voids simulated sales; cash refunds are intentionally unsupported.
- JWTs never contain password hashes or database credentials. Admin responses do not expose password hashes either.
