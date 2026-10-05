import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Percent,
  ToggleLeft,
  ToggleRight,
  Copy,
  Check,
} from "lucide-react";
import { api } from "../../services/api";
import { date } from "../../utils/currency";
import Loading from "../../components/Loading";

const empty = {
  name: "",
  code: "",
  description: "",
  percent: 10,
  active: true,
  expiresAt: "",
};

export default function PromotionsAdmin() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");

  const load = () =>
    api("/promotions/all")
      .then(setRows)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        ...form,
        percent: Number(form.percent),
        expiresAt: form.expiresAt
          ? new Date(form.expiresAt).toISOString()
          : null,
      };
      if (editing) {
        await api("/promotions/" + editing._id, {
          method: "PUT",
          body,
        });
      } else {
        await api("/promotions", { method: "POST", body });
      }
      setOpen(false);
      setEditing(null);
      setForm({ ...empty, percent: 10, active: true });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row) {
    setBusy(true);
    setError("");
    try {
      await api("/promotions/" + row._id, {
        method: "PUT",
        body: {
          name: row.name,
          code: row.code,
          description: row.description || "",
          percent: row.percent,
          active: !row.active,
          expiresAt: row.expiresAt || null,
        },
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
      await api("/promotions/" + id, { method: "DELETE" });
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
          <span className="eyebrow">A LITTLE EXTRA HAPPY</span>
          <h1>Promotions</h1>
          <p>Create and manage discount codes for checkout and POS.</p>
        </div>
        <button
          className="button"
          onClick={() => {
            setEditing(null);
            setForm({ ...empty, percent: 10, active: true });
            setOpen(true);
          }}
        >
          <Plus size={17} /> New promotion
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
                <th>Code</th>
                <th>Name</th>
                <th>Off</th>
                <th>Used</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p._id}>
                  <td>
                    <b>{p.code}</b>
                  </td>
                  <td>{p.name}</td>
                  <td>
                    <span className="badge">{p.percent}% off</span>
                  </td>
                  <td>{p.useCount || 0}</td>
                  <td>
                    <span
                      className={"status status-" + (p.active ? "confirmed" : "cancelled")}
                    >
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{p.expiresAt ? date(p.expiresAt) : "Never"}</td>
                  <td className="row-actions">
                    <button
                      className="icon-btn"
                      aria-label="Copy code"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(p.code);
                          setCopied(p.code);
                        } catch {}
                      }}
                    >
                      {copied === p.code ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Toggle active"
                      disabled={busy}
                      onClick={() => toggle(p)}
                    >
                      {p.active ? (
                        <ToggleRight size={18} />
                      ) : (
                        <ToggleLeft size={18} />
                      )}
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Edit"
                      onClick={() => {
                        setEditing(p);
                        setForm({
                          name: p.name,
                          code: p.code,
                          description: p.description || "",
                          percent: p.percent,
                          active: p.active,
                          expiresAt: p.expiresAt
                            ? p.expiresAt.slice(0, 10)
                            : "",
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
                      onClick={() => setConfirm(p._id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty compact">
                      <Percent size={28} />
                      <h3>No promotions yet</h3>
                      <p>Create a discount code for checkout and POS.</p>
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
              <h2>{editing ? "Edit promotion" : "New promotion"}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                  setForm({ ...empty, percent: 10, active: true });
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
                placeholder="Weekend Delight"
                maxLength={100}
                required
              />
            </label>
            <label>
              Code
              <input
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="HAPPY10"
                maxLength={30}
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
                placeholder="A little extra happy"
                maxLength={300}
              />
            </label>
            <label>
              Percent off (1–50)
              <input
                type="number"
                min={1}
                max={50}
                step={1}
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value })}
                required
              />
            </label>
            <label>
              Expires
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </label>
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
              {busy ? "Saving…" : editing ? "Save changes" : "Create promotion"}
            </button>
          </form>
        </div>
      )}

      {confirm && (
        <div className="modal-backdrop">
          <section className="panel payment-modal">
            <div className="section-heading">
              <h2>Delete this promotion?</h2>
              <button
                className="icon-btn"
                onClick={() => setConfirm("")}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="muted">
              The code stops working immediately. Existing orders keep their
              discount.
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
