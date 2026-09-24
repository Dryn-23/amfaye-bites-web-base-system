import { Plus, ArrowUpRight } from "lucide-react";
import { money } from "../utils/currency";
export default function ProductCard({ product, onSelect }) {
  return (
    <article className="product-card">
      <button
        className="product-image"
        onClick={() => onSelect(product)}
        aria-label={`View ${product.name}`}
      >
        <img
          src={product.image || "/hero.png"}
          alt={product.name}
          loading="lazy"
        />
        {product.badge && (
          <span
            className={
              "badge " + (product.badge === "Bestseller" ? "gold" : "")
            }
          >
            {product.badge === "Bestseller" ? "★ " : ""}
            {product.badge}
          </span>
        )}
        {!product.available && (
          <span className="sold-out">Sold out for now</span>
        )}
        <span className="image-arrow">
          <ArrowUpRight size={18} />
        </span>
      </button>
      <div className="product-body">
        <span className="product-category">{product.category?.name}</span>
        <button className="product-name" onClick={() => onSelect(product)}>
          {product.name}
        </button>
        <p>{product.description}</p>
        <div className="product-bottom">
          <span>
            {money(product.price)}
            {product.customizable && <small> / small</small>}
          </span>
          <button
            className="add-btn"
            disabled={!product.available}
            onClick={() => onSelect(product)}
            aria-label={`Add ${product.name}`}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}
