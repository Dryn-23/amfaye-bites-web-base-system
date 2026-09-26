# AMFAYE BITES — Image attachments in order chat

Customers and admins can now attach an image to an order conversation. Images are stored in **MongoDB Atlas GridFS**, not Render's temporary disk. This update requires the existing chat feature.

**This is a source update. Your live Render/Vercel websites have not been changed.**

## How to use

1. Open an order's chat as its customer, or select the conversation from the admin **Messages** inbox.
2. Click **Attach image** and choose a JPEG, PNG or WebP.
3. Check the preview. You can change/remove the image before sending.
4. Optionally type a caption, then click **Send**. An image can also be sent without text.
5. Click a received thumbnail to enlarge it. Use **Save image** to download the processed image, or Escape/Close to return to chat.

Both customer and admin can upload. Existing text messages, history, unread counts, seen indicators and close/reopen controls continue to work. A closed conversation must be reopened before sending anything new.

### Limits

- One image per message.
- Original upload: **5 MB maximum** and **16 megapixels maximum**.
- Accepted input: **JPEG, PNG, WebP**. HEIC, GIF, SVG, videos, PDFs and other files are not supported. Animated images are not supported as animations.
- The backend validates the MIME type, file signature and decoded image, applies orientation and re-encodes a static **JPEG**, removing source metadata such as EXIF/GPS. It resizes to fit within **2048 × 2048** without enlarging small images. Transparent backgrounds become white.
- Stored JPEG: **1 MB maximum**. An unusually detailed image exceeding that limit is rejected with instructions to resize it.
- Captions retain the existing 1,000-character limit. The existing per-account chat write allowance also applies to image messages.

Images are not original-quality archives. Do not upload passwords, PINs, real OTPs, financial credentials, identity documents or other sensitive information. Metadata removal does **not** redact information visible in the picture. An image or payment screenshot does **not** verify payment or change an order's payment status.

## Install in your existing project — PowerShell

### 1. Back up and merge

Commit/back up your current code first. Extract `amfaye-bites-chat-images-update.zip`, then **merge** its `backend` and `frontend` folders into your existing project. Do not replace/delete whole folders. Copy the installer and this guide to the project root beside `backend/` and `frontend/`.

This package updates four existing chat feature files:

- `backend/models/ChatMessage.js`
- `backend/services/chatService.js`
- `backend/routes/chatRoutes.js`
- `frontend/src/pages/Messages.jsx`

If you customized those files, compare and merge their changes rather than blindly replacing them. New image-specific modules/styles/tests are also included. The existing chat test file includes a small compatibility fix for projects without the optional order-guard update.

**It does not replace global styles, theme files, navigation, App routes, reviews, backend app wiring, `.env` or your entire package manifest.** Existing brown colors and other installed features are preserved through the existing theme variables and untouched integrations.

### 2. Run these exact commands from the project root

```powershell
node .\install-chat-images.mjs
npm install --prefix backend
npm test --prefix backend
npm run build --prefix frontend
```

Include **`node`** before the installer filename. The installer checks that base chat exists and declares the required backend dependencies while retaining other package settings. A changed package manifest is backed up under `.chat-images-update-backup/`; rerunning is safe.

The two added backend dependencies are **Multer** for bounded multipart parsing and **Sharp** for image decoding/re-encoding. The tested ranges are `multer ^2.4.0` and `sharp ^0.35.4`; an older Sharp release flagged by npm audit was replaced before delivery. Keep dependencies updated as security fixes become available.

**Use `npm install` for this update**, so your own `backend/package-lock.json` is updated. Commit both the package manifest and regenerated lock file. Do not copy another project's complete package manifest over yours. No frontend dependency is added. If frontend dependencies are missing, run `npm ci --prefix frontend` first. Use Node.js 20.19+.

If the installer says base chat is missing, install/run the earlier chat update first. This package does not add a second chat system or duplicate navigation.

### 3. Deploy both services

1. Review, commit and push the changed feature files, installer changes and backend lock file. Exclude `.env`, credentials, `node_modules`, generated build output and backup folders.
2. Redeploy **Render backend first**. Keep the current Atlas `MONGODB_URI`, JWT settings, exact-origin CORS settings and `npm start` production command. Render must install the new backend dependencies; do not deploy a Linux server using Windows `node_modules`.
3. Redeploy **Vercel frontend**, retaining the existing Render API URL and SPA rewrite.
4. Hard-refresh the site with **Ctrl + Shift + R**.
5. Test customer/admin accounts in separate browser sessions: send a small photo, reply with another photo, reload the conversation and open a thumbnail.

No new mandatory secrets or external storage account are required. Merely copying/running these files locally does not update your live website.

## Atlas storage budget and maintenance

The default **shared image-data budget is 100 MB** for this application's database. It counts stored images and reserved/unfinished uploads across accounts and API instances. A database-backed reservation prevents concurrent uploads from bypassing the limit. When full, uploads return a clear error; text chat remains available.

Optional Render/backend environment setting:

```dotenv
CHAT_IMAGE_STORAGE_MB=100
```

Supported integer range: **10–1000 MB**. Invalid values fall back to 100. This is the budget for encoded image bytes, **not a guarantee of total Atlas disk usage**: messages, products, other collections, GridFS metadata and indexes also use space. Check your Atlas plan/storage usage before increasing it. Lowering the budget does not delete existing images; it blocks new uploads until usage is below the limit.

New storage:

- `chatImages.files` and `chatImages.chunks` — GridFS data.
- `chatimageassets` — private upload lifecycle records.
- `chatimagequotas` — the shared reserved/stored byte counter.
- Existing `chatmessages` documents gain optional attachment metadata. Old text messages remain readable; no backfill or database reset is needed.

The app normally creates model indexes automatically; the GridFS driver initializes its indexes on first upload. From `backend/`, with your existing backend/Atlas environment configured, this helper creates declared asset/quota indexes and reports usage:

```powershell
node .\scripts\chat-image-storage.js
```

### Clean up interrupted uploads

Normal failures/duplicate retries remove unused uploads and release their reservations. A server crash may leave a reserved or partially uploaded image. Run the following periodically, or after an interrupted deployment:

```powershell
node .\scripts\chat-image-storage.js --cleanup
```

It removes only unfinished/deleting uploads whose 10-minute attachment window expired **more than 24 hours ago**, including their GridFS chunks, and releases their reserved bytes. It does **not** delete successfully attached images. This is an explicit maintenance command; no scheduled job is automatically installed.

There is no automatic deletion of sent images and no attachment-delete interface in this release. Do not manually remove quota records or only one side of GridFS storage: that would make accounting inconsistent. If a sent-image deletion/retention policy is needed, it should be implemented as coordinated deletion of messages/assets/GridFS data/quota. Back up these collections together. Atlas is required in production; local test MongoDB must be a replica set for the existing transaction-based chat and reservations.

## Privacy, retries and compatibility

- Authenticated customers can access only their own order conversations. Authorized admins can access the shared support inbox. Guests, other customers and cashiers cannot upload/download these images.
- Images are fetched with the existing bearer token, then displayed with temporary browser blob URLs. There are no permanent anonymous image URLs or tokens embedded in image URLs. Responses use `private, no-store` and `nosniff`.
- Source filenames are not retained as served filenames; downloads are named `chat-image.jpg`.
- Captions and image hashes participate in retry matching. If the response is lost after saving, retrying the same draft/file reuses its message ID rather than creating a second message or second stored image.
- Failed sends keep the selected image and draft **while that page remains open**. Reloading/navigating away does not preserve an unsent file selection.
- Selecting a different image or changing the caption creates a new submission identity. Avoid changing the draft during an uncertain retry if you intend to resend the same message.
- Temporary process-level limits bound simultaneous uploads/decodes; a busy server can ask users to retry. Image processing is synchronous request work, not a background queue.
- Images use normal authenticated application access, not end-to-end encryption. Re-encoding/type checks are not an antivirus service or automatic moderation system.
- Existing polling behavior remains: conversations check every 5 seconds while visible. Slow connections or Render cold starts can delay sending/loading.
- Orders, inventory, payments, reviews and other unrelated features are not modified by an image message.

## Verification

- **49/49 backend tests passed** on the current project, including **9 image-specific tests** covering GridFS persistence, caption/image-only messages, ownership/roles, MIME/signature checks, corrupt/oversized/pixel-limit rejection, metadata stripping/orientation, concurrent duplicate sends, rollback, quota, safe cleanup and rate limits.
- **Chromium image flow passed:** customer/admin attachments, selection preview/remove, viewer/download/Escape, image-only reply, a deliberately lost response after backend commit followed by deduplicated retry, close/reopen, reload persistence, mobile/dark layouts and no page errors.
- Existing text-chat browser regression passed.
- Frontend production build passed. Backend npm audit reported **0 known vulnerabilities** at testing time; this is not a guarantee against future advisories.
- Compatibility fixture using the original project plus the earlier chat update: dependency installer/idempotence, frontend build and **33/33 backend tests** passed. Reviews/theme/notification updates are not prerequisites.

No production deployment, production database changes, large-scale load test or automatic scheduler configuration was performed. Optional browser test: `frontend/tests/chat-images.mjs`; run only against disposable local Vite/demo servers with matching `DEMO_ADMIN_PASSWORD`. It creates customer/order/chat/image data. Never point it at production.
