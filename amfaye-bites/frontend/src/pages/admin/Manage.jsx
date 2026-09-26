import { useSearchParams } from "react-router-dom";
import "../../components/stockAlerts.css";
import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Archive,
  Search,
  X,
  History,
  BookOpen,
} from "lucide-react";
import { api } from "../../services/api";
import { money, date } from "../../utils/currency";
import { useAuth } from "../../context/AuthContext";
import Loading from "../../components/Loading";
const configs = {
  products: {
    title: "Products",
    subtitle: "Fresh favorites, thoughtfully managed.",
    fields: {
      name: "Name",
      description: "Description",
      category: "Category",
      price: "Price (PHP)",
      stock: "Sellable servings",
      minimumStock: "Minimum servings",
      image: "Image URL or local path",
      badge: "Badge",
      available: "Available",
      featured: "Featured",
      customizable: "Fruit shake customization",
    },
  },
  categories: {
    title: "Categories",
    subtitle: "A little order for all the goodness.",
    fields: { name: "Name", description: "Description" },
  },
  inventory: {
    title: "Inventory",
    subtitle: "A well-stocked kitchen is a happy kitchen.",
    fields: {
      name: "Ingredient",
      unit: "Unit",
      stock: "Opening stock",
      minimumStock: "Minimum stock",
      purchaseCost: "Purchase cost (PHP)",
      supplier: "Supplier",
      expirationDate: "Expiration date",
    },
  },
  customers: {
    title: "Customers",
    subtitle: "The people behind every happy order.",
  },
  users: {
    title: "Users",
    subtitle: "The team making good things happen.",
    fields: {
      name: "Full name",
      email: "Email",
      username: "Username",
      password: "Temporary password",
      role: "Role",
    },
  },
};
const numeric = ["price", "stock", "minimumStock", "purchaseCost"];
const bools = ["available", "featured", "customizable"];
export default function Manage({ kind }) {
  const config = configs[kind];
  const [params, setParams] = useSearchParams();
  const stockFilter = params.get("stock") || "all";
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState(null);
  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const canEdit = user.role === "admin" && kind !== "customers";
  const load = () =>
    api("/" + kind)
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    setRows(null);
    setQuery(kind === "products" ? params.get("q") || "" : "");
    setError("");
    setMessage("");
    load();
    if (kind === "products") {
      api("/categories")
        .then(setCategories)
        .catch((e) => setError(e.message));
      api("/inventory")
        .then(setIngredients)
        .catch((e) => setError(e.message));
    }
  }, [kind]);
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function edit(row) {
    setEditing(row?._id || null);
    setError("");
    setForm(
      row
        ? {
            ...row,
            category: row.category?._id || row.category,
            available: row.enabled ?? row.available,
            expirationDate: row.expirationDate?.slice(0, 10) || "",
          }
        : Object.fromEntries(
            Object.keys(config.fields).map((k) => [
              k,
              bools.includes(k)
                ? k === "available"
                : numeric.includes(k)
                  ? 0
                  : k === "role"
                    ? "cashier"
                    : k === "category"
                      ? categories[0]?._id || ""
                      : "",
            ]),
          ),
    );
  }
  async function save(e) {
    e.preventDefault();
    await action(async () => {
      const body = { ...form };
      for (const k of numeric) if (k in body) body[k] = Number(body[k]);
      if ("expirationDate" in body)
        body.expirationDate = body.expirationDate
          ? new Date(body.expirationDate).toISOString()
          : null;
      if (kind === "inventory" && editing) delete body.stock;
      await api("/" + kind + (editing ? "/" + editing : ""), {
        method: editing ? "PUT" : "POST",
        body,
      });
      setForm(null);
      setMessage("Saved. A little more goodness, ready to go.");
    });
  }
  const stockMatches = (r, filter) => {
    if (filter === "low")
      return r.enabled !== false && r.stock > 0 && r.stock <= r.minimumStock;
    if (filter === "out") return r.enabled !== false && r.stock <= 0;
    if (filter === "alerts")
      return r.enabled !== false && r.stock <= r.minimumStock;
    if (filter === "unavailable") return !r.available;
    return true;
  };
  const filtered = (rows || [])
    .filter((r) => kind !== "products" || stockMatches(r, stockFilter))
    .filter((r) =>
      (r.name + " " + (r.email || "") + " " + (r.category?.name || ""))
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">THE LITTLE DETAILS THAT MATTER</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <div className="action-buttons">
          {kind === "inventory" && (
            <button
              className="button outline"
              onClick={() =>
                action(async () => setHistory(await api("/inventory/history")))
              }
            >
              <History size={17} />
              History
            </button>
          )}
          {canEdit && (
            <button className="button" onClick={() => edit(null)}>
              <Plus size={17} />
              Add{" "}
              {kind === "inventory"
                ? "ingredient"
                : kind === "categories"
                  ? "category"
                  : kind.slice(0, -1)}
            </button>
          )}
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}
      {kind === "products" && (
        <>
          <div
            className="tabs stock-filter-tabs"
            aria-label="Product stock filters"
          >
            {[
              ["all", "All products"],
              ["low", "Low stock"],
              ["out", "Out of stock"],
              ["alerts", "All stock alerts"],
              ["unavailable", "Unavailable"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={stockFilter === value ? "active" : ""}
                onClick={() => {
                  setParams(value === "all" ? {} : { stock: value });
                  setQuery("");
                }}
              >
                {label} (
                {(rows || []).filter((r) => stockMatches(r, value)).length})
              </button>
            ))}
          </div>
          <p className="stock-filter-caption">
            Low stock: 1 to the minimum serving level. Out of stock: zero
            servings. Disabled products are excluded from stock alerts.
          </p>
          <button className="button small outline" type="button" onClick={load}>
            Refresh product stock
          </button>
        </>
      )}
      <div className="search-field admin-search">
        <Search size={17} />
        <input
          placeholder={"Search " + config.title.toLowerCase() + "…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {!rows ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {kind === "products" ? (
                  <>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock / minimum</th>
                    <th>Status</th>
                  </>
                ) : kind === "inventory" ? (
                  <>
                    <th>Ingredient</th>
                    <th>Current stock</th>
                    <th>Minimum</th>
                    <th>Cost / supplier</th>
                    <th>Expiration</th>
                  </>
                ) : kind === "categories" ? (
                  <>
                    <th>Category</th>
                    <th>Description</th>
                  </>
                ) : (
                  <>
                    <th>Name</th>
                    <th>Email / username</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Account</th>
                  </>
                )}
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r._id}>
                  {kind === "products" ? (
                    <>
                      <td>
                        <div className="table-product">
                          <img src={r.image || "/hero.png"} alt="" />
                          <b>{r.name}</b>
                        </div>
                      </td>
                      <td>{r.category?.name}</td>
                      <td>{money(r.price)}</td>
                      <td>
                        {r.stock} servings
                        <small>Minimum: {r.minimumStock}</small>
                        {r.enabled !== false && r.stock <= r.minimumStock && (
                          <span
                            className={`status ${r.stock <= 0 ? "status-Cancelled" : "status-Pending"}`}
                          >
                            {r.stock <= 0 ? "Out of stock" : "Low stock"}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            "status " +
                            (r.available
                              ? "status-Completed"
                              : "status-Cancelled")
                          }
                        >
                          {r.available ? "Available" : "Unavailable"}
                        </span>
                      </td>
                    </>
                  ) : kind === "inventory" ? (
                    <>
                      <td>
                        <b>{r.name}</b>
                      </td>
                      <td>
                        {Number(r.stock.toFixed(3))} {r.unit}
                        {r.stock <= r.minimumStock && (
                          <small className="warning-text">
                            {r.stock <= 0 ? "Unavailable" : "Low Stock"}
                          </small>
                        )}
                      </td>
                      <td>
                        {r.minimumStock} {r.unit}
                      </td>
                      <td>
                        {money(r.purchaseCost)}
                        <small>{r.supplier || "Not set"}</small>
                      </td>
                      <td>
                        {r.expirationDate
                          ? new Date(r.expirationDate).toLocaleDateString()
                          : "Not set"}
                      </td>
                    </>
                  ) : kind === "categories" ? (
                    <>
                      <td>
                        <b>{r.name}</b>
                      </td>
                      <td>{r.description}</td>
                    </>
                  ) : (
                    <>
                      <td>
                        <b>{r.name}</b>
                      </td>
                      <td>
                        {r.email}
                        <small>@{r.username}</small>
                      </td>
                      <td>{r.phone || "—"}</td>
                      <td>{r.role}</td>
                      <td>{r.active ? "Active" : "Disabled"}</td>
                    </>
                  )}
                  {canEdit && (
                    <td>
                      <div className="action-buttons">
                        {kind === "users" ? (
                          <button
                            className="button small outline"
                            disabled={r._id === user.id}
                            onClick={() => {
                              setEditing(r._id);
                              setForm({ role: r.role, active: r.active });
                            }}
                          >
                            Permissions
                          </button>
                        ) : (
                          <button
                            className="icon-btn"
                            title="Edit"
                            onClick={() => edit(r)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {kind === "inventory" && (
                          <button
                            className="button small outline"
                            onClick={() => {
                              setAdjust(r);
                              setDelta("");
                              setReason("");
                            }}
                          >
                            Adjust
                          </button>
                        )}
                        {kind === "products" && (
                          <>
                            <button
                              className="icon-btn"
                              title="Recipe"
                              onClick={() =>
                                action(async () => {
                                  const recipe = await api("/recipes/" + r._id);
                                  setRecipe({
                                    product: r,
                                    ingredients: recipe.ingredients.map(
                                      (i) => ({
                                        ingredient: i.ingredient,
                                        quantity: i.quantity,
                                      }),
                                    ),
                                  });
                                })
                              }
                            >
                              <BookOpen size={16} />
                            </button>
                            <button
                              className="icon-btn"
                              title="Archive"
                              onClick={() => {
                                if (confirm(`Archive ${r.name}?`))
                                  action(() =>
                                    api("/products/" + r._id, {
                                      method: "DELETE",
                                    }),
                                  );
                              }}
                            >
                              <Archive size={16} />
                            </button>
                          </>
                        )}
                        {kind === "categories" && (
                          <button
                            className="icon-btn"
                            title="Delete"
                            onClick={() => {
                              if (confirm(`Delete ${r.name}?`))
                                action(() =>
                                  api("/categories/" + r._id, {
                                    method: "DELETE",
                                  }),
                                );
                            }}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty compact">
              <h3>Nothing here just yet.</h3>
              <p>
                {query
                  ? "Try another search."
                  : "New records will appear here."}
              </p>
            </div>
          )}
        </div>
      )}
      {form && (
        <div className="modal-backdrop">
          <form className="panel editor-modal" onSubmit={save}>
            <div className="section-heading">
              <h2>
                {editing ? "Edit" : "Add"}{" "}
                {kind === "inventory"
                  ? "ingredient"
                  : kind === "categories"
                    ? "category"
                    : kind.slice(0, -1)}
              </h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setForm(null)}
                aria-label="Close"
              >
                <X />
              </button>
            </div>
            {Object.entries(
              kind === "users" && editing
                ? { role: "Role", active: "Active account" }
                : config.fields,
            )
              .filter(
                ([k]) => !(kind === "inventory" && editing && k === "stock"),
              )
              .map(([k, label]) => (
                <label
                  key={k}
                  className={
                    bools.includes(k) || k === "active" ? "checkbox-label" : ""
                  }
                >
                  {bools.includes(k) || k === "active" ? (
                    <>
                      <input
                        type="checkbox"
                        checked={!!form[k]}
                        onChange={(e) =>
                          setForm({ ...form, [k]: e.target.checked })
                        }
                      />
                      {label}
                    </>
                  ) : (
                    <>
                      {label}
                      {k === "category" || k === "role" ? (
                        <select
                          required
                          value={form[k]}
                          onChange={(e) =>
                            setForm({ ...form, [k]: e.target.value })
                          }
                        >
                          {k === "category"
                            ? categories.map((c) => (
                                <option value={c._id} key={c._id}>
                                  {c.name}
                                </option>
                              ))
                            : ["customer", "cashier", "admin"].map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                        </select>
                      ) : k === "description" ? (
                        <textarea
                          value={form[k] || ""}
                          onChange={(e) =>
                            setForm({ ...form, [k]: e.target.value })
                          }
                        />
                      ) : (
                        <input
                          required={[
                            "name",
                            "unit",
                            "email",
                            "username",
                            "password",
                            "price",
                            "stock",
                          ].includes(k)}
                          type={
                            numeric.includes(k)
                              ? "number"
                              : k === "expirationDate"
                                ? "date"
                                : k === "password"
                                  ? "password"
                                  : k === "email"
                                    ? "email"
                                    : "text"
                          }
                          min={numeric.includes(k) ? 0 : undefined}
                          step={
                            k === "stock" && kind === "products" ? 1 : "any"
                          }
                          minLength={k === "password" ? 8 : undefined}
                          maxLength={k === "password" ? 72 : undefined}
                          value={form[k] ?? ""}
                          onChange={(e) =>
                            setForm({ ...form, [k]: e.target.value })
                          }
                        />
                      )}
                    </>
                  )}
                </label>
              ))}
            {error && <div className="error">{error}</div>}
            <button className="button full" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </form>
        </div>
      )}
      {adjust && (
        <div className="modal-backdrop">
          <form
            className="panel payment-modal"
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                await api("/inventory/" + adjust._id + "/adjust", {
                  method: "POST",
                  body: { delta: Number(delta), reason },
                });
                setAdjust(null);
              });
            }}
          >
            <h2>Adjust {adjust.name}</h2>
            <p>
              Current: {adjust.stock} {adjust.unit}. Use a negative number to
              deduct stock.
            </p>
            <label>
              Stock change
              <input
                required
                type="number"
                step="any"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
              />
            </label>
            <label>
              Reason
              <input
                required
                minLength={3}
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Supplier delivery, waste, count correction"
              />
            </label>
            {error && <div className="error">{error}</div>}
            <div className="action-buttons">
              <button className="button" disabled={busy}>
                Save adjustment
              </button>
              <button
                type="button"
                className="button outline"
                onClick={() => setAdjust(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {history && (
        <div className="modal-backdrop">
          <section className="panel editor-modal wide">
            <div className="section-heading">
              <h2>Inventory history</h2>
              <button className="icon-btn" onClick={() => setHistory(null)}>
                <X />
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ingredient</th>
                    <th>Change</th>
                    <th>Balance</th>
                    <th>Reason / staff</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h._id}>
                      <td>{date(h.createdAt)}</td>
                      <td>{h.ingredient?.name}</td>
                      <td>{h.delta.toFixed(3)}</td>
                      <td>{h.balance.toFixed(3)}</td>
                      <td>
                        {h.reason}
                        <small>{h.actor?.name}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {recipe && (
        <div className="modal-backdrop">
          <form
            className="panel editor-modal"
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                await api("/recipes/" + recipe.product._id, {
                  method: "PUT",
                  body: {
                    ingredients: recipe.ingredients.map((i) => ({
                      ...i,
                      quantity: Number(i.quantity),
                    })),
                  },
                });
                setRecipe(null);
                setMessage(
                  "Recipe saved. Ingredients will be deducted with every order.",
                );
              });
            }}
          >
            <div className="section-heading">
              <h2>Recipe · {recipe.product.name}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setRecipe(null)}
              >
                <X />
              </button>
            </div>
            <p className="muted">
              Ingredient usage per small serving. Medium shakes use 1.25×, large
              1.5×. Keep packaging stock sufficient.
            </p>
            {recipe.ingredients.map((i, n) => (
              <div className="form-row" key={n}>
                <label>
                  Ingredient
                  <select
                    value={i.ingredient}
                    onChange={(e) =>
                      setRecipe({
                        ...recipe,
                        ingredients: recipe.ingredients.map((x, j) =>
                          j === n ? { ...x, ingredient: e.target.value } : x,
                        ),
                      })
                    }
                  >
                    {ingredients.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.name} ({v.unit})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    required
                    min="0.001"
                    step="any"
                    type="number"
                    value={i.quantity}
                    onChange={(e) =>
                      setRecipe({
                        ...recipe,
                        ingredients: recipe.ingredients.map((x, j) =>
                          j === n ? { ...x, quantity: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() =>
                    setRecipe({
                      ...recipe,
                      ingredients: recipe.ingredients.filter((_, j) => j !== n),
                    })
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button small outline"
              onClick={() =>
                setRecipe({
                  ...recipe,
                  ingredients: [
                    ...recipe.ingredients,
                    { ingredient: ingredients[0]?._id, quantity: 1 },
                  ],
                })
              }
            >
              Add ingredient
            </button>
            {error && <div className="error">{error}</div>}
            <button className="button full" disabled={busy}>
              Save recipe
            </button>
          </form>
        </div>
      )}
    </>
  );
}
