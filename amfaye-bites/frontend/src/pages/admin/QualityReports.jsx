import { useEffect, useState } from "react";
import { ShieldAlert, CheckCircle, XCircle } from "lucide-react";
import { api } from "../../services/api";

export default function ManageQuality() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Open");

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

  async function updateStatus(id, status) {
    try {
      await api(`/quality/${id}/status`, {
        method: "PUT",
        body: { status },
      });
      load();
    } catch {
      alert("Update failed.");
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
                  <div><strong>{c.orderNumber || (c.order?._id ? c.order._id.toString().slice(-6) : "—")}</strong></div>
                  <div className="muted small">{c.customer?.name || "—"}</div>
                  <div className="muted small">Status: {c.status}</div>
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
                    <button className="button small" onClick={() => updateStatus(c._id, "Under Review")}>Review</button>
                    <button className="button small outline" onClick={() => updateStatus(c._id, "Refunded")} title="Confirm refund (voids payment + deducts from sales)"><CheckCircle size={14} /> Refund</button>
                    <button className="button small outline" onClick={() => updateStatus(c._id, "Rejected")} title="Reject"><XCircle size={14} /> Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {items.length === 0 && !loading && <p className="muted">No reports match this filter.</p>}
    </div>
  );
}
