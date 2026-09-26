import fs from "node:fs";
import path from "node:path";
const root = process.cwd(),
  changes = [];
function addImport(s, line) {
  return s.includes(line) ? s : line + "\n" + s;
}
function insert(s, re, fn, label) {
  if (!re.test(s))
    throw Error(
      "Cannot find " +
        label +
        ". No integration files were changed. See REVIEWS-UPDATE.md for manual installation.",
    );
  return s.replace(re, fn);
}
function prepare(file, fn) {
  const full = path.join(root, file);
  const original = fs.readFileSync(full, "utf8");
  changes.push({ file, full, original, source: fn(original) });
}
try {
  for (const f of [
    "backend/routes/reviewRoutes.js",
    "frontend/src/pages/Reviews.jsx",
    "frontend/src/pages/admin/Reviews.jsx",
    "frontend/src/components/ReviewLinks.jsx",
  ])
    if (!fs.existsSync(path.join(root, f)))
      throw Error(
        "Copy the review update files into your existing project first. Missing " +
          f,
      );
  prepare("backend/app.js", (s) => {
    if (!/import\s+reviews\s+from/.test(s)) {
      s = 'import reviews from "./routes/reviewRoutes.js";\n' + s;
      s = insert(
        s,
        /Object\.entries\(\{/,
        (m) => m + "\nreviews,",
        "backend router registry",
      );
    }
    return s;
  });
  prepare("frontend/src/App.jsx", (s) => {
    if (!/path=["']products\/:id\/reviews["']/.test(s)) {
      s = insert(
        s,
        /<Route\s+path=["']unauthorized["']/,
        (m) =>
          '<Route path="products/:id/reviews" element={<Reviews />} />\n' + m,
        "storefront routes",
      );
      s = addImport(s, 'import Reviews from "./pages/Reviews";');
    }
    if (!/path=["']reviews["']/.test(s)) {
      s = insert(
        s,
        /<Route\s+path=["']pos["']/,
        (m) =>
          '<Route path="reviews" element={<ProtectedRoute roles={["admin"]}><ManageReviews /></ProtectedRoute>} />\n' +
          m,
        "admin POS route",
      );
      s = addImport(s, 'import ManageReviews from "./pages/admin/Reviews";');
    }
    return s;
  });
  prepare("frontend/src/components/ProductCard.jsx", (s) => {
    if (!/<ProductRating\s/.test(s)) {
      s = insert(
        s,
        /<p>\{product\.description\}<\/p>/,
        (m) => m + "\n<ProductRating product={product._id} />",
        "product card description",
      );
      s = addImport(s, 'import ProductRating from "./ReviewLinks";');
    }
    return s;
  });
  prepare("frontend/src/components/ProductModal.jsx", (s) => {
    if (!/<ProductRating\s/.test(s)) {
      s = insert(
        s,
        /<h2\s+id=["']product-title["']>\{p\.name\}<\/h2>/,
        (m) => m + "\n<ProductRating product={p._id} />",
        "product modal title",
      );
      s = addImport(s, 'import ProductRating from "./ReviewLinks";');
    }
    return s;
  });
  prepare("frontend/src/pages/MyOrders.jsx", (s) => {
    if (!/<OrderReviewLinks\s/.test(s)) {
      s = insert(
        s,
        /<div\s+className=["']order-detail panel["']\s*>/,
        (m) => m + "\n<OrderReviewLinks order={data} />",
        "order-detail panel (data variable)",
      );
      s = addImport(
        s,
        'import { OrderReviewLinks } from "../components/ReviewLinks";',
      );
    }
    return s;
  });
  prepare("frontend/src/components/Sidebar.jsx", (s) => {
    if (!/<ReviewNavLink\s*\//.test(s)) {
      s = insert(
        s,
        /<nav\s*>/,
        (m) => m + "\n<ReviewNavLink />",
        "staff sidebar navigation",
      );
      s = addImport(s, 'import { ReviewNavLink } from "./ReviewLinks";');
    }
    return s;
  });
  const changed = changes.filter((c) => c.original !== c.source);
  const backup = path.join(
    root,
    ".reviews-update-backup",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  for (const c of changed) {
    const file = path.join(backup, c.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, c.original);
  }
  for (const c of changed) {
    fs.writeFileSync(c.full, c.source);
    console.log("Updated " + c.file);
  }
  console.log(
    changed.length
      ? "Backups saved: " + backup
      : "Reviews already integrated. No changes.",
  );
  console.log(
    "Next: npm test --prefix backend; npm run build --prefix frontend. Deploy both services.",
  );
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
