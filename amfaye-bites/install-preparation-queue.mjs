import fs from "node:fs";
import path from "node:path";
const root = process.cwd(),
  changes = [];
function insert(s, re, fn, label) {
  if (!re.test(s))
    throw Error(
      "Cannot find " +
        label +
        ". No integration files were changed. See PREPARATION-QUEUE-UPDATE.md for manual integration.",
    );
  return s.replace(re, fn);
}
function prepare(file, fn) {
  const full = path.join(root, file),
    original = fs.readFileSync(full, "utf8");
  changes.push({ file, full, original, source: fn(original) });
}
try {
  for (const f of [
    "backend/routes/preparationRoutes.js",
    "frontend/src/pages/admin/PreparationQueue.jsx",
    "frontend/src/components/PreparationNavLink.jsx",
  ])
    if (!fs.existsSync(path.join(root, f)))
      throw Error(
        "Merge the update files into your EXISTING project first. Missing " + f,
      );
  prepare("backend/app.js", (s) => {
    if (!/import\s+preparation\s+from/.test(s)) {
      s = 'import preparation from "./routes/preparationRoutes.js";\n' + s;
      s = insert(
        s,
        /Object\.entries\(\{/,
        (m) => m + "\npreparation,",
        "backend router registry",
      );
    }
    return s;
  });
  prepare("frontend/src/App.jsx", (s) => {
    if (!/path=["']preparation["']/.test(s)) {
      s =
        'import PreparationQueue from "./pages/admin/PreparationQueue";\n' + s;
      s = insert(
        s,
        /<Route\s+path=["']pos["']/,
        (m) =>
          '<Route path="preparation" element={<ProtectedRoute roles={["admin", "cashier"]}><PreparationQueue /></ProtectedRoute>} />\n' +
          m,
        "nested admin POS route",
      );
    }
    return s;
  });
  prepare("frontend/src/components/Sidebar.jsx", (s) => {
    if (!/<PreparationNavLink\s*\//.test(s)) {
      s = 'import PreparationNavLink from "./PreparationNavLink";\n' + s;
      s = insert(
        s,
        /<nav\s*>/,
        (m) => m + "\n<PreparationNavLink />",
        "staff navigation",
      );
    }
    return s;
  });
  const changed = changes.filter((c) => c.original !== c.source),
    backup = path.join(
      root,
      ".preparation-update-backup",
      new Date().toISOString().replace(/[:.]/g, "-"),
    );
  for (const c of changed) {
    const f = path.join(backup, c.file);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, c.original);
  }
  for (const c of changed) {
    fs.writeFileSync(c.full, c.source);
    console.log("Updated " + c.file);
  }
  console.log(
    changed.length
      ? "Backups saved in " + backup
      : "Queue already integrated. No changes.",
  );
  console.log(
    "Run npm test --prefix backend and npm run build --prefix frontend. Deploy BOTH services.",
  );
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
