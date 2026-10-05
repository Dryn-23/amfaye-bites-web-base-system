# Amfaye Bites

**Freshly Baked. Freshly Blended.**

A working customer ordering website and staff POS for pastries and fruit shakes. Built with **React + Vite + Node.js + Express + MongoDB/Mongoose**. The production architecture is **Vercel → Render → MongoDB Atlas**.

> **School-project prototype:** Demo GCash is a simulation, not a payment integration. No real money, mobile number, PIN, password, OTP, SMS, or financial information is collected by the demo payment screen. Business contact details and a real pickup location have deliberately not been invented.

## Features

- Original green-and-cream responsive storefront, self-hosted fonts and product images.
- Public home, searchable/sortable menu, pastry/shake categories, product details, promotions, story and contact-information pages.
- Registration, email/username login, logout, profile editing and password changes.
- Persistent guest cart; authenticated MongoDB cart with account-specific local recovery. Guest items merge into the account cart on login.
- Small/medium/large shake sizes, five sugar levels, three ice preferences and five add-ons, with live price updates.
- Authenticated checkout, promotion codes, cash-at-pickup and simulated GCash.
- Customer-owned order history, order tracking, printable order summaries and paid receipts.
- Staff POS with cash amount/change validation and demo payment simulation.
- Admin dashboard, order workflow, product/category management, recipe editor, inventory history/adjustments, customers, sales, CSV reports, users and read-only system settings.
- Independent admin and cashier permissions enforced by the backend.
- MongoDB transactions for orders, stock, payments, sales and receipts. Conditional stock writes prevent overselling. Idempotency keys prevent duplicate orders when the same request is retried.
- Server-calculated prices and discounts; client-supplied totals are never trusted.
- Password hashing, short-lived JWTs with revocation versioning, input validation, rate limits, exact-origin CORS and Helmet HTTP headers.

### Scope and business rules

1. Pickup only; there is no delivery service or real online payment gateway.
2. Guests may build a bag; signing in is required before checkout and placing an order.
3. Online cash orders reserve stock immediately and are paid by staff at pickup. Pending orders do not automatically expire; staff must cancel abandoned orders to release stock.
4. Online demo-paid orders also reserve stock immediately. Cancelling an eligible demo order voids its simulated sale/payment and restores stock.
5. Order status flow: `Pending → Confirmed → Preparing → Ready for Pickup → Completed`. Cancellation is allowed only from Pending or Confirmed. Completed orders cannot be edited.
6. Cash-paid orders cannot be cancelled through this system. **Real cash refunds, accounting reconciliation, taxes/VAT, statutory receipt compliance and advanced return workflows are outside this school demo.** Receipts are prototype receipts, not tax invoices.
7. Product stock is a sellable-serving limit; recipes track ingredients separately. Both must be sufficient. Ingredient restocking does not automatically manufacture/increase product servings.
8. Products are archived, not physically deleted, to preserve historical references. An archived product remains visible as unavailable and can be re-enabled by editing it. Categories cannot be removed while products reference them.
9. Reports include simulated payments and are not real financial statements. Product revenue is gross before order discounts; the sales summary is net of discounts and excludes voided sales.
10. Admin Settings displays deployment configuration; it does not expose secrets or pretend to save server settings. Change those settings through environment variables/source configuration.
11. Collections use bounded list responses for a school-scale dataset: latest 200 orders/history entries, 500 users/customers and 500 sale-detail rows. Sales summaries aggregate all matching sales. Large commercial deployments need pagination, archival and additional operational hardening.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, JavaScript, HTML5, CSS3, React Router, Fetch API, Lucide icons |
| Backend | Node.js, Express, JavaScript ES modules |
| Database | MongoDB; Mongoose schemas, references, validation, indexes and transactions |
| Authentication | bcrypt (12 rounds), JWT HS256, role middleware |
| Validation/security | Zod, Helmet, CORS, express-rate-limit |
| Tests | Node test runner, Supertest, real temporary MongoDB replica set, Playwright Chromium |
| Deployment | Vercel frontend, Render API, MongoDB Atlas production database |

No relational database, Firebase, Supabase or alternative production database is used.

## Project Structure

```text
amfaye-bites/
├── frontend/
│   ├── package.json, package-lock.json
│   ├── index.html, vite.config.js, vercel.json, .env.example
│   ├── public/
│   │   ├── hero.png
│   │   ├── products/                  # Bundled images, not hotlinked
│   │   └── fonts/                     # Self-hosted DM Sans/Manrope + licenses
│   ├── tests/browser.mjs
│   └── src/
│       ├── main.jsx, App.jsx, styles.css
│       ├── components/                # Navbar, Sidebar, ProductCard/Modal,
│       │                              # Cart, DemoPayment, Footer, guards, states
│       ├── pages/                     # All customer pages
│       │   └── admin/                 # Dashboard, POS, Orders, Manage CRUD,
│       │                              # Products, Categories, Inventory,
│       │                              # Customers, Sales, Reports, Users, Settings
│       ├── services/api.js            # Single Fetch/API configuration point
│       ├── context/                   # AuthContext, CartContext
│       └── utils/currency.js
├── backend/
│   ├── package.json, package-lock.json, .env.example
│   ├── server.js                      # Normal local and production entry point
│   ├── app.js                         # Express app; importable for tests
│   ├── demo.js                        # Development-only temporary MongoDB
│   ├── config/database.js
│   ├── models/                        # All 18 named model entry points
│   │   └── index.js                   # Central schema registry
│   ├── controllers/                   # Auth, product, order, inventory, payment
│   ├── routes/                        # Auth/products/categories/orders/inventory/
│   │                                  # payments/users/reports + auxiliary APIs
│   ├── middleware/                    # Authentication, role and error handling
│   ├── services/                      # Transactional ordering, report aggregation
│   ├── seed/seedDatabase.js            # Non-destructive/idempotent seed
│   ├── tests/api.test.js
│   └── utils/                         # Password hashing, JWT, validation
├── README.md
├── TESTING.md
├── ASSETS.md
├── package.json
└── .gitignore
```

Shared API calls, forms and model definitions are deliberately consolidated instead of creating unused service/controller stubs. All imports resolve to actual files. The named model files re-export models from one registry to prevent circular registration issues. Order items are validated embedded snapshots in the Order schema rather than a separate collection.

### MongoDB model design

- `User`, `Role`, `CustomerProfile`: identities, permissions and profile references.
- `Category`, `Product`, `ProductCustomization`, `ProductAddon`: catalog and options.
- `Cart`: unique cart per user with referenced products and selections.
- `Order`: immutable priced item snapshots, inventory usage snapshots, state and idempotency key.
- `Payment`, `Sale`, `Receipt`: unique order references; transactionally created on payment.
- `DemoOTPSession`: hashed demo code, owner, expiry, attempt count, verified/used flags; TTL index.
- `Ingredient`, `ProductRecipe`, `InventoryTransaction`: stock and traceable adjustments.
- `Promotion`: unique code, active flag, optional expiration and percentage discount.
- `AuditLog`: actor, event, entity and optional event data.

Indexes cover unique emails/usernames, category names, promotion codes, cart ownership, order numbers, `(user, idempotencyKey)`, report dates, order lookup, inventory history and OTP expiry. Historical item prices/names remain unchanged after a catalog edit.

## Requirements

1. Node.js **20.19+** (Node 22 LTS recommended) and npm.
2. Git, a terminal, and a modern browser.
3. **MongoDB Atlas** or MongoDB Community Server 7+ configured as a **replica set**. Transactions do not work on a standalone MongoDB server.
4. For deployment: your own GitHub, MongoDB Atlas, Render and Vercel accounts.
5. For tests/temporary demo: internet access on the first run to download MongoDB. Linux may require OpenSSL/shared libraries. Playwright requires its Chromium browser and OS dependencies.

Do not use `npm run demo` as a production service. It uses an actual temporary MongoDB process, not a mock database, but its data is intentionally disposable.

## Local Installation

1. Download/extract this project, or clone your own repository:
   ```bash
   git clone YOUR_GITHUB_REPOSITORY
   cd amfaye-bites
   ```
2. Install dependencies:
   ```bash
   npm run install:all
   ```
3. Choose a database: Atlas is the simplest way to get transaction support; follow **MongoDB Atlas Setup**. For an offline/local database, follow **MongoDB Local Setup**.
4. Copy the backend environment template:
   ```bash
   cp backend/.env.example backend/.env
   ```
   PowerShell equivalent:
   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```
5. Edit `backend/.env`, configuring your connection string, a generated JWT secret and your own seed admin password. Never commit this file.
6. Seed the database:
   ```bash
   cd backend
   npm run seed
   npm run dev
   ```
7. Open a second terminal:
   ```bash
   cd amfaye-bites/frontend
   npm run dev
   ```
8. Open `http://localhost:5173`. API: `http://localhost:5000/api/health`.
9. Sign in using the seed admin email/password you configured. New public registrations always create customer accounts.

### Fast disposable classroom preview (no Atlas credentials needed)

1. Install backend/frontend dependencies as above.
2. In `backend`, run `npm run demo`.
3. Wait for the MongoDB download and seed. The terminal prints a newly generated temporary admin password and `admin@amfayebites.demo`.
4. In `frontend`, run `npm run dev` and open `http://localhost:5173`.
5. Use the printed credentials for the staff portal, or register a customer.
6. Stopping/restarting the demo recreates the database. **It does not preserve orders or accounts.** For persistent data, use `npm run dev`/`npm start` with your local replica set or Atlas.

The live workspace preview supplied with this project uses this disposable mode. Temporary preview credentials are delivered separately, not committed to source.

## MongoDB Local Setup

MongoDB transactions require a replica set even on one machine. A bare URI such as `mongodb://127.0.0.1:27017/amfaye_bites` is only usable for ordering when the server it points to has been initialized as a replica set.

1. Install MongoDB Community Server and `mongosh` using the official instructions for your operating system: https://www.mongodb.com/docs/manual/installation/.
2. Stop another MongoDB service already occupying port 27017, or use a different port consistently.
3. Create a data directory outside the Git repository. Example:
   ```bash
   mkdir -p "$HOME/amfaye-mongodb-data"
   mongod --dbpath "$HOME/amfaye-mongodb-data" --replSet rs0 --bind_ip 127.0.0.1 --port 27017
   ```
   Keep this terminal running. On Windows, create a folder such as `C:\amfaye-mongodb-data` and provide that path to `mongod.exe --dbpath` with the same replica-set/port flags. Add MongoDB's `bin` folder to PATH if needed.
4. In a second terminal, initialize the replica set once:
   ```bash
   mongosh "mongodb://127.0.0.1:27017" --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
   ```
5. Check `rs.status()` in mongosh. Wait for the member to become PRIMARY.
6. Set in `backend/.env`:
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/amfaye_bites?replicaSet=rs0
   ```
7. Run `npm run seed`, then `npm run dev` from `backend`.
8. Confirm `MongoDB connected: amfaye_bites` in the backend terminal.

This loopback-only local example has no database authentication and must not be exposed to a public network. **Production uses MongoDB Atlas**, not this local database.

## MongoDB Atlas Setup

Atlas is the production database provider for this project. Your Atlas account password is NOT the database-user password.

1. Create/sign into an account at https://www.mongodb.com/cloud/atlas/register.
2. Create an Atlas **project**, for example `Amfaye Bites`.
3. Choose **Build a Database / Create Deployment**. Choose a supported cluster tier (a free option, if available, is suitable for a school demonstration), cloud provider and region near your backend. Wait until deployment is ready.
4. Open **Database Access** and create a **database user** with a strong unique password. Give it `readWrite` access to `amfaye_bites` (not unnecessary organization/admin privileges). Store this password privately.
5. Open **Network Access**. For local development, add your current public IP address. For Render, add the outbound IP addresses/ranges listed for your Render service. Atlas must permit the network from which the backend connects.
6. Avoid `0.0.0.0/0` for a permanent deployment. If you temporarily use it to diagnose a classroom connection problem, use strong unique database credentials and immediately restrict the allowlist afterward.
7. In your deployment, click **Connect → Drivers**. Select Node.js and copy the application connection string.
8. Replace the username and password placeholders with your DATABASE user credentials. URL-encode special characters in the password. Never paste credentials into React, an issue, a screenshot or a committed file.
9. Put `amfaye_bites` after the hostname and before `?`:
   ```env
   MONGODB_URI=mongodb+srv://USERNAME:URL_ENCODED_PASSWORD@CLUSTER.mongodb.net/amfaye_bites?retryWrites=true&w=majority
   ```
10. Save this URI only in `backend/.env` locally, or Render's backend environment variables when deployed.
11. From the local backend, run `npm run seed` and `npm run dev`.
12. Look for `MongoDB connected: amfaye_bites`, then open `http://localhost:5000/api/health`.
13. In Atlas **Browse Collections**, inspect the `amfaye_bites` database. Seeded `users`, `products`, `categories`, `ingredients` and recipes should be present. Place a test order and confirm `orders`, `inventorytransactions`, and, after payment, `payments`, `sales` and `receipts`.

The backend calls `mongoose.connect(process.env.MONGODB_URI, { dbName: 'amfaye_bites', ... })`. Atlas provides a replica-set deployment suitable for the multi-document transactions used here.

## Environment Variables

### Backend `.env`

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/amfaye_bites?replicaSet=rs0
JWT_SECRET=GENERATE_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
JWT_EXPIRES_IN=1d
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
DEMO_PAYMENTS_ENABLED=true
SEED_ADMIN_EMAIL=YOUR_ADMIN_EMAIL
SEED_ADMIN_PASSWORD=YOUR_UNIQUE_ADMIN_PASSWORD_AT_LEAST_12_CHARACTERS
```

Generate a secret in a terminal:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the generated output into `JWT_SECRET`. The server refuses missing, short or template secrets. `SEED_ADMIN_*` are only needed during initial seed and can be removed afterward. Do not use a real GCash password as an application password.

### Frontend development

`frontend/.env` is optional locally because Vite proxies `/api` to the backend:

```env
VITE_API_URL=/api
```

Frontend deployment needs an absolute HTTPS API URL. **Every Vite variable is public client-side configuration.** Never add a database URI, database password or JWT secret to Vite variables.

## Backend Setup

1. Enter `backend` and run `npm install` (or `npm ci` with the committed lockfile).
2. Configure `.env` and start your database.
3. Run `npm run seed` once. It inserts missing records and preserves existing data; it does not reset stock or change existing passwords.
4. Development: `npm run dev` (nodemon).
5. Production-style startup: `npm start` (node server.js).
6. Server listens on `process.env.PORT || 5000`, bound to `0.0.0.0`.
7. Verify `/api/health` returns:
   ```json
   {"success":true,"message":"Amfaye Bites API is running"}
   ```
8. An initial database connection failure exits the server with a readable configuration message. A disconnected running API returns HTTP 503 with a generic database-unavailable message, never a stack trace or URI.

## Frontend Setup

1. Enter `frontend` and run `npm install` (or `npm ci`).
2. Run `npm run dev` to open Vite on port 5173.
3. Leave backend port 5000 running. The browser calls relative `/api` URLs locally; Vite forwards them. The user's browser never needs to call a sandbox's localhost API directly.
4. Build production files with `npm run build`.
5. `npm run preview` serves the generated files; when using that preview without a development API proxy, configure `VITE_API_URL` to the accessible backend URL before building.
6. Fonts and product assets are bundled in `public`, so the deployed storefront does not require external image/font CDNs at runtime.

## GitHub Setup

1. Create an empty GitHub repository under your own account. Copy its HTTPS or SSH repository URL.
2. In the local `amfaye-bites` folder, check `.gitignore` contains:
   ```gitignore
   node_modules/
   .env
   .env.local
   dist/
   ```
   This project also ignores other secret `.env.*` files, except safe `.env.example` templates.
3. Run:
   ```bash
   git init
   git add .
   git status
   ```
4. **Before committing**, inspect staged files. No `.env`, credentials, node_modules, test screenshots, MongoDB data or build directories should be staged.
5. Continue:
   ```bash
   git commit -m "Initial Amfaye Bites system"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPOSITORY
   git push -u origin main
   ```
6. Replace `YOUR_GITHUB_REPOSITORY` with the URL copied from GitHub, not the Render or Vercel URL.
7. If a secret was ever committed, remove it from history and rotate it immediately. Adding `.gitignore` later does not remove a leaked secret from history.

## Render Deployment

### Production architecture

```text
Customer browser
      │ HTTPS
      ▼
Vercel — React + Vite frontend
      │ HTTPS API requests (VITE_API_URL)
      ▼
Render — Node.js + Express backend
      │ Private backend MONGODB_URI, TLS/SRV connection
      ▼
MongoDB Atlas — amfaye_bites production database
```

Only the backend connects to the database. The browser never receives the Atlas URI.

1. Push the complete project to GitHub using the previous section.
2. Sign in to https://render.com and select **New → Web Service → Connect GitHub repository**.
3. Authorize repository access and select your Amfaye Bites repository.
4. If the repository root contains `frontend/` and `backend/`, set:
   ```text
   Runtime: Node
   Root Directory: backend
   Build Command: npm install
   Start Command: npm start
   Health Check Path: /api/health
   ```
   If you committed an outer folder containing `amfaye-bites/`, use `amfaye-bites/backend` instead. Prefer putting this project's contents at the repository root.
5. Select a region and service plan appropriate to the demonstration. Check current Render plan limits; sleeping instances may delay the first request.
6. Add backend environment variables in Render:
   ```env
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/amfaye_bites?retryWrites=true&w=majority
   JWT_SECRET=YOUR_GENERATED_SECURE_SECRET
   JWT_EXPIRES_IN=1d
   FRONTEND_URL=https://YOUR-ACTUAL-VERCEL-DOMAIN.vercel.app
   DEMO_PAYMENTS_ENABLED=true
   ```
   Until Vercel has deployed, this origin is a placeholder. Replace it with the exact real origin afterward. Use `true` for a school demo only; `false` disables the simulated payment API.
7. Do not set the production start command to `npm run dev` or `npm run demo`. Render provides `PORT`; the app respects it. Do not assume the public service is on port 5000.
8. Configure Atlas database access and allow the Render service's outbound IP addresses as described in the next connection section.
9. Click **Create Web Service** and wait for deployment. Read logs: first `MongoDB connected: amfaye_bites`, then `Server running on port ...`.
10. Copy the ACTUAL Render URL, for example `https://your-service.onrender.com`.
11. Open `https://YOUR-RENDER-URL.onrender.com/api/health`. Confirm the successful JSON response.
12. Seed Atlas once. You can use your local backend with `.env` temporarily pointing to that Atlas database and your local IP allowlisted, then run `npm run seed`. Alternatively use a Render shell/one-off job if your plan supports it. Configure `SEED_ADMIN_EMAIL` and a strong `SEED_ADMIN_PASSWORD` for that seed process only.
13. Remove seed credentials from the deployed environment once the admin has been created. Subsequent seeds do not change the existing admin password. Do not seed on every production startup.
14. Connected GitHub deployments can automatically redeploy on pushes. Verify your selected branch and automatic deployment settings in Render.

## Vercel Deployment

1. Push the frontend and `frontend/vercel.json` to GitHub.
2. Sign in to https://vercel.com. Choose **Add New → Project** and import your GitHub repository.
3. Configure:
   ```text
   Root Directory: frontend
   Framework Preset: Vite
   Install Command: npm install
   Build Command: npm run build
   Output Directory: dist
   ```
4. Under **Environment Variables**, add:
   ```env
   VITE_API_URL=https://YOUR-ACTUAL-RENDER-URL.onrender.com/api
   ```
   Copy the hostname from Render. Include `/api`, omit a trailing slash, and use HTTPS. Apply to the appropriate production/preview environments.
5. Do NOT add `MONGODB_URI`, `JWT_SECRET` or `SEED_ADMIN_PASSWORD` to Vercel frontend variables.
6. Click **Deploy**. Wait for the Vite build to finish.
7. Copy the actual Vercel production URL, for example `https://your-amfaye-project.vercel.app`.
8. Visit the home/menu pages. Refresh `/menu`, `/login`, `/register`, `/orders` and `/admin/pos` directly. The SPA rewrite must serve `index.html` so React Router can handle those paths.
9. The included `frontend/vercel.json` uses a catch-all SPA rewrite:
   ```json
   {"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}
   ```
10. If you change `VITE_API_URL`, **redeploy/rebuild the frontend**. Vite embeds it at build time; changing a dashboard value does not modify an already generated JavaScript bundle.

## Connecting Vercel to Render

1. Copy the service URL from **Render**, append `/api`, and paste it into **Vercel → Project Settings → Environment Variables → VITE_API_URL**.
2. Redeploy Vercel after setting/changing it.
3. Copy the stable production URL from **Vercel**, without any path or trailing slash.
4. Set **Render → Environment → FRONTEND_URL** to that exact origin.
5. Save/redeploy the Render service if prompted.
6. Open the Vercel website and use browser Network tools to confirm successful HTTPS requests to the Render `/api/products` endpoint.
7. Register a test customer, sign in, place a demo order and verify it from the staff portal.

## Connecting Render to MongoDB Atlas

1. Open your **Atlas project** and database deployment.
2. Create/verify the database user under **Database Access**, with `readWrite` on `amfaye_bites`.
3. Open the Render service's connection/network information and copy its outbound IP addresses/ranges.
4. Add these addresses under **Atlas → Network Access**.
5. From **Atlas → Connect → Drivers → Node.js**, copy the SRV connection string.
6. Substitute the database username and URL-encoded password. Set the database name to `amfaye_bites`.
7. Paste it into **Render → Environment → MONGODB_URI**:
   ```env
   MONGODB_URI=mongodb+srv://USERNAME:URL_ENCODED_PASSWORD@CLUSTER.mongodb.net/amfaye_bites?retryWrites=true&w=majority
   ```
8. Save/redeploy. Verify the Render logs report a successful connection and `/api/health` returns success.
9. Place a demo order from Vercel and inspect it in Atlas Browse Collections. This is the final end-to-end proof that all three services are connected.

## CORS Configuration

- Express uses the exact origins in `FRONTEND_URL`, not unrestricted `*`.
- Local default: `http://localhost:5173`.
- Production: the exact `https://YOUR-APP.vercel.app` origin, without a trailing slash.
- Multiple explicitly trusted origins may be comma-separated, e.g. a production domain and a specific staging domain. Do not allow arbitrary Vercel subdomains or arbitrary request origins.
- New Vercel preview-deployment origins are not implicitly trusted; add only those you intentionally need.
- Authentication uses an `Authorization: Bearer ...` header rather than cross-site cookies. CORS is a browser access control, not a replacement for JWT and server-side role checks.
- The Vite development proxy uses a backend-only localhost target. Browser-facing production code always uses `VITE_API_URL`.

## Production Environment Variables

| Where | Key | Copy/generate from |
|---|---|---|
| Render | `PORT` | Provided by Render runtime; app has 5000 fallback |
| Render | `MONGODB_URI` | Atlas Connect → Drivers; substitute database user/password |
| Render | `JWT_SECRET` | Generate randomly locally; keep private |
| Render | `JWT_EXPIRES_IN` | `1d` or your chosen supported duration |
| Render | `FRONTEND_URL` | Exact Vercel production origin |
| Render | `NODE_ENV` | `production` |
| Render | `DEMO_PAYMENTS_ENABLED` | `true` only for the school simulation |
| Seed process only | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Your own initial admin credentials |
| Vercel | `VITE_API_URL` | Actual Render service URL with `/api` |

The GitHub repository URL is only for source control and service imports; it is not an API or database URL.

## Admin Setup

1. Configure a unique `SEED_ADMIN_EMAIL` and a password of at least 12 characters in the private backend environment.
2. Run `npm run seed` from `backend` after the database is reachable.
3. Sign in with your configured email/password (or username `admin` on a newly seeded database).
4. The seeder only creates the account if its email does not exist; it never silently elevates a registered customer or resets an existing password.
5. Open `/admin`. Admins see dashboard, POS, orders, customers, products, categories, inventory, sales, reports, users and settings.
6. In **Users → Add user**, create cashier accounts. Cashiers can use POS, manage orders/collect pickup cash, and view inventory/history. They cannot edit inventory/catalog, view customer lists/reports or manage users.
7. User permission changes/disable actions invalidate that user's previous tokens. The current admin cannot disable/demote themselves through this screen.
8. Remove seed credentials after setup. Rotate the initial password using Profile → Change password.
9. Customer registration cannot select a role; customer API requests to staff endpoints return 403 even if someone manually types an admin URL.

## Demo GCash

1. Select **Demo GCash** at customer checkout or in the POS payment dialog.
2. Read **“Demo Payment — No real money will be transferred.”**
3. The phone interface displays a read-only placeholder `09XX XXX XXXX`. It does not collect an actual mobile number.
4. Continue to the simulated code screen and follow the Demo OTP steps below.
5. After verification, submit the order. The backend records a `Demo GCash` payment marked `isDemo: true` and creates a demo sale and receipt.
6. This project does not connect to GCash, send SMS or use payment-provider credentials. The screen is an independently styled simulation, not an official GCash interface.
7. Set `DEMO_PAYMENTS_ENABLED=false` to disable demo OTP generation and payment acceptance. A real payment integration would require a separate provider implementation and a security review; never repurpose the demo code flow for real payments.

## Demo OTP

1. The API generates a random six-digit demo code. It returns the code to the same demo screen so **Show Demo OTP** can display the simulated Messages app.
2. The database stores only a SHA-256 digest of this code plus the user, expiry, attempts and verified/used flags.
3. The simulated message states: **“This is a demo code. No real SMS was sent.”**
4. Enter the displayed demo code and click Verify. Never enter an actual bank or wallet OTP.
5. Codes expire after 5 minutes. The backend allows at most five verification attempts and binds each session to its authenticated owner.
6. A successful verification shows **“Demo verification successful!”**
7. The verified session is consumed exactly once inside the order transaction. It cannot be used to pay for another order.
8. Request a new demo code if the session expires. This mechanism is intentionally visible and provides no real-world financial authentication.

## POS Usage

1. Sign in as admin/cashier and open `/admin/pos`.
2. Search or filter the product grid. Disabled cards cannot be ordered.
3. Click a product, choose quantity and shake options, then add it to the current order.
4. Enter an optional customer name. POS walk-in orders are owned by the processing staff account, not silently linked to a registered customer.
5. Adjust quantities or remove a line with the minus button when its quantity is one; clear the order with the trash button.
6. Enter a valid promotion code such as seeded `SWEET10` for 10% off. The backend validates the promotion and final pricing.
7. Choose **Continue to payment → Cash**. Enter amount received. Change updates automatically; an amount below the total cannot be submitted.
8. Or choose Demo GCash and complete the simulated code flow.
9. Complete the order. A successful POS order is marked Completed and Paid, with transactionally updated stock, payment, sale and receipt records.
10. Click **View receipt → Print receipt**. Browser print CSS hides navigation and UI controls.
11. For online cash orders, open **Orders → Collect cash**, record payment, then progress the order to Completed after Ready for Pickup. The backend rejects completion while unpaid.

## Inventory

1. Open Admin → Inventory. Each ingredient shows unit, current/minimum stock, purchase cost, supplier and optional expiry.
2. Add an ingredient with opening stock. Opening stock is recorded in history.
3. To restock, use **Adjust**, enter a positive number and reason. For usage, waste or correction, enter a negative number. Negative resulting stock is rejected.
4. Editing an ingredient changes metadata, not stock. Use Adjust for stock changes so there is always an inventory history entry.
5. `stock <= minimumStock` displays **Low Stock**; zero stock displays **Unavailable**.
6. In Products, set sellable servings separately. Product availability also reflects recipe ingredient sufficiency/expiry in the catalog.
7. In Products, click the book icon to edit the recipe. Define ingredient consumption per base/small serving. Medium shakes scale non-piece ingredients by 1.25 and large shakes by 1.5; units `pc` (cups, straws, packaging) do not scale with size. Add-ons deduct their own configured ingredients.
8. Each order re-checks current product availability and quantities, ingredient sufficiency and ingredient expiration inside a MongoDB transaction.
9. If any product or ingredient fails validation, the entire order/stock/payment transaction rolls back. Concurrent orders cannot consume the same last serving twice.
10. History shows order deductions, opening stock, manual adjustments and cancellation restores with actor, reason and remaining balance. The stored order usage snapshot ensures cancellation restores the original quantities, even after a recipe edit.
11. Seeded recipes, serving yields, ingredient units and costs are illustrative. Review them against actual recipes before any real operation. Sugar/ice choices are saved preferences; the sample recipe does not vary sugar/ice quantities for each preference.

## Testing

### Automated backend tests

```bash
cd backend
npm install
npm test
```

These tests start a separate real temporary MongoDB replica set, seed it, run 16 integration scenarios, and shut it down. They do not use your `.env` Atlas database. First execution downloads a MongoDB binary. See `TESTING.md` for detailed coverage and results.

### Frontend production build

```bash
cd frontend
npm run build
```

### Real browser smoke test

Run the disposable API and Vite servers first. Then:

```bash
cd frontend
npx playwright install --with-deps chromium
DEMO_ADMIN_PASSWORD='THE_PASSWORD_PRINTED_BY_DEMO_SERVER' npm run test:browser
```

PowerShell:

```powershell
$env:DEMO_ADMIN_PASSWORD="THE_PASSWORD_PRINTED_BY_DEMO_SERVER"
npm run test:browser
```

Optional: `DEMO_ADMIN_EMAIL` (default `admin@amfayebites.demo`) and `TEST_BASE_URL` (default `http://localhost:5173`). Use a test/demo database; browser tests create disposable customers and orders. Do not run blindly against a live business database.

The test exercises guest customization/cart, login redirection, registration, customer demo-GCash checkout, receipt view, admin login, cash POS payment, all admin pages and mobile overflow checks.

### Deployment testing checklist — perform after deploying

- [ ] Frontend: home, menu/search/categories, product details, promotions, story, contact.
- [ ] Direct-route refresh: `/menu`, `/login`, `/register`, `/checkout`, `/orders`, `/profile`, `/admin`, `/admin/pos`, `/admin/products`.
- [ ] Backend HTTPS health, products, categories and auth/login endpoints.
- [ ] Atlas connection from Render and documents created in `amfaye_bites`.
- [ ] Registration, duplicate registration error, correct/incorrect login, logout, expired/revoked token.
- [ ] Customer APIs cannot access admin data or another customer's order.
- [ ] Guest browsing and cart, login requirement for ordering, profile/password update.
- [ ] Shake size/sugar/ice/add-ons, dynamic price, quantity limits, cart persistence.
- [ ] Cash pickup order appears for customer and staff, stock deducted once.
- [ ] Order transitions; cash collection required before completion.
- [ ] Cash POS rejects underpayment; change and receipt are correct.
- [ ] Demo OTP visible, wrong/expired code rejected, successful verification, single-use payment.
- [ ] Product create/edit/archive, category create/edit/delete protections, recipe update.
- [ ] Ingredient stock adjustment/history, low/zero stock, expired ingredient rejection.
- [ ] Concurrent last-item purchase cannot oversell; cancellation restores stock exactly once.
- [ ] Reports/CSV include paid orders and exclude voided demo sales.
- [ ] Desktop/tablet/mobile layouts, readable forms, product modals, printer output.
- [ ] MongoDB-unavailable/API-unavailable responses are user-friendly.
- [ ] Vercel → Render CORS succeeds for the real production origin.
- [ ] Complete a production-URL demo order and verify its order/payment/inventory documents in Atlas.

**Verified here:** local real MongoDB transactions, API integration tests, Vite build and Chromium flows. **Not verified here:** your Atlas connection or actual Render/Vercel deployments. Those require your accounts, network configuration and secrets; do not mark them passed until you run the checklist.

## Troubleshooting

### Frontend cannot connect to backend

1. Confirm Render `/api/health` responds.
2. Check Vercel `VITE_API_URL` uses the actual Render HTTPS URL plus `/api`.
3. Redeploy Vercel after changing variables. Never use localhost as a deployed browser API URL.
4. Locally, keep backend on port 5000, or update Vite's backend proxy target if you deliberately change the port.
5. A sleeping Render service may need a warm-up request; inspect service logs before retrying.

### CORS error

1. Compare the browser's exact origin against Render `FRONTEND_URL`.
2. Remove a trailing slash/path, check HTTPS, and distinguish a preview domain from the stable production domain.
3. Save/redeploy the API. Do not fix it by allowing every origin.

### MongoDB connection error

1. Check `MONGODB_URI` formatting, including `mongodb+srv://` for Atlas and `amfaye_bites` as database name.
2. Use the database-user credentials, not the Atlas website account password.
3. URL-encode special password characters.
4. Check Atlas Network Access for your local/Render outbound IPs and verify the cluster is running.
5. Never paste the full secret URI into public logs or issue reports.

### “Transaction numbers are only allowed on a replica set member or mongos”

1. You are connected to a standalone local MongoDB server.
2. Restart MongoDB with `--replSet rs0`, initialize the replica set, and use the replica-set URI in this guide.
3. Alternatively use Atlas. Do not remove transaction protections to hide the error.

### Render cannot start server

1. Set Root Directory to `backend`, not `frontend`.
2. Verify build `npm install` and production start `npm start` (`node server.js`).
3. Configure a valid `JWT_SECRET` of at least 32 random characters and a working Atlas URI.
4. Server uses Render `PORT` and `0.0.0.0`. Check health path `/api/health` and logs.
5. `mongodb-memory-server` belongs to development/testing and is not used by production startup.

### React routes show 404 on Vercel

1. Verify root directory `frontend`, output `dist`, and committed `frontend/vercel.json`.
2. Redeploy and refresh `/menu` directly.
3. Do not point a React Router URL at the API service.

### Environment variable not working in React

1. Frontend variables need the `VITE_` prefix.
2. Read them with `import.meta.env.VITE_API_URL`; this is centralized in `src/services/api.js`.
3. Restart Vite locally or rebuild/redeploy Vercel.
4. Do not expose backend secrets with the `VITE_` prefix.

### Empty menu or no admin login

1. Run the seeder against the SAME database the backend uses.
2. Seed admin credentials must be configured and the password must be at least 12 characters.
3. Existing seed users are preserved; re-running the seed does not reset a forgotten password.
4. Temporary `npm run demo` data disappears on restart. Use the newly printed password, not a previous one.

### Out-of-stock despite available product servings

1. Check the recipe's ingredient stock and expiration dates.
2. Check size scaling/add-on ingredient requirements.
3. Restock with an audited adjustment; do not just increase product servings.
4. Product prices/stock are revalidated at submission; the displayed cart estimate may be stale if staff edited the catalog.

### Demo verification fails

1. Check `DEMO_PAYMENTS_ENABLED=true` on the API.
2. Use Show Demo OTP, not a real wallet code.
3. Request a new code after five minutes, five incorrect attempts, or a completed payment.
4. A session belongs only to the account that created it.

### Browser/test binary download problems

1. Test/demo mode downloads MongoDB only on first use. Ensure outbound network access and a supported OS/OpenSSL installation.
2. For Chromium, run `npx playwright install --with-deps chromium` from frontend (OS dependencies may require administrative permission).
3. Use an existing local replica set/Atlas for normal development if binary download restrictions prevent the optional temporary demo.

### Security and operational notes before real-world use

- This is a functional school prototype, not a claim of audited commercial/payment compliance.
- JWTs are held in browser local storage for this prototype. This requires strong XSS hygiene; React escapes text and the app does not render user HTML. Consider a hardened same-site HttpOnly-cookie session architecture and CSRF protections for a commercial deployment.
- Logout/password/role changes invalidate token versions server-side. Tokens otherwise expire after the configured duration.
- Add a production frontend CSP, TLS-only operation, centralized monitoring, backup/restore procedures, email verification/password recovery, staff MFA, a shared rate-limit store for multi-instance hosting, pagination and refund controls before real use.
- Do not use sample images, recipes, supplier costs, allergen statements or demonstration sales as verified business facts. Replace them with approved business content.
- No real customer contact or financial credentials are needed to demonstrate this system. Use test identities.

See `ASSETS.md` for imagery/font details and `TESTING.md` for the delivery verification record.
