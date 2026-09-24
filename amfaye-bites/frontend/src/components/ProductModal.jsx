import { useEffect, useState } from "react";
import { X, Minus, Plus, ShoppingBag, Check } from "lucide-react";
import { useCart } from "../context/CartContext";
import { money } from "../utils/currency";
import { api } from "../services/api";
export default function ProductModal({ product: p, onClose, onAdd }) {
  const cart = useCart();
  const [size, setSize] = useState("Small");
  const [sugar, setSugar] = useState("100%");
  const [ice, setIce] = useState("Regular Ice");
  const [addons, setAddons] = useState([]);
  const [selected, setSelected] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (p.customizable)
      api("/addons")
        .then(setAddons)
        .catch((e) => setError(e.message));
    const close = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = prev;
    };
  }, [p]);
  const price =
    p.price +
    { Small: 0, Medium: 20, Large: 40 }[size] +
    addons
      .filter((a) => selected.includes(a._id))
      .reduce((n, a) => n + a.price, 0);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-title"
        className="product-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <X />
        </button>
        <img
          className="modal-photo"
          src={p.image || "/hero.png"}
          alt={p.name}
        />
        <div className="modal-content">
          <span className="eyebrow">{p.category?.name} · Made with love</span>
          <h2 id="product-title">{p.name}</h2>
          <p className="muted">{p.description}</p>
          <h3 className="green">{money(price)}</h3>
          {error && <div className="error">{error}</div>}
          {p.customizable && (
            <>
              <Option
                title="Choose your size"
                values={["Small", "Medium", "Large"]}
                value={size}
                onChange={setSize}
              />
              <Option
                title="Just the right sweetness"
                values={["0%", "25%", "50%", "75%", "100%"]}
                value={sugar}
                onChange={setSugar}
              />
              <Option
                title="Ice preference"
                values={["Less Ice", "Regular Ice", "Extra Ice"]}
                value={ice}
                onChange={setIce}
              />
              <label className="field-label">Make it extra special</label>
              <div className="addon-list">
                {addons.map((a) => (
                  <label key={a._id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(a._id)}
                      onChange={() =>
                        setSelected((s) =>
                          s.includes(a._id)
                            ? s.filter((x) => x !== a._id)
                            : [...s, a._id],
                        )
                      }
                    />
                    {a.name}
                    <span>+{money(a.price)}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          {p.stock <= p.minimumStock && p.stock > 0 && (
            <p className="warning-text">
              Only {p.stock} left — baked in small batches.
            </p>
          )}
          <div className="modal-bottom">
            <div className="quantity">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label="Decrease"
              >
                <Minus size={15} />
              </button>
              <span>{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(99, p.stock, quantity + 1))}
                aria-label="Increase"
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              className="button"
              disabled={!p.available || added || !!error}
              onClick={() => {
                (onAdd || cart.add)(
                  p,
                  quantity,
                  { size, sugar, ice, addons: selected },
                  price,
                );
                setAdded(true);
                setTimeout(onClose, 600);
              }}
            >
              {added ? <Check size={18} /> : <ShoppingBag size={18} />}{" "}
              {added
                ? "Added to your bag"
                : p.available
                  ? `Add to order · ${money(price * quantity)}`
                  : "Currently unavailable"}
            </button>
          </div>
          <small className="muted">
            Freshly prepared for pickup. Prices are in Philippine pesos.
          </small>
        </div>
      </section>
    </div>
  );
}
export function Option({ title, values, value, onChange }) {
  return (
    <div className="option">
      <label className="field-label">{title}</label>
      <div className="option-buttons">
        {values.map((v) => (
          <button
            className={v === value ? "selected" : ""}
            key={v}
            onClick={() => onChange(v)}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
