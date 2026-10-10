import { useState } from "react";
import { Gift, Check, ShoppingBag } from "lucide-react";
import { money } from "../utils/currency";

export default function BundleDeals({ bundles, onSelect }) {
  const [added, setAdded] = useState("");
  if (!bundles || bundles.length === 0) return null;

  return (
    <div className="bundle-deals-section">
      <h2>🎁 Bundle Deals</h2>
      <p className="muted">Mix and save! Special combo offers just for you.</p>

      <div className="bundle-deals-grid">
        {bundles.map((bundle) => (
          <div key={bundle._id} className="bundle-deal">
            <div className="bundle-deal-content">
              <h3>
                <Gift size={20} />
                {bundle.name}
              </h3>
              <p style={{ opacity: 0.9, margin: "0.5rem 0" }}>
                {bundle.description}
              </p>

              <div style={{ margin: "1rem 0" }}>
                <div style={{
                  fontSize: "0.85rem",
                  opacity: 0.9,
                  marginBottom: "0.5rem"
                }}>
                  Includes:
                </div>
                {bundle.items.map((item, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.25rem"
                  }}>
                    <Check size={16} />
                    <span>{item.quantity}× {item.name}</span>
                  </div>
                ))}
              </div>

              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "1rem"
              }}>
                <div>
                  <div style={{
                    textDecoration: "line-through",
                    opacity: 0.7,
                    fontSize: "0.9rem"
                  }}>
                    {money(bundle.originalPrice)}
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "700" }}>
                    {money(bundle.bundlePrice)}
                  </div>
                </div>

                <span className="bundle-savings">
                  Save {money(bundle.originalPrice - bundle.bundlePrice)}
                </span>
              </div>

              <button
                className="button"
                style={{
                  width: "100%",
                  marginTop: "1rem",
                  background: "rgba(255, 255, 255, 0.9)",
                  color: "#667eea"
                }}
                onClick={() => {
                  onSelect(bundle);
                  setAdded(bundle._id);
                  setTimeout(() => setAdded(""), 1600);
                }}
              >
                {added === bundle._id ? (
                  <>
                    <Check size={16} /> Added to your bag
                  </>
                ) : (
                  <>
                    <ShoppingBag size={16} /> Add Bundle to Cart
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
