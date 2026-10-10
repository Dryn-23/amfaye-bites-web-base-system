import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Gift,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { api } from "../../services/api";
import { money, date } from "../../utils/currency";
import Loading from "../../components/Loading";

const empty = {
  name: "",
  description: "",
  items: [{ product: "", quantity: 1 }],
  originalPrice: "",
  bundlePrice: "",
  active: true,
  startDate: "",
  endDate: "",
  imageUrl: "",
};

const toLocal = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

export default function BundlesAdmin() {
  const [rows, setRows] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);

  const load = () =>
    Promise.all([api("/bundles"), api("/products")])
      .then(([b, p]) => {
        setRows(b);
        setProducts(p);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const computedOriginal = form.items.reduce((n, i) => {
    const p = products.find((x) => x._id === i.product);
    return n + (p ? p.price * (Number(i.quantity) || 0) : 0);
  }, 0);

  function setItem(index, field, value) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) =>
        i === index ? { ...it, [field]: value } : it,
      ),
    }));
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const items = form.items
        .filter((i) => i.product)
        .map((i) => ({ product: i.product, quantity: Number(i.quantity) }));
      const body = {
        name: form.name,
        description: form.description,
        items,
        originalPrice: Number(form.originalPrice || computedOriginal),
        bundlePrice: Number(form.bundlePrice),
        active: form.active,
        startDate: form.startDate
          ? new Date(form.startDate).toISOString()
          : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        imageUrl: form.imageUrl || undefined,
      };
      if (editing) {
        await api("/bundles/" + editing._id, { method: "PATCH", body });
      } else {
        await api("/bundles", { method: "POST", body });
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
      await api("/bundles/" + row._id, {
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
      await api("/bundles/" + id, { method: "DELETE" });
      setConfirm("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">MIX AND SAVE</span>
          <h1>Bundle deals</h1>
          <p>Combo offers customers can add to their bag in one tap.</p>
        </div>
        <button
          className="button"
          onClick={() => {
            setEditing(null);
            setForm(empty);
            setOpen(true);
          }}
        >
          <Plus size={17} /> New bundle
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
                <th>Includes</th>
                <th>Price</th>
                <th>Window</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b._id}>
                  <td>
                    <b>{b.name}</b>
                  </td>
                  <td>
                    {b.items
                      .map((i) => `${i.quantity}× ${i.name}`)
                      .join(", ")}
                  </td>
                  <td>
                    <b>{money(b.bundlePrice)}</b>{" "}
                    <small className="muted">
                      was {money(b.originalPrice)}
                    </small>
                  </td>
                  <td>
                    <small>
                      {b.startDate ? date(b.startDate) : "Always"}
                      {" → "}
                      {b.endDate ? date(b.endDate) : "No end"}
                    </small>
                  </td>
                  <td>
                    <span
                      className={
                        "status status-" + (b.active ? "confirmed" : "cancelled")
                      }
                    >
                      {b.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button
                      className="icon-btn"
                      aria-label="Toggle active"
                      disabled={busy}
                      onClick={() => toggleActive(b)}
                    >
                      {b.active ? (
                        <ToggleRight size={18} />
                      ) : (
                        <ToggleLeft size={18} />
                      )}
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Edit"
                      onClick={() => {
                        setEditing(b);
                        setForm({
                          name: b.name,
                          description: b.description || "",
                          items: b.items.map((i) => ({
                            product: i.product?._id || i.product,
                            quantity: i.quantity,
                          })),
                          originalPrice: b.originalPrice,
                          bundlePrice: b.bundlePrice,
                          active: b.active,
                          startDate: toLocal(b.startDate),
                          endDate: toLocal(b.endDate),
                          imageUrl: b.imageUrl || "",
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
                      onClick={() => setConfirm(b._id)}
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
                      <Gift size={28} />
                      <h3>No bundle deals yet</h3>
                      <p>Package a few favorites into one sweet combo.</p>
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
              <h2>{editing ? "Edit bundle" : "New bundle"}</h2>
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
                placeholder="Merienda Pairing"
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
            <label className="field-label">Items (at least 2)</label>
            {form.items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <select
                  value={it.product}
                  onChange={(e) => setItem(i, "product", e.target.value)}
                  required
                  style={{ flex: 1 }}
                >
                  <option value="">Choose a product…</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} — {money(p.price)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={it.quantity}
                  onChange={(e) => setItem(i, "quantity", e.target.value)}
                  style={{ width: 70 }}
                  required
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Remove item"
                  disabled={form.items.length <= 1}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      items: f.items.filter((_, x) => x !== i),
                    }))
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  items: [...f.items, { product: "", quantity: 1 }],
                }))
              }
            >
              <Plus size={14} /> Add another item
            </button>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <label>
                Original price
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.originalPrice}
                  onChange={(e) =>
                    setForm({ ...form, originalPrice: e.target.value })
                  }
                  placeholder={computedOriginal.toFixed(2)}
                />
              </label>
              <label>
                Bundle price
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.bundlePrice}
                  onChange={(e) =>
                    setForm({ ...form, bundlePrice: e.target.value })
                  }
                  required
                />
              </label>
            </div>
            <small className="muted">
              Leave original price blank to use {money(computedOriginal)} — the
              sum of the selected items.
            </small>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <label>
                Starts (optional)
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </label>
              <label>
                Ends (optional)
                <input
                  type="datetime-local"
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </label>
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
              {busy ? "Saving…" : editing ? "Save changes" : "Create bundle"}
            </button>
          </form>
        </div>
      )}

      {confirm && (
        <div className="modal-backdrop">
          <section className="panel payment-modal">
            <div className="section-heading">
              <h2>Delete this bundle?</h2>
              <button
                className="icon-btn"
                onClick={() => setConfirm("")}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="muted">
              Customers stop seeing it immediately. Existing orders keep their
              pricing.
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
