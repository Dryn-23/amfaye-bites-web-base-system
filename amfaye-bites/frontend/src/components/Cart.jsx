import { Trash2, Minus, Plus } from "lucide-react";
import { money } from "../utils/currency";
export default function CartItems({ items, update, remove }) {
  return (
    <div className="cart-items">
      {items.map((i) => (
        <div className="cart-item" key={i.key}>
          <img src={i.product.image || "/hero.png"} alt={i.product.name} />
          <div className="cart-item-details">
            <h4>{i.product.name}</h4>
            {i.product.customizable && (
              <small>
                {i.customization.size} · {i.customization.sugar} sugar ·{" "}
                {i.customization.ice}
                {i.customization.addons.length > 0 &&
                  ` · ${i.customization.addons.length} add-on(s)`}
              </small>
            )}
            <span className="muted">{money(i.unitPrice)} each</span>
          </div>
          <div className="quantity">
            <button
              onClick={() => update(i.key, i.quantity - 1)}
              aria-label="Decrease quantity"
            >
              <Minus size={13} />
            </button>
            <span>{i.quantity}</span>
            <button
              onClick={() => update(i.key, i.quantity + 1)}
              aria-label="Increase quantity"
            >
              <Plus size={13} />
            </button>
          </div>
          <strong>{money(i.quantity * i.unitPrice)}</strong>
          <button
            className="icon-btn"
            onClick={() => remove(i.key)}
            aria-label={`Remove ${i.product.name}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
