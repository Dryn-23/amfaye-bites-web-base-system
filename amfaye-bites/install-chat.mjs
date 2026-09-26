/** Run from the existing project root after merging the new chat files. */
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const planned = [];
function addImport(s, name, from) {
  return new RegExp(`import\\s+${name}\\s+from`).test(s)
    ? s
    : `import ${name} from "${from}";\n` + s;
}
function insert(s, pattern, replacement, description) {
  if (!pattern.test(s))
    throw Error(
      "Cannot find " +
        description +
        ". No integration files were changed. See CHAT-UPDATE.md for manual integration.",
    );
  return s.replace(pattern, replacement);
}
function prepare(file, transform) {
  const full = path.join(root, file);
  if (!fs.existsSync(full))
    throw Error("Missing " + file + ". Run from your EXISTING project root.");
  const original = fs.readFileSync(full, "utf8");
  planned.push({ file, full, original, source: transform(original) });
}
try {
  for (const file of [
    "frontend/src/pages/Messages.jsx",
    "frontend/src/components/ChatNavLink.jsx",
    "frontend/src/components/OrderChatButton.jsx",
    "backend/routes/chatRoutes.js",
  ])
    if (!fs.existsSync(path.join(root, file)))
      throw Error(
        "Merge the update files into your existing project first: missing " +
          file,
      );
  prepare("frontend/src/components/Navbar.jsx", (s) => {
    if (!/<ChatNavLink(?:\s|\/|>)/.test(s))
      s = insert(
        s,
        /<div\s+className=["']nav-actions["']\s*>/,
        (m) => m + "\n<ChatNavLink />",
        "Navbar nav-actions",
      );
    return addImport(s, "ChatNavLink", "./ChatNavLink");
  });
  prepare("frontend/src/components/Sidebar.jsx", (s) => {
    if (!/<ChatNavLink(?:\s|\/|>)/.test(s))
      s = insert(
        s,
        /<nav\s*>/,
        (m) => m + "\n<ChatNavLink staff />",
        "Sidebar navigation",
      );
    return addImport(s, "ChatNavLink", "./ChatNavLink");
  });
  prepare("frontend/src/pages/MyOrders.jsx", (s) => {
    if (!/<OrderChatButton(?:\s|\/|>)/.test(s))
      s = insert(
        s,
        /<div\s+className=["']order-detail panel["']\s*>/,
        (m) => m + "\n<OrderChatButton order={data} />",
        "MyOrders order-detail panel (order variable: data)",
      );
    return addImport(s, "OrderChatButton", "../components/OrderChatButton");
  });
  prepare("frontend/src/App.jsx", (s) => {
    const count = (s.match(/path=["']messages\/:chatId\?["']/g) || []).length;
    if (count !== 0 && count !== 2)
      throw Error("Partial chat routes already exist. Check App.jsx manually.");
    if (count === 0) {
      s = insert(
        s,
        /<Route\s+path=["']unauthorized["']/,
        (m) =>
          '<Route path="messages/:chatId?" element={<ProtectedRoute roles={["customer"]}><Messages /></ProtectedRoute>} />\n' +
          m,
        "storefront unauthorized route",
      );
      s = insert(
        s,
        /<Route\s+path=["']pos["']/,
        (m) =>
          '<Route path="messages/:chatId?" element={<ProtectedRoute roles={["admin"]}><Messages /></ProtectedRoute>} />\n' +
          m,
        "nested admin POS route",
      );
    }
    return addImport(s, "Messages", "./pages/Messages");
  });
  prepare("backend/app.js", (s) => {
    if (!/import\s+chats\s+from/.test(s))
      s = insert(
        s,
        /Object\.entries\(\{/,
        (m) => m + "\nchats,",
        "backend router registry",
      );
    return addImport(s, "chats", "./routes/chatRoutes.js");
  });
  prepare("frontend/src/services/api.js", (s) => {
    let extra = "";
    if (!/retryAfter\s*:\s*data\.retryAfter/.test(s))
      extra += "\nretryAfter: data.retryAfter,";
    if (!/code\s*:\s*data\.code/.test(s)) extra += "\ncode: data.code,";
    return extra
      ? insert(
          s,
          /status:\s*res\.status\s*,/,
          (m) => m + extra,
          "API error status metadata",
        )
      : s;
  });
  // Validate every anchor before writing any integration file; retain dated backups.
  const changed = planned.filter((p) => p.source !== p.original);
  const backup = path.join(
    root,
    ".chat-update-backup",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  for (const p of changed) {
    const file = path.join(backup, p.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, p.original);
  }
  for (const p of changed) {
    fs.writeFileSync(p.full, p.source);
    console.log("Updated " + p.file);
  }
  console.log(
    changed.length
      ? "Original integration files saved in " + backup
      : "Chat integration already installed. No changes.",
  );
  console.log(
    "Next: npm test --prefix backend && npm run build --prefix frontend. Deploy BOTH backend and frontend.",
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
