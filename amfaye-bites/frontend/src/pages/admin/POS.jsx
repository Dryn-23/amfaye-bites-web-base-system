import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  ShoppingBag,
  Trash2,
  CheckCircle2,
  Printer,
  Plus,
  Minus,
} from "lucide-react";
import { api } from "../../services/api";
import { money } from "../../utils/currency";
import ProductModal from "../../components/ProductModal";
import DemoPayment from "../../components/DemoPayment";
export default function POS() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [method, setMethod] = useState("Cash");
  const [received, setReceived] = useState("");
  const [promo, setPromo] = useState("");
  const [offers, setOffers] = useState([]);
  const [otp, setOtp] = useState(null);
  const [payment, setPayment] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const [customer, setCustomer] = useState("Walk-in customer");
  const key = useRef(crypto.randomUUID());
  const load = () =>
    api("/products")
      .then(setProducts)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api("/promotions")
      .then(setOffers)
      .catch(() => {});
  }, []);
  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const offer = offers.find((o) => o.code === promo.trim().toUpperCase());
  const discount = offer ? Math.round(total * offer.percent) / 100 : 0;
  const due = Math.round((total - discount) * 100) / 100;
  const add = (product, quantity, customization, unitPrice) =>
    setItems((old) => [
      ...old,
      { key: crypto.randomUUID(), product, quantity, customization, unitPrice },
    ]);
  async function pay() {
    setBusy(true);
    setError("");
    try {
      const o = await api("/orders", {
        method: "POST",
        body: {
          source: "pos",
          customerName: customer,
          items: items.map((i) => ({
            product: i.product._id,
            quantity: i.quantity,
            customization: i.customization,
          })),
          paymentMethod: method,
          amountReceived: method === "Cash" ? Number(received) : undefined,
          otpSession: method === "Demo GCash" ? otp : undefined,
          promoCode: promo || undefined,
          idempotencyKey: key.current,
        },
      });
      setOrder(o);
      setItems([]);
      setPayment(false);
      setReceived("");
      setOtp(null);
      key.current = crypto.randomUUID();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">LET'S MAKE SOMEONE'S DAY</span>
          <h1>Point of sale</h1>
        </div>
        <span className="live-label">
          <span />
          Ready to take orders
        </span>
      </div>
      {error && (
        <div className="error">
          {error}
          <button className="text-button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      {order && (
        <div className="success">
          <CheckCircle2 size={21} />
          <span>
            Order {order.number} complete · {money(order.total)}
          </span>
          <Link className="text-link" to={"/orders/" + order._id}>
            <Printer size={16} />
            View receipt
          </Link>
          <button className="text-button" onClick={() => setOrder(null)}>
            Dismiss
          </button>
        </div>
      )}
      <div className="pos-layout">
        <div className="pos-menu">
          <div className="search-field">
            <Search size={18} />
            <input
              placeholder="Search the menu…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="tabs">
            {["All", "Pastries", "Fruit Shakes"].map((c) => (
              <button
                key={c}
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="pos-products">
            {products
              .filter(
                (p) =>
                  (category === "All" || p.category?.name === category) &&
                  p.name.toLowerCase().includes(query.toLowerCase()),
              )
              .map((p) => (
                <button
                  className="pos-product"
                  key={p._id}
                  disabled={!p.available}
                  onClick={() => setSelected(p)}
                >
                  <img src={p.image || "/hero.png"} alt={p.name} />
                  <span>{p.name}</span>
                  <div>
                    <b>{money(p.price)}</b>
                    <small>
                      {!p.available
                        ? "Unavailable"
                        : p.lowStock
                          ? "Low stock"
                          : `${p.stock} left`}
                    </small>
                  </div>
                </button>
              ))}
          </div>
        </div>
        <aside className="pos-cart">
          <div className="section-heading">
            <h3>Current order</h3>
            <button
              className="icon-btn"
              aria-label="Clear order"
              onClick={() => setItems([])}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <input
            aria-label="Customer name"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Customer name"
            maxLength={100}
          />
          <div className="pos-items">
            {!items.length ? (
              <div className="empty compact">
                <ShoppingBag size={32} />
                <h3>A fresh start.</h3>
                <p>Tap a product to add a little happy.</p>
              </div>
            ) : (
              items.map((i) => (
                <div className="pos-item" key={i.key}>
                  <div>
                    <b>{i.product.name}</b>
                    {i.product.customizable && (
                      <small>
                        {i.customization.size} · {i.customization.sugar}
                      </small>
                    )}
                    <strong>{money(i.unitPrice * i.quantity)}</strong>
                  </div>
                  <div className="quantity">
                    <button
                      aria-label="Decrease"
                      onClick={() =>
                        setItems(
                          items.flatMap((x) =>
                            x.key === i.key
                              ? x.quantity === 1
                                ? []
                                : [{ ...x, quantity: x.quantity - 1 }]
                              : [x],
                          ),
                        )
                      }
                    >
                      <Minus size={12} />
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      aria-label="Increase"
                      onClick={() =>
                        setItems(
                          items.map((x) =>
                            x.key === i.key
                              ? {
                                  ...x,
                                  quantity: Math.min(
                                    99,
                                    x.product.stock,
                                    x.quantity + 1,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <label>
            Promo code
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <div className="summary-line">
            <span>Subtotal</span>
            <b>{money(total)}</b>
          </div>
          <div className="summary-line">
            <span>Discount</span>
            <b>−{money(discount)}</b>
          </div>
          <div className="summary-line total">
            <span>Total</span>
            <b>{money(due)}</b>
          </div>
          <button
            className="button full"
            disabled={!items.length}
            onClick={() => {
              setPayment(true);
              setError("");
            }}
          >
            Continue to payment
          </button>
          <small className="centered muted">Pickup · Prices in PHP</small>
        </aside>
      </div>
      {selected && (
        <ProductModal
          product={selected}
          onClose={() => setSelected(null)}
          onAdd={add}
        />
      )}{" "}
      {payment && (
        <div className="modal-backdrop">
          <section className="payment-modal panel">
            <div className="section-heading">
              <h2>Finish with a little happy.</h2>
              <button
                className="icon-btn"
                onClick={() => setPayment(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="summary-line total">
              <span>Amount due</span>
              <b>{money(due)}</b>
            </div>
            <div className="option-buttons">
              {["Cash", "Demo GCash"].map((m) => (
                <button
                  key={m}
                  className={m === method ? "selected" : ""}
                  onClick={() => setMethod(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            {method === "Cash" ? (
              <>
                <label>
                  Amount received
                  <input
                    type="number"
                    min={due}
                    step="0.01"
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                </label>
                <div className="summary-line">
                  <span>Change</span>
                  <b className="green">
                    {money(Math.max(0, Number(received) - due))}
                  </b>
                </div>
              </>
            ) : (
              <DemoPayment onVerified={setOtp} />
            )}{" "}
            {error && <div className="error">{error}</div>}
            <button
              className="button full"
              disabled={
                busy || (method === "Cash" ? Number(received) < due : !otp)
              }
              onClick={pay}
            >
              {busy ? "Processing…" : "Complete order"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}
