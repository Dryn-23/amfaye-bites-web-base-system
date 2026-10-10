import { useEffect, useState } from "react";
import { ShieldAlert, CheckCircle, XCircle, Camera, X } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { money, date } from "../../utils/currency";

const STATUS_BADGE = {
  Open: "muted",
  "Under Review": "gold",
  Resolved: "green",
  Refunded: "green",
  Rejected: "red",
};

function RefundCard({ c, onClose, onUpdate, isAdmin }) {
  const [note, setNote] = useState(c?.staffNote || "");
  if (!c) return null;
  const refunded = c.status === "Refunded";
  const refundable = c.order?.paymentStatus === "Paid";
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Review complaint" onClick={onClose}>
      <div className="panel refund-card" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div>
            <h3>{c.ticket}</h3>
            <span className={`badge ${STATUS_BADGE[c.status] || "muted"}`}>{c.status}</span>
          </div>
          <button className="text-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <dl className="stack tight">
          <div><dt>Issue</dt><dd>{c.issueType}</dd></div>
          <div>
            <dt>Order</dt>
            <dd>
              {c.orderNumber || c.order?.number || "—"}
              {c.order?.status && <span className="muted"> ({c.order.status})</span>}
            </dd>
          </div>
          <div><dt>Customer</dt><dd>{c.customer?.name || "—"}</dd></div>
          <div><dt>Reported</dt><dd>{new Date(c.createdAt).toLocaleString()}</dd></div>
          <div>
            <dt>Refund amount</dt>
            <dd>
              <strong>{c.order?.total != null ? money(c.order.total) : "—"}</strong>
              {c.order?.paymentStatus && (
                <span className="muted"> — payment {c.order.paymentStatus.toLowerCase()}</span>
              )}
            </dd>
          </div>
          <div><dt>Description</dt><dd>{c.description}</dd></div>
          {c.photoUrl && (
            <div>
              <dt><Camera size={14} /> Photo proof</dt>
              <dd>
                <a href={c.photoUrl} target="_blank" rel="noreferrer">
                  <img src={c.photoUrl} alt="Proof" style={{maxWidth:"100%",borderRadius:6,border:"1px solid var(--line)"}} />
                </a>
              </dd>
            </div>
          )}
          {c.keywordFlags?.length > 0 && (
            <div><dt>Flagged reason</dt><dd>{c.keywordFlags.join(", ")}</dd></div>
          )}
        </dl>

        <label className="stack tight">
          Staff note
          <textarea
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Resolution details, refund reason…"
            disabled={refunded}
          />
        </label>

        {refunded ? (
          <p className="muted small">Refund processed — this report is final.</p>
        ) : (
          <div className="row tight">
            <button className="button small" onClick={() => onUpdate(c._id, "Under Review", note)}>Review</button>
            <button className="button small outline" onClick={() => onUpdate(c._id, "Resolved", note)}>Resolve</button>
            {isAdmin && (
              <button
                className="button small outline"
                title={
                  refundable
                    ? "Confirm refund — voids payment (money back) and deducts from sales"
                    : "Order is not in a paid state — refund unavailable"
                }
                disabled={!refundable}
                onClick={() => onUpdate(c._id, "Refunded", note)}
              >
                <CheckCircle size={14} /> Refund
              </button>
            )}
            <button className="button small outline" onClick={() => onUpdate(c._id, "Rejected", note)} title="Reject">
              <XCircle size={14} /> Reject
            </button>
          </div>
        )}
        {!refunded && note !== (c.staffNote || "") && (
          <button className="button small outline" onClick={() => onUpdate(c._id, null, note)}>
            Save note only
          </button>
        )}
      </div>
    </div>
  );
}

export default function ManageQuality() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Open");
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api(`/quality?status=${encodeURIComponent(filter)}&populate=order,customer`);
      setItems(res || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function updateStatus(id, status, staffNote) {
    if (
      status === "Refunded" &&
      !window.confirm(
        "Confirm refund? This voids the order's payment (money back) and deducts the sale from totals.",
      )
    )
      return;
    try {
      const comp = await api(`/quality/${id}/status`, {
        method: "PUT",
        body: {
          ...(status ? { status } : {}),
          ...(staffNote !== undefined ? { staffNote } : {}),
        },
      });
      // The response is unpopulated — keep the populated order/customer refs.
      const merge = (c) =>
        c && String(c._id) === String(id)
          ? { ...c, ...comp, order: c.order, customer: c.customer }
          : c;
      setSelected(merge);
      await load();
    } catch (err) {
      alert(err.message || "Update failed.");
    }
  }

  return (
    <div className="admin-page">
      <h2>Quality Reports</h2>
      <div className="stack row tight">
        {["Open", "Under Review", "Resolved", "Refunded", "Rejected"].map((s) => (
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
              <th>Ticket</th>
              <th>Issue</th>
              <th>Order</th>
              <th>Flags</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c._id} className={c.keywordFlags?.length ? "highlight" : ""}>
                <td><strong>{c.ticket}</strong></td>
                <td>
                  <div>{c.issueType}</div>
                  {c.description && <div className="muted small">{c.description.slice(0, 60)}{c.description.length > 60 ? "…" : ""}</div>}
                  {c.photoUrl && <div><a href={c.photoUrl} target="_blank" rel="noreferrer"><img src={c.photoUrl} alt="proof" style={{maxWidth:60,maxHeight:40,objectFit:"cover",borderRadius:4,border:"1px solid var(--line)",marginTop:3}} /></a></div>}
                </td>
                <td>
                  <div><strong>{c.orderNumber || c.order?.number || "—"}</strong></div>
                  <div className="muted small">{c.customer?.name || "—"}</div>
                  <div className="muted small">
                    Status: {c.status}
                    {c.order?.paymentStatus && ` · payment ${c.order.paymentStatus.toLowerCase()}`}
                  </div>
                </td>
                <td>
                  {c.keywordFlags?.length ? (
                    <span className="badge red"><ShieldAlert size={12} /> {c.keywordFlags.join(", ")}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{new Date(c.createdAt).toLocaleString()}</td>
                <td>
                  <div className="row tight">
                    <button className="button small" onClick={() => setSelected(c)}>Review</button>
                    {isAdmin && c.status !== "Refunded" && (
                      <button
                        className="button small outline"
                        onClick={() => updateStatus(c._id, "Refunded")}
                        title={
                          c.order?.paymentStatus === "Paid"
                            ? "Confirm refund (voids payment + deducts from sales)"
                            : "Order is not in a paid state — refund unavailable"
                        }
                        disabled={c.order?.paymentStatus !== "Paid"}
                      >
                        <CheckCircle size={14} /> Refund
                      </button>
                    )}
                    {c.status !== "Refunded" && (
                      <button className="button small outline" onClick={() => updateStatus(c._id, "Rejected")} title="Reject"><XCircle size={14} /> Reject</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {items.length === 0 && !loading && <p className="muted">No reports match this filter.</p>}

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
        .refund-card img {
          border-radius: 4px;
        }
        .refund-card a {
          color: var(--primary);
          text-decoration: underline;
        }
        .refund-card a:hover {
          text-decoration: none;
        }
        .refund-card .row.tight {
          gap: 8px;
          margin-top: 20px;
        }
      `}</style>

      {selected && (
        <RefundCard
          key={selected._id}
          c={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateStatus}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
