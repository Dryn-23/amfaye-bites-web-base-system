import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Star, ShieldCheck, RefreshCw } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { invalidateReviews } from "../components/ReviewLinks";
import "../components/reviews.css";
export function Stars({ rating }) {
  return (
    <span className="review-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={15}
          fill={n <= rating ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
export default function Reviews() {
  const { id } = useParams();
  return <ReviewPage key={id} id={id} />;
}
function ReviewPage({ id }) {
  const { user } = useAuth();
  const [product, setProduct] = useState(null),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [saved, setSaved] = useState(0);
  useEffect(() => {
    let live = true;
    setError("");
    Promise.all([
      api("/products/" + id),
      api(`/reviews/product/${id}?page=${page}`),
    ])
      .then(([p, d]) => {
        if (live) {
          setProduct(p);
          setData(d);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, page, version, saved]);
  const refresh = () => setVersion((v) => v + 1);
  return (
    <div className="container page reviews-page">
      <Link className="text-link" to="/menu">
        <ArrowLeft size={15} />
        Back to menu
      </Link>
      <header className="review-page-header">
        <div>
          <span className="eyebrow">HONEST WORDS. HAPPY MOMENTS.</span>
          <h1>{product?.name || "Product"} reviews</h1>
          <p>Real feedback from customers with completed, paid purchases.</p>
        </div>
        <button className="button outline small" onClick={refresh}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>
      {error ? (
        <div className="error" role="alert">
          {error} <button onClick={refresh}>Retry</button>
        </div>
      ) : !data ? (
        <p role="status">Loading reviews…</p>
      ) : (
        <>
          <div className="reviews-layout">
            <section className="reviews-content">
              <div className="review-summary">
                <div>
                  <strong>{data.count ? data.average.toFixed(1) : "—"}</strong>
                  <span>out of 5</span>
                  <p>
                    {data.count} {data.count === 1 ? "review" : "reviews"}
                  </p>
                </div>
                <div className="review-distribution">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <div key={n}>
                      <span>{n} ★</span>
                      <meter
                        min="0"
                        max={Math.max(1, data.count)}
                        value={data.distribution[n] || 0}
                        aria-label={`${n} star reviews`}
                      />
                      <span>{data.distribution[n] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="review-list">
                {!data.items.length ? (
                  <div className="review-empty">
                    <Star size={30} />
                    <h2>No reviews yet</h2>
                    <p>
                      Ordered this product? Once your order is completed and
                      paid, you can be the first to review it.
                    </p>
                  </div>
                ) : (
                  data.items.map((r) => (
                    <article className="review-entry" key={r._id}>
                      <div className="review-entry-heading">
                        <b>{r.displayName}</b>
                        <time dateTime={r.createdAt}>
                          {new Date(r.createdAt).toLocaleDateString("en-PH")}
                        </time>
                      </div>
                      <Stars rating={r.rating} />
                      <span className="review-verified">
                        <ShieldCheck size={13} />
                        Verified purchase
                      </span>
                      <p className="review-text">{r.text}</p>
                    </article>
                  ))
                )}
              </div>
              {data.pages > 1 && (
                <nav className="review-pagination" aria-label="Review pages">
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
            </section>
            <aside className="review-form-panel">
              {!user ? (
                <>
                  <h2>Share your experience</h2>
                  <p>Sign in to review a product you purchased.</p>
                  <Link
                    className="button"
                    to="/login"
                    state={{ from: `/products/${id}/reviews` }}
                  >
                    Sign in
                  </Link>
                </>
              ) : user.role !== "customer" ? (
                <>
                  <h2>Customer voices</h2>
                  <p>
                    Only customers with a completed, paid online order can write
                    a review.
                  </p>
                  {user.role === "admin" && (
                    <Link className="text-link" to="/admin/reviews">
                      Manage reviews →
                    </Link>
                  )}
                </>
              ) : (
                <ReviewEditor
                  key={user.id || user._id}
                  product={id}
                  refreshKey={version}
                  onSaved={() => {
                    setPage(1);
                    setSaved((n) => n + 1);
                    invalidateReviews();
                  }}
                />
              )}
            </aside>
          </div>
          <p className="review-policy">
            Reviews are published immediately. Spam, abusive content and
            personal information may be hidden by an admin with a recorded
            reason. Low ratings alone are not a reason to hide a review.
          </p>
        </>
      )}
    </div>
  );
}
function ReviewEditor({ product, onSaved, refreshKey }) {
  const [state, setState] = useState(null),
    [rating, setRating] = useState(0),
    [text, setText] = useState(""),
    [displayName, setName] = useState("Verified customer"),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setError("");
    setSuccess("");
    api(`/reviews/product/${product}/mine`)
      .then((d) => {
        if (live) {
          setState(d);
          if (d.review) {
            setRating(d.review.rating);
            setText(d.review.text);
            setName(d.review.displayName);
          }
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [product, retry, refreshKey]);
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const review = await api(`/reviews/product/${product}/mine`, {
        method: "PUT",
        body: { rating, text, displayName },
      });
      setState((s) => ({ ...s, review }));
      setSuccess(
        review.hidden
          ? "Changes saved. Your review remains hidden until an admin restores it."
          : "Thank you! Your review has been saved.",
      );
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h2>{state?.review ? "Your review" : "Write a review"}</h2>
      {error && (
        <div className="error" role="alert">
          {error}
          {!state && (
            <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
          )}
        </div>
      )}
      {success && (
        <div className="success" role="status">
          {success}
        </div>
      )}
      {!state ? (
        !error && <p>Checking your purchase…</p>
      ) : !state.eligible ? (
        <>
          <p>
            You can review this product after your online order is{" "}
            <b>Completed</b> and <b>Paid</b>.
          </p>
          <Link className="text-link" to="/orders">
            View my orders →
          </Link>
        </>
      ) : (
        <form className="review-editor" onSubmit={save}>
          {state.review?.hidden && (
            <div className="review-moderation-note">
              <b>Your review is hidden</b>
              <p>{state.review.moderationReason}</p>
              <small>
                Editing does not automatically publish it again. Contact the
                team if you need help.
              </small>
            </div>
          )}
          <fieldset disabled={busy}>
            <legend>Your rating</legend>
            <div className="review-star-input">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} title={`${n} ${n === 1 ? "star" : "stars"}`}>
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    checked={rating === n}
                    required
                    onChange={() => {
                      setRating(n);
                      setSuccess("");
                    }}
                    aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
                  />
                  <Star
                    size={29}
                    fill={n <= rating ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="review-public-name">Public display name</label>
          <input
            id="review-public-name"
            value={displayName}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={40}
            required
            disabled={busy}
          />
          <small>
            Shown publicly instead of your account details. You can use a
            nickname.
          </small>
          <label htmlFor="review-text">Your review</label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            minLength={5}
            maxLength={1000}
            required
            rows={5}
            disabled={busy}
            placeholder="What did you enjoy? What could we improve?"
          />
          <small>
            {text.length}/1000 · Please do not include phone numbers, passwords
            or other private information.
          </small>
          <button
            className="button"
            disabled={
              busy ||
              !rating ||
              text.trim().length < 5 ||
              displayName.trim().length < 2
            }
          >
            {busy
              ? "Saving…"
              : state.review
                ? "Save changes"
                : "Publish review"}
          </button>
        </form>
      )}
    </>
  );
}
