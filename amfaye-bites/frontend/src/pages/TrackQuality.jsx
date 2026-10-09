import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldCheck, Ticket, Camera, Clock } from "lucide-react";
import { api } from "../services/api";

export default function TrackQuality() {
  const [ticket, setTicket] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookup(e) {
    e.preventDefault();
    if (!ticket.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api(`/quality/ticket/${encodeURIComponent(ticket.trim())}`);
      setResult(res);
    } catch (err) {
      setError(err.message || "Ticket not found.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container page narrow">
      <div className="page-heading centered">
        <span className="eyebrow">TRACK YOUR REFUND</span>
        <h1>Report status</h1>
        <p>Enter the ticket number we emailed after your report.</p>
      </div>
      <form className="panel stack" onSubmit={lookup}>
        <label>
          <Ticket size={16} /> Ticket number
          <input
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            placeholder="QC-XXXXXX-XXXXX"
            required
          />
        </label>
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Looking up…" : "Check status"}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
      {result && (
        <section className="panel stack">
          <div className="row">
            <h3>{result.ticket}</h3>
            <span className={`badge ${result.status === "Refunded" ? "green" : "muted"}`}>
              {result.status}
            </span>
          </div>
          <dl className="stack tight">
            <div><dt>Issue</dt><dd>{result.issueType}</dd></div>
            <div><dt>Order</dt><dd>{result.orderNumber || result.order}</dd></div>
            <div><dt>Report</dt><dd>{result.description}</dd></div>
            {result.photoUrl && (
              <div>
                <dt><Camera size={14} /> Photo proof</dt>
                <dd><a href={result.photoUrl} target="_blank" rel="noreferrer">View photo</a></dd>
              </div>
            )}
            {result.keywordFlags?.length > 0 && (
              <div><dt>Flagged reason</dt><dd>{result.keywordFlags.join(", ")}</dd></div>
            )}
            {result.staffNote && (
              <div><dt>Staff note</dt><dd>{result.staffNote}</dd></div>
            )}
          </dl>
        </section>
      )}
      <section className="panel">
        <ShieldCheck className="green" />
        <h3>Refund promise</h3>
        <p>
          Contaminated or defective items are <strong>fully refunded — no
          restocking fee</strong>. Reports with photo proof are reviewed
          within <strong>3–5 business days</strong>.
        </p>
        <div className="stack">
          <Link className="button outline" to="/quality">Report a new issue</Link>
          <Link className="button" to="/orders">My orders</Link>
        </div>
      </section>
      <p className="muted centered small">
        <Clock size={14} /> Demo only — refunds are simulated and no real payment is processed.
      </p>
    </div>
  );
}
