import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { money } from "../utils/currency";
import DemoPayment from "../components/DemoPayment";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
export default function Checkout() {
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState("Cash");
  const [otp, setOtp] = useState(null);
  const [notes, setNotes] = useState("");
  const [promo, setPromo] = useState("");
  const [promotions, setPromotions] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  useEffect(() => {
    api("/promotions")
      .then(setPromotions)
      .catch(() => {});
  }, []);
  const offer = promotions.find((p) => p.code === promo.trim().toUpperCase());
  const discount = offer ? Math.round(cart.total * offer.percent) / 100 : 0;
  async function place() {
    setBusy(true);
    setError("");
    try {
      const order = await api("/orders", {
        method: "POST",
        body: {
          items: cart.items.map((i) => ({
            product: i.product._id,
            quantity: i.quantity,
            customization: i.customization,
          })),
          paymentMethod: method,
          otpSession: method === "Demo GCash" ? otp : undefined,
          promoCode: promo || undefined,
          notes,
          idempotencyKey: key.current,
        },
      });
      cart.clear();
      navigate("/orders/" + order._id, { state: { justOrdered: true } });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (cart.loading) return <Loading />;
  if (!cart.items.length)
    return (
      <div className="page container">
        <EmptyState />
      </div>
    );
  return (
    <div className="container page">
      <div className="page-heading">
        <span className="eyebrow">ONE STEP CLOSER TO HAPPY</span>
        <h1>Let's make it yours.</h1>
        <p>
          Review your order, choose a payment method, and we'll do the rest.
        </p>
      </div>
      <div className="checkout-layout">
        <div className="checkout-main">
          <section className="panel">
            <h3>
              <MapPin size={20} />
              Pickup order
            </h3>
            <p>
              For <b>{user.name}</b> · {user.phone}
            </p>
            <p className="muted">
              Your order will appear in My Orders. Please wait for “Ready for
              Pickup” before collecting. This school demo does not operate a
              physical pickup service.
            </p>
            <label>
              Anything we should know?
              <textarea
                maxLength={300}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special requests (subject to availability)…"
              />
            </label>
          </section>
          <section className="panel">
            <h3>How would you like to pay?</h3>
            <div className="option-buttons">
              {["Cash", "Demo GCash"].map((m) => (
                <button
                  key={m}
                  className={method === m ? "selected" : ""}
                  onClick={() => setMethod(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            {method === "Cash" ? (
              <div className="info">
                Pay cash at pickup. A staff member will record the amount
                received and issue your receipt.
              </div>
            ) : (
              <DemoPayment onVerified={setOtp} />
            )}
          </section>
        </div>
        <aside className="summary-card">
          <h3>Your happy little order</h3>
          {cart.items.map((i) => (
            <div className="summary-line" key={i.key}>
              <span>
                {i.quantity} × {i.product.name}
                <small>{i.product.customizable && i.customization.size}</small>
              </span>
              <b>{money(i.unitPrice * i.quantity)}</b>
            </div>
          ))}
          <label>
            Sweet deal code
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="Have a promo code?"
              maxLength={30}
            />
          </label>
          {promo && (
            <small className={offer ? "green" : "warning-text"}>
              {offer
                ? `${offer.percent}% off — a little treat, on us!`
                : "Code will be validated when you place your order."}
            </small>
          )}
          <div className="summary-line">
            <span>Subtotal</span>
            <span>{money(cart.total)}</span>
          </div>
          {discount > 0 && (
            <div className="summary-line green">
              <span>Discount</span>
              <span>−{money(discount)}</span>
            </div>
          )}
          <div className="summary-line total">
            <span>Total estimate</span>
            <strong>{money(cart.total - discount)}</strong>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button full"
            disabled={busy || (method === "Demo GCash" && !otp)}
            onClick={place}
          >
            <ShoppingBag size={17} />
            {busy ? "Preparing your order…" : "Place my order"}
          </button>
          <small className="muted">
            Final pricing and stock are checked securely at checkout. No real
            money is transferred online.
          </small>
        </aside>
      </div>
    </div>
  );
}
