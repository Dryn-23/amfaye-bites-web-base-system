import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldAlert, Camera, Ticket, CheckCircle } from "lucide-react";
import { api } from "../services/api";
import { money, date } from "../utils/currency";

const ISSUES = ["Insects / Pest", "Mold / Spoilage", "Damaged / Crushed", "Wrong Item", "Allergen / Health", "Other"];

export default function QualityComplaint() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState(null);
  const [form, setForm] = useState({ order: searchParams.get("order") || "", issueType: ISSUES[0], description: "", photo: "" });
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api("/orders")
      .then((list) =>
        setOrders((list || []).filter((o) => o.paymentStatus !== "Voided")),
      )
      .catch(() => setOrders([]));
  }, []);

  const selected = orders?.find((o) => String(o._id) === form.order);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.order || !form.description) {
      setError("Please pick an order and describe the issue.");
      return;
    }
    setSending(true);
    try {
      const res = await api("/quality", {
        method: "POST",
        body: {
          order: form.order,
          issueType: form.issueType,
          description: form.description.slice(0, 2000),
          photoUrl: form.photo || "",
        },
      });
      setResult(res);
    } catch (err) {
      const detail = err?.status ? ` (${err.status})` : "";
      setError((err.message || "Could not send the report. Please try again.") + detail);
    } finally {
      setSending(false);
    }
  }

  if (result) {
    return (
      <div className="container page narrow">
        <div className="page-heading centered">
          <CheckCircle className="green" size={48} />
          <h1>Report received</h1>
        </div>
        <section className="panel centered">
          <Ticket className="green" />
          <h3>Your ticket: {result.ticket}</h3>
          <p className="muted">Save this number to track your refund request.</p>
          {result.flagged && (
            <p className="muted">
              Our team has been alerted immediately because this looks like a
              food-safety issue.
            </p>
          )}
          <div className="stack">
            <Link className="button outline" to="/quality/track">Track my report</Link>
            <Link className="button" to="/">Back to menu</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container page narrow">
      <div className="page-heading centered">
        <span className="eyebrow">QUALITY GUARANTEE</span>
        <h1>Report a problem</h1>
        <p>Found insects, mold, or a damaged item? We refund contaminated food — no restocking fee.</p>
      </div>
      {orders === null ? (
        <section className="panel centered"><p className="muted">Loading your orders…</p></section>
      ) : !orders.length ? (
        <section className="panel centered stack">
          <p>You don't have any orders to report on yet.</p>
          <Link className="button" to="/orders">Go to my orders</Link>
        </section>
      ) : (
        <form className="panel stack" onSubmit={submit}>
          {error && (
            <p className="error" role="alert">{error}</p>
          )}
          <label>
            Which order?
            <select
              value={form.order}
              onChange={(e) => setForm({ ...form, order: e.target.value })}
              required
            >
              <option value="">Select an order…</option>
              {orders.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.number} · {date(o.createdAt)} · {money(o.total)} · {o.paymentStatus === "Paid" ? "paid" : "payment " + o.paymentStatus.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          {selected && selected.paymentStatus !== "Paid" && (
            <p className="muted small">
              Refunds are only issued for paid orders — your report will still
              be reviewed and can be refunded once payment is collected.
            </p>
          )}
          <label>
            Issue type
            <select
              value={form.issueType}
              onChange={(e) => setForm({ ...form, issueType: e.target.value })}
            >
              {ISSUES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <label>
            Describe the issue
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              maxLength={2000}
              placeholder="What did you find? When did you receive the order?"
              required
            />
          </label>
          <label>
            <Camera size={16} /> Photo proof (optional — link to an uploaded image)
            <input
              value={form.photo}
              onChange={(e) => setForm({ ...form, photo: e.target.value })}
              placeholder="https://…"
              type="url"
            />
          </label>
          <ShieldAlert size={20} className="green" />
          <p className="muted small">
            Food-safety reports (insects, mold, contamination) are escalated to
            staff right away and qualify for a full refund.
          </p>
          <button className="button" type="submit" disabled={sending}>
            {sending ? "Sending…" : "Submit refund request"}
          </button>
        </form>
      )}
      <p className="muted centered">
        Already reported? <Link to="/quality/track">Track your ticket</Link>
      </p>
    </div>
  );
}
