import { useEffect, useState } from "react";
import { X, CheckCircle, XCircle, FileText } from "lucide-react";
import { api } from "../../services/api";
import { money, date } from "../../utils/currency";

const STATUS_BADGE = {
  Pending: "gold",
  Approved: "green",
  Rejected: "red",
};

function RefundCard({ c, onClose, onUpdate }) {
  const [note, setNote] = useState(c?.note || "");
  if (!c) return null;
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Review refund" onClick={onClose}>
      <div className="panel refund-card" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div>
            <h3>Refund request</h3>
            <span className={`badge ${STATUS_BADGE[c.status] || "muted"}`}>{c.status}</span>
          </div>
          <button className="text-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <dl className="stack tight">
          <div><dt>Order</dt><dd>{c.order?.number || "—"}</dd></div>
          <div><dt>Customer</dt><dd>{c.customer?.name || "—"}</dd></div>
          <div><dt>Requested</dt><dd>{new Date(c.createdAt).toLocaleString()}</dd></div>
          <div><dt>Amount requested</dt><dd><strong>{c.amount != null ? money(c.amount) : "—"}</strong></dd></div>
          <div><dt>Reason</dt><dd>{c.reason || "—"}</dd></div>
          <div><dt>Items</dt>
            <dd>
              {c.items?.length ? (
                <ul className="plain-list">
                  {c.items.map((i, n) => (
                    <li key={n}>
                      {i.name} × {i.quantity} @ {money(i.unitPrice)}
                    </li>
                  ))}
                </ul>
              ) : (
                "—"
              )}
            </dd>
          </div>
          {c.note && (
            <div><dt>Staff note</dt><dd>{c.note}</dd></div>
          )}
        </dl>

        {c.status === "Pending" && (
          <>
            <label className="stack tight">
              Resolution note
              <textarea
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for approval or rejection…"
              />
            </label>
            <div className="row tight">
              <button
                className="button small"
                onClick={() => onUpdate(c._id, "Approved", note)}
                title="Approve — voids payment and sale"
              >
                <CheckCircle size={14} /> Approve
              </button>
              <button
                className="button small outline"
                onClick={() => onUpdate(c._id, "Rejected", note)}
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
          </>
        )}

        {c.status !== "Pending" && (
          <p className="muted small">
            Processed by {c.processedBy?.name || "—"} on{" "}
            {c.processedAt ? new Date(c.processedAt).toLocaleString() : "—"}
          </p>
        )}
      </div>

      <style jsx>{`
        .modal-scrim {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .refund-card {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
          padding: 24px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.15);
        }
        .refund-card dt {
          font-weight: 600;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .refund-card dd {
          margin: 0 0 12px 0;
          word-break: break-word;
        }
        .plain-list {
          margin: 0;
          padding-left: 18px;
        }
        .refund-card .row.tight {
          gap: 8px;
          margin-top: 20px;
        }
      `}</style>
    </div>
  );
}

export default function RefundsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Pending");
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api(`/refunds?status=${encodeURIComponent(filter)}`);
      setItems(res || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function updateStatus(id, status, note) {
    const confirmMsg =
      status === "Approved"
        ? "Approve this refund? The order's payment and sale will be voided."
        : "Reject this refund?";
    if (!window.confirm(confirmMsg)) return;
    try {
      await api(`/refunds/${id}`, {
        method: "PUT",
        body: { status, note },
      });
      await load();
      setSelected(null);
    } catch (err) {
      alert(err.message || "Update failed.");
    }
  }

  return (
    <div className="admin-page">
      <h2><FileText size={20} /> Refund Requests</h2>
      <div className="stack row tight">
        {["Pending", "Approved", "Rejected"].map((s) => (
          <button
            key={s}
            className={`button small outline ${filter === s ? "active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
        <button className="button small" onClick={() => setFilter("")}>All</button>
      </div>
      {loading ? <p className="muted">Loading…</p> : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Reason</th>
              <th>Created</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c._id}>
                <td>{c.order?.number || "—"}</td>
                <td>{c.customer?.name || "—"}</td>
                <td>{money(c.amount)}</td>
                <td>
                  {c.reason && c.reason.slice(0, 60)}
                  {c.reason && c.reason.length > 60 ? "…" : ""}
                </td>
                <td>{new Date(c.createdAt).toLocaleString()}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[c.status] || "muted"}`}>{c.status}</span>
                </td>
                <td>
                  <div className="row tight">
                    <button className="button small" onClick={() => setSelected(c)}>Review</button>
                    {c.status === "Pending" && (
                      <>
                        <button
                          className="button small outline"
                          onClick={() => updateStatus(c._id, "Approved")}
                          title="Approve — voids payment and sale"
                        >
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button
                          className="button small outline"
                          onClick={() => updateStatus(c._id, "Rejected")}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {items.length === 0 && !loading && <p className="muted">No refund requests match this filter.</p>}

      {selected && (
        <RefundCard
          key={selected._id}
          c={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateStatus}
        />
      )}
    </div>
  );
}
