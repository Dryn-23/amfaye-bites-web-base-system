import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Star } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./reviews.css";
let cached = null,
  stamp = 0,
  pending = null;
function summaries() {
  if (cached && Date.now() - stamp < 30000) return Promise.resolve(cached);
  if (!pending)
    pending = api("/reviews/summary")
      .then((rows) => {
        cached = Object.fromEntries(rows.map((r) => [r._id, r]));
        stamp = Date.now();
        return cached;
      })
      .finally(() => (pending = null));
  return pending;
}
export function invalidateReviews() {
  cached = null;
  stamp = 0;
  window.dispatchEvent(new Event("amfaye:reviews"));
}
export default function ProductRating({ product }) {
  const [summary, setSummary] = useState(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () =>
      summaries()
        .then((data) => {
          if (live) {
            setSummary(data[product] || { count: 0 });
            setFailed(false);
          }
        })
        .catch(() => {
          if (live) setFailed(true);
        });
    load();
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("amfaye:reviews", load);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("amfaye:reviews", load);
      window.removeEventListener("focus", refresh);
    };
  }, [product]);
  return (
    <Link
      className="review-rating"
      to={`/products/${product}/reviews`}
      aria-label="Read product reviews"
    >
      <Star size={14} />
      {failed
        ? "View reviews"
        : !summary
          ? "Reviews…"
          : summary.count
            ? `${summary.average.toFixed(1)} · ${summary.count} ${summary.count === 1 ? "review" : "reviews"}`
            : "No reviews yet"}
    </Link>
  );
}
export function OrderReviewLinks({ order }) {
  const { user } = useAuth();
  if (
    user?.role !== "customer" ||
    order.source !== "web" ||
    order.status !== "Completed" ||
    order.paymentStatus !== "Paid"
  )
    return null;
  const products = [
    ...new Map(
      order.items.map((i) => [String(i.product?._id || i.product), i]),
    ).values(),
  ];
  return (
    <section className="order-review-links no-print">
      <h3>How was your order?</h3>
      <p>
        Share a verified-purchase review. One review per product; you can edit
        it later.
      </p>
      <div>
        {products
          .filter((i) => i.product)
          .map((i) => {
            const id = i.product?._id || i.product;
            return (
              <Link
                className="button outline small"
                key={id}
                to={`/products/${id}/reviews`}
              >
                <Star size={15} />
                Review {i.name}
              </Link>
            );
          })}
      </div>
    </section>
  );
}
export function ReviewNavLink() {
  const { user } = useAuth();
  return user?.role === "admin" ? (
    <NavLink to="/admin/reviews">
      <Star size={18} />
      Reviews
    </NavLink>
  ) : null;
}
