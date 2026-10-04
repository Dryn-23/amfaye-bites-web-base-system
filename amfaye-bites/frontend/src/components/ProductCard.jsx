import ProductRating from "./ReviewLinks";
import { Plus, ArrowUpRight, Package } from "lucide-react";
import { money } from "../utils/currency";
import LazyImage from "./LazyImage";

export default function ProductCard({ product, onSelect }) {
  const isLowStock = product.stock > 0 && product.stock <= product.minimumStock;
  const stockPercentage = Math.min((product.stock / (product.minimumStock * 2)) * 100, 100);

  return (
    <article className="product-card interactive-card">
      <button
        className="product-image"
        onClick={() => onSelect(product)}
        aria-label={`View ${product.name}`}
      >
        <LazyImage
          src={product.image || "/hero.png"}
          alt={product.name}
          className="product-img"
        />
        {product.badge && (
          <span
            className={
              "badge glow-on-hover " + (product.badge === "Bestseller" ? "gold" : "")
            }
          >
            {product.badge === "Bestseller" ? "★ " : ""}
            {product.badge}
          </span>
        )}
        {!product.available && (
          <span className="sold-out">Sold out for now</span>
        )}
        {product.available && isLowStock && (
          <span className="low-stock">
            <Package size={14} />
            Only {product.stock} left!
          </span>
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
        <ProductRating product={product._id} />

        {/* Stock indicator bar */}
        {product.available && product.stock <= product.minimumStock * 2 && (
          <div style={{ margin: "0.5rem 0" }}>
            <div
              style={{
                height: "3px",
                background: "#e0e0e0",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                className="progress-fill"
                style={{
                  width: `${stockPercentage}%`,
                  height: "100%",
                  background: stockPercentage < 30 ? "#f44336" :
                              stockPercentage < 60 ? "#ff9800" : "#4CAF50",
                }}
              />
            </div>
          </div>
        )}

        <div className="product-bottom">
          <span>
            {money(product.price)}
            {product.customizable && <small> / small</small>}
          </span>
          <button
            className="add-btn glow-on-hover"
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
