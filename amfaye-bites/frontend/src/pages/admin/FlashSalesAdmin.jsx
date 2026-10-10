import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Flame,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { api } from "../../services/api";
import { date } from "../../utils/currency";
import Loading from "../../components/Loading";

const empty = {
  name: "",
  description: "",
  discountPercent: 10,
  products: [],
  categories: [],
  startDate: "",
  endDate: "",
  active: true,
  maxUsesPerCustomer: 1,
};

const toLocal = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

export default function FlashSalesAdmin() {
  const [rows, setRows] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);

  const load = () =>
    Promise.all([
      api("/flash-sales"),
      api("/products"),
      api("/categories"),
    ])
      .then(([sales, p, c]) => {
        setRows(sales);
        setProducts(p);
        setCategories(c);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  function toggleList(field, id) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(id)
        ? f[field].filter((x) => x !== id)
        : [...f[field], id],
    }));
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        name: form.name,
        description: form.description,
        discountPercent: Number(form.discountPercent),
        products: form.products,
        categories: form.categories,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        active: form.active,
        maxUsesPerCustomer: Number(form.maxUsesPerCustomer),
      };
      if (editing) {
        await api("/flash-sales/" + editing._id, {
          method: "PATCH",
          body,
        });
      } else {
        await api("/flash-sales", { method: "POST", body });
      }
      setOpen(false);
      setEditing(null);
      setForm(empty);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row) {
    setBusy(true);
    setError("");
    try {
      await api("/flash-sales/" + row._id, {
        method: "PATCH",
        body: { active: !row.active },
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    setError("");
    try {
      await api("/flash-sales/" + id, { method: "DELETE" });
      setConfirm("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const isLive = (s) =>
    s.active &&
    new Date(s.startDate) <= new Date() &&
    new Date(s.endDate) > new Date();

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">LIMITED TIME HEAT</span>
          <h1>Flash sales</h1>
          <p>Time-boxed discounts applied automatically at checkout.</p>
        </div>
        <button
          className="button"
          onClick={() => {
            setEditing(null);
            setForm(empty);
            setOpen(true);
          }}
        >
          <Plus size={17} /> New flash sale
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {!rows ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Off</th>
                <th>Scope</th>
                <th>Window</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s._id}>
                  <td>
                    <b>{s.name}</b>
                  </td>
                  <td>
                    <span className="badge">{s.discountPercent}% off</span>
                  </td>
                  <td>
                    {(s.products || []).length} products ·{" "}
                    {(s.categories || []).length} categories
                  </td>
                  <td>
                    <small>
                      {date(s.startDate)} → {date(s.endDate)}
                    </small>
                  </td>
                  <td>
                    <span
                      className={
                        "status status-" +
                        (isLive(s) ? "confirmed" : "cancelled")
                      }
                    >
                      {isLive(s) ? "Live" : s.active ? "Scheduled" : "Inactive"}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button
                      className="icon-btn"
                      aria-label="Toggle active"
                      disabled={busy}
                      onClick={() => toggleActive(s)}
                    >
                      {s.active ? (
                        <ToggleRight size={18} />
                      ) : (
                        <ToggleLeft size={18} />
                      )}
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Edit"
                      onClick={() => {
                        setEditing(s);
                        setForm({
                          name: s.name,
                          description: s.description || "",
                          discountPercent: s.discountPercent,
                          products: (s.products || []).map((p) => p._id || p),
                          categories: (s.categories || []).map(
                            (c) => c._id || c,
                          ),
                          startDate: toLocal(s.startDate),
                          endDate: toLocal(s.endDate),
                          active: s.active,
                          maxUsesPerCustomer: s.maxUsesPerCustomer || 1,
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-btn danger"
                      aria-label="Delete"
                      disabled={busy}
                      onClick={() => setConfirm(s._id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty compact">
                      <Flame size={28} />
                      <h3>No flash sales yet</h3>
                      <p>Create a limited-time discount for the storefront.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="modal-backdrop">
          <form className="panel payment-modal" onSubmit={save}>
            <div className="section-heading">
              <h2>{editing ? "Edit flash sale" : "New flash sale"}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                  setForm(empty);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Lunch Rush Sale"
                maxLength={100}
                required
              />
            </label>
            <label>
              Description
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                maxLength={500}
              />
            </label>
            <label>
              Discount percent (1–90)
              <input
                type="number"
                min={1}
                max={90}
                step={1}
                value={form.discountPercent}
                onChange={(e) =>
                  setForm({ ...form, discountPercent: e.target.value })
                }
                required
              />
            </label>
            <label>
              Max uses per customer
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={form.maxUsesPerCustomer}
                onChange={(e) =>
                  setForm({ ...form, maxUsesPerCustomer: e.target.value })
                }
                required
              />
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <label>
                Starts
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Ends
                <input
                  type="datetime-local"
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  required
                />
              </label>
            </div>
            <label className="field-label">Products on sale</label>
            <div className="addon-list" style={{ maxHeight: 140, overflow: "auto" }}>
              {products.map((p) => (
                <label key={p._id}>
                  <input
                    type="checkbox"
                    checked={form.products.includes(p._id)}
                    onChange={() => toggleList("products", p._id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
            <label className="field-label">Or entire categories</label>
            <div className="addon-list">
              {categories.map((c) => (
                <label key={c._id}>
                  <input
                    type="checkbox"
                    checked={form.categories.includes(c._id)}
                    onChange={() => toggleList("categories", c._id)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <div className="option-buttons">
              <button
                type="button"
                className={form.active ? "selected" : ""}
                onClick={() => setForm({ ...form, active: true })}
              >
                Active
              </button>
              <button
                type="button"
                className={!form.active ? "selected" : ""}
                onClick={() => setForm({ ...form, active: false })}
              >
                Inactive
              </button>
            </div>
            <button className="button full" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create flash sale"}
            </button>
          </form>
        </div>
      )}

      {confirm && (
        <div className="modal-backdrop">
          <section className="panel payment-modal">
            <div className="section-heading">
              <h2>Delete this flash sale?</h2>
              <button
                className="icon-btn"
                onClick={() => setConfirm("")}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="muted">
              The discount stops applying immediately. Existing orders keep
              their prices.
            </p>
            <div className="option-buttons">
              <button className="button outline" onClick={() => setConfirm("")}>
                Keep
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => remove(confirm)}
              >
                Delete
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
