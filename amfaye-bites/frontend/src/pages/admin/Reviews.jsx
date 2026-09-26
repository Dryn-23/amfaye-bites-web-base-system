import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "../../services/api";
import { Stars } from "../Reviews";
import { invalidateReviews } from "../../components/ReviewLinks";
import "../../components/reviews.css";
export default function ManageReviews() {
  const [data, setData] = useState(null),
    [status, setStatus] = useState("All"),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  useEffect(() => {
    let live = true;
    setError("");
    api(`/reviews/admin?status=${status}&page=${page}`)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [status, page, version]);
  return (
    <div className="reviews-admin">
      <header className="admin-heading">
        <div>
          <span className="eyebrow">CUSTOMER VOICES</span>
          <h1>Reviews</h1>
          <p>Keep feedback honest, helpful and safe.</p>
        </div>
        <button className="button outline small" onClick={refresh}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>
      <div className="review-admin-policy">
        <ShieldCheck size={22} />
        <p>
          <b>Moderate content, not opinions.</b> Hide only spam, abuse or
          personal information—not a low rating. Every hide/restore action
          requires a reason and is recorded in the audit log. Hidden reviews do
          not contribute to public ratings.
        </p>
      </div>
      <div className="review-filter">
        {["All", "Visible", "Hidden"].map((s) => (
          <button
            key={s}
            className={`button ${status === s ? "" : "outline"} small`}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!data ? (
        <p>Loading reviews…</p>
      ) : (
        <>
          <p className="review-policy">{data.total} matching reviews</p>
          <div className="review-admin-list">
            {data.items.length ? (
              data.items.map((r) => (
                <ModerationCard
                  key={r._id}
                  review={r}
                  onSaved={() => {
                    invalidateReviews();
                    refresh();
                  }}
                />
              ))
            ) : (
              <div className="review-empty">
                <h2>No reviews in this view</h2>
                <p>Verified customer reviews will appear here.</p>
              </div>
            )}
          </div>
          {data.pages > 1 && (
            <nav className="review-pagination" aria-label="Moderation pages">
              <button
                className="button outline small"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                {page} / {data.pages}
              </span>
              <button
                className="button outline small"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
function ModerationCard({ review: r, onSaved }) {
  const [editing, setEditing] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/reviews/admin/${r._id}`, {
        method: "PUT",
        body: { hidden: !r.hidden, reason },
      });
      setEditing(false);
      setReason("");
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="review-admin-card">
      <div className="review-entry-heading">
        <div>
          <h3>{r.product?.name || "Removed product"}</h3>
          <span>
            {r.displayName} ·{" "}
            {new Date(r.createdAt).toLocaleDateString("en-PH")}
          </span>
        </div>
        <span className={`review-visibility ${r.hidden ? "is-hidden" : ""}`}>
          {r.hidden ? "Hidden" : "Visible"}
        </span>
      </div>
      <Stars rating={r.rating} />
      <p className="review-text">{r.text}</p>
      {r.moderationReason && (
        <p className="review-policy">
          Last moderation reason: {r.moderationReason}
        </p>
      )}
      <div className="review-card-actions">
        {r.product && (
          <Link className="text-link" to={`/products/${r.product._id}/reviews`}>
            View public reviews →
          </Link>
        )}
        <button
          className="button outline small"
          disabled={busy}
          onClick={() => {
            setEditing(!editing);
            setError("");
          }}
        >
          {r.hidden ? "Restore review" : "Hide review"}
        </button>
      </div>
      {editing && (
        <form className="review-moderation-form" onSubmit={save}>
          <label>
            Reason for {r.hidden ? "restoring" : "hiding"} this review
            <textarea
              required
              minLength={5}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
            />
          </label>
          <small>
            The customer can see this reason. Keep it respectful; do not include
            private information.
          </small>
          <button
            className="button small"
            disabled={busy || reason.trim().length < 5}
          >
            {busy ? "Saving…" : "Confirm " + (r.hidden ? "restore" : "hide")}
          </button>
        </form>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </article>
  );
}
