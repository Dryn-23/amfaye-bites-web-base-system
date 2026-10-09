import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Camera, Ticket, CheckCircle } from "lucide-react";
import { api } from "../services/api";

const ISSUES = ["Insects / Pest", "Mold / Spoilage", "Damaged / Crushed", "Wrong Item", "Allergen / Health", "Other"];

export default function QualityComplaint() {
  const [form, setForm] = useState({ order: "", orderNumber: "", issueType: ISSUES[0], description: "", photo: "" });
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.order || !form.description) {
      setError("Please fill in your order ID and describe the issue.");
      return;
    }
    setSending(true);
    try {
      const res = await api("/quality", {
        method: "POST",
        body: {
          ...form,
          description: form.description.slice(0, 2000),
        },
      });
      setResult(res);
    } catch (err) {
      setError(err.message || "Could not send the report. Please try again.");
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
      <form className="panel stack" onSubmit={submit}>
        {error && (
          <p className="error" role="alert">{error}</p>
        )}
        <label>
          Order ID
          <input
            value={form.order}
            onChange={(e) => setForm({ ...form, order: e.target.value })}
            placeholder="e.g. 66f1abc123def4567890abcd"
            required
          />
        </label>
        <label>
          Order number (optional)
          <input
            value={form.orderNumber}
            onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
            placeholder="#1234"
          />
        </label>
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
      <p className="muted centered">
        Already reported? <Link to="/quality/track">Track your ticket</Link>
      </p>
    </div>
  );
}
