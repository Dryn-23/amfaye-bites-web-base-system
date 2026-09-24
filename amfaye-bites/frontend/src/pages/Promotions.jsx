import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Copy, Check } from "lucide-react";
import { api } from "../services/api";
export default function Promotions() {
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  useEffect(() => {
    api("/promotions")
      .then(setOffers)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="container page">
      <div className="page-heading centered">
        <span className="eyebrow">SWEET TREATS. SWEETER DEALS.</span>
        <h1>A little extra happy.</h1>
        <p>
          Because your favorite things are even better with a little treat on
          us.
        </p>
      </div>
      {error && <div className="error">{error}</div>}
      {offers.map((o) => (
        <section className="offer-card" key={o._id}>
          <div>
            <span className="eyebrow">YOUR NEXT FEEL-GOOD FAVORITE</span>
            <h2>{o.name}</h2>
            <p>{o.description}</p>
            <button
              className="promo-code"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(o.code);
                  setCopied(o.code);
                } catch {
                  setCopied("Select and copy the code below");
                }
              }}
            >
              {o.code}{" "}
              {copied === o.code ? <Check size={17} /> : <Copy size={17} />}
            </button>
            <small>
              {copied === o.code
                ? "Copied! Apply at checkout."
                : "Use this code at checkout. One code per order."}
            </small>
            <Link to="/menu" className="button">
              Find your happy bite <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="offer-percent">
            {o.percent}
            <span>
              %<small>OFF YOUR ORDER</small>
            </span>
          </div>
        </section>
      ))}
      <p className="centered muted">
        Offers are subject to availability. Discounts are validated at checkout.
      </p>
    </div>
  );
}
