# Amfaye Bites — Dark Mode Update

## Where to use it

- **Admin:** Settings → Appearance → **Light**, **Dark**, or **System**.
- **Customers / staff:** Profile → Appearance offers the same controls. Existing permissions for admin Settings have not changed.
- No Save button is required; changes apply immediately.

**Light** keeps your existing theme, including the brown colors you customized in `styles.css`.

**Dark** uses warm charcoal/chocolate backgrounds, light text, and caramel highlights across the dashboard, POS, tables, forms, modals, storefront, cart, checkout, notifications and stock-alert panels. Product photos are not inverted.

**System** follows the device/browser light-or-dark preference and responds if it changes while the site is open.

The choice is saved in this browser's local storage (`ab-theme`), persists after refresh/logout, and synchronizes across open tabs on the same website origin. It is **not a global business setting** and does not change other devices/users' screens. People sharing the same browser profile share this local preference. Clearing browser site storage resets it to Light. If storage is blocked, the choice still applies for that visit and the UI explains that it cannot save.

An early, same-origin script applies a saved preference before React renders to reduce light flashing. Printed receipts stay white with dark text even when the screen is in dark mode.

## Download and install

`amfaye-bites-dark-mode-update.zip` is a **frontend-only partial update** for your existing Amfaye Bites project. It does not contain a standalone app.

1. Back up or commit your current work.
2. Extract the ZIP.
3. Open the extracted `amfaye-bites-dark-mode-update` folder and merge its `frontend` contents into your existing `frontend` folder. Do not delete your existing frontend folder.
4. Replace only the matching included source files. If you have independently edited one of those files, merge the additions rather than discarding your changes.
5. Your brown `frontend/src/styles.css`, images, `.env`, backend, notification/security source files and database are not replaced by this package.
6. No additional npm packages, environment variables, database seed, migration or backend deployment are needed for this feature.

### New files

```text
frontend/src/context/ThemeContext.jsx
frontend/src/components/AppearanceSettings.jsx
frontend/src/theme.css
frontend/public/theme-init.js
frontend/tests/theme.mjs
```

### Existing files updated

```text
frontend/src/main.jsx
frontend/src/pages/admin/Settings.jsx
frontend/src/pages/Profile.jsx
frontend/index.html
```

This patch works with the existing project whether or not you have applied the earlier notification/security updates. It does not install those earlier features by itself; it also does not remove them if they are already installed.

### If you customized index.html or main.jsx

Keep your existing title, metadata and other customizations. The index change is just this line near the end of `<head>`:

```html
<script src="/theme-init.js"></script>
```

It is a normal same-origin bootstrap script; do not add `async`/`defer` if you want it to apply before the app renders. Keep your existing module script for `src/main.jsx`.

In `main.jsx`, import the provider and theme stylesheet:

```jsx
import { ThemeProvider } from "./context/ThemeContext";
import "./styles.css";
import "./theme.css";
```

Wrap the existing BrowserRouter/AuthProvider/CartProvider tree with `<ThemeProvider> ... </ThemeProvider>`. Preserve existing providers and error handling. The supplied `main.jsx` is already wired correctly for the generated project.

Settings and Profile import and render `<AppearanceSettings />`. It is outside the server-settings loading/error branch, so the appearance choice remains usable if the business-settings API is unavailable.

## Deploy to your live website

**Your live Vercel website has not been changed automatically.** To publish:

1. Copy/merge the update files into your local repository.
2. From the project folder containing `frontend`:
   ```bash
   git status
   git add frontend/src/main.jsx frontend/src/context/ThemeContext.jsx frontend/src/components/AppearanceSettings.jsx frontend/src/theme.css frontend/src/pages/admin/Settings.jsx frontend/src/pages/Profile.jsx frontend/public/theme-init.js frontend/index.html frontend/tests/theme.mjs
   git diff --cached --stat
   git commit -m "Add Light Dark and System appearance settings"
   git push origin main
   ```
   If your repository contains an outer `amfaye-bites` folder, run the commands inside that folder or prefix the paths appropriately. Never stage private `.env` files.
3. In **Vercel → your project → Deployments**, wait for the deployment of the new commit. If auto-deploy is disabled, deploy the updated production branch.
4. Keep your existing Vite root directory, `VITE_API_URL`, build command `npm run build`, and output `dist`.
5. Once Ready, refresh your website with **Ctrl + Shift + R**.
6. Sign in as admin → Settings → Appearance → Dark.
7. Reload, visit POS/Menu and check that the chosen mode remains active.

Only the frontend needs rebuilding for this change. No Render settings need changing. Your GitHub integration may still trigger a backend deployment automatically; that is not required by the theme feature.

If a custom frontend Content Security Policy is configured, it must allow the same-origin `/theme-init.js` script. Do not weaken the policy to allow arbitrary scripts. Vercel should serve this file as JavaScript from the `public` assets, not as the SPA HTML fallback.

## Verification performed locally

- Vite production build passed.
- Light, Dark and System selection passed in Chromium.
- Original light-theme color variable remains unchanged after switching back from Dark.
- Choice persists after reload/logout and synchronizes with another open tab.
- System mode responds to live OS/browser preference changes; an explicit Dark choice does not get overridden by a light device preference.
- Native keyboard radio selection works.
- Appearance controls work when `/api/settings` returns an error.
- Early bootstrap applies a saved dark preference with React deliberately paused.
- Blocked local-storage writes display an honest session-only notice rather than crashing or pretending to save.
- Settings have no horizontal overflow at 360, 390, 768, 1024 or 1440 pixels.
- Dashboard/POS/products/inventory/orders/customer pages use dark surfaces; form foreground/background colors and a product modal were checked.
- A demo POS receipt renders white with black heading text under print media.
- No browser page JavaScript errors in the theme test.

These are local tests, not a claim that the update is already deployed to your live domain.

### Re-run the browser test

Use disposable development data. Start backend `npm run demo` and frontend `npm run dev`, then in `frontend`:

```bash
npx playwright install --with-deps chromium
DEMO_ADMIN_PASSWORD='YOUR_DEMO_ADMIN_PASSWORD' node tests/theme.mjs
```

PowerShell:

```powershell
$env:DEMO_ADMIN_PASSWORD="YOUR_DEMO_ADMIN_PASSWORD"
node tests/theme.mjs
```

The test signs in, changes local appearance preferences, creates one demo POS order for print verification, and writes local screenshots under `test-results`. Do not run it against a real business database. The bootstrap test expects the Vite development module URL, so run it against `npm run dev`, not a production build.
