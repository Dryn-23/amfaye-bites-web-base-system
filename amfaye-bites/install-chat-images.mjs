// Run with Node from the EXISTING project root after merging this partial update.
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
try {
  for (const file of [
    "backend/app.js",
    "backend/models/ChatConversation.js",
    "backend/routes/chatImageRoutes.js",
    "backend/services/chatImageService.js",
    "frontend/src/pages/Messages.jsx",
    "frontend/src/components/ChatImages.jsx",
  ])
    if (!fs.existsSync(path.join(root, file)))
      throw Error(
        "Missing " +
          file +
          ". Install the base chat update first, then merge this update into your existing project root.",
      );
  const app = fs.readFileSync(path.join(root, "backend/app.js"), "utf8");
  if (!/import\s+chats\s+from/.test(app))
    throw Error(
      "The base chat API is not wired into backend/app.js. Run the base chat installer first.",
    );
  const file = path.join(root, "backend/package.json"),
    original = fs.readFileSync(file, "utf8"),
    pkg = JSON.parse(original);
  pkg.dependencies ||= {};
  pkg.dependencies.multer = "^2.4.0";
  pkg.dependencies.sharp = "^0.35.4";
  const source = JSON.stringify(pkg, null, 2) + "\n";
  if (source !== original) {
    const backup = path.join(
      root,
      ".chat-images-update-backup",
      new Date().toISOString().replace(/[:.]/g, "-"),
      "backend/package.json",
    );
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.writeFileSync(backup, original);
    fs.writeFileSync(file, source);
    console.log("Updated backend/package.json; original saved at " + backup);
  } else console.log("Image dependencies already declared.");
  console.log("Now run: npm install --prefix backend");
  console.log(
    "Then: npm test --prefix backend; npm run build --prefix frontend",
  );
  console.log(
    "Commit backend/package-lock.json too. Deploy backend first, then frontend.",
  );
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
