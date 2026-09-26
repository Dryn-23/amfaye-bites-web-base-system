import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, TriangleAlert, RefreshCw, ArrowUpRight } from "lucide-react";
import { api } from "../services/api";
import "./stockAlerts.css";

export default function ProductStockAlerts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    let loading = false;
    const load = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const result = await api("/products/stock-alerts");
        if (active) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        loading = false;
      }
    };
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [refreshKey]);
  return (
    <section
      className="panel product-stock-panel"
      aria-label="Product stock alerts"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">KEEP YOUR FAVORITES IN STOCK</span>
          <h3>Product stock alerts</h3>
        </div>
        <button
          className="button small outline"
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          <RefreshCw size={14} />
          Refresh stock
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          Stock alerts could not refresh: {error}
        </div>
      )}
      {!data ? (
        <p className="muted">Checking product stock…</p>
      ) : (
        <>
          <div className="stock-summary-grid">
            <Link to="/admin/products?stock=low" className="stock-summary">
              <span>
                <TriangleAlert size={18} />
                Low-stock products
              </span>
              <strong>{data.lowStockCount}</strong>
              <small>1 to minimum stock · Restock soon</small>
            </Link>
            <Link to="/admin/products?stock=out" className="stock-summary">
              <span>
                <Package size={18} />
                Out-of-stock products
              </span>
              <strong>{data.outOfStockCount}</strong>
              <small>Zero servings · Cannot be ordered</small>
            </Link>
          </div>
          {data.items.length ? (
            <div className="stock-alert-list">
              {data.items.slice(0, 8).map((p) => (
                <Link
                  key={p._id}
                  to={`/admin/products?stock=${p.stock <= 0 ? "out" : "low"}&q=${encodeURIComponent(p.name)}`}
                  className="stock-alert-row"
                >
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {p.category?.name} · Minimum: {p.minimumStock} servings
                    </small>
                  </div>
                  <span
                    className={`status ${p.stock <= 0 ? "status-Cancelled" : "status-Pending"}`}
                  >
                    {p.stockStatus} · {p.stock} left
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="success">
              All enabled products are above their minimum serving stock.
            </div>
          )}
          <div className="stock-alert-footer">
            <small>
              Serving stock only · Disabled products excluded · Updates every 30
              seconds
            </small>
            <Link className="text-link" to="/admin/products?stock=alerts">
              View all stock alerts <ArrowUpRight size={14} />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
