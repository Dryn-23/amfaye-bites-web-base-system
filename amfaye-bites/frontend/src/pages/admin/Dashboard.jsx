import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ShoppingBag,
  Wallet,
  Package,
  Users,
} from "lucide-react";
import { api } from "../../services/api";
import { money, date } from "../../utils/currency";
import Loading from "../../components/Loading";
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      api("/reports/sales"),
      api("/orders"),
      api("/reports/inventory"),
      api("/customers"),
      api("/reports/products"),
    ])
      .then(([sales, orders, low, customers, products]) =>
        setData({ sales, orders, low, customers, products }),
      )
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">A FRESH LOOK AT YOUR BUSINESS</span>
          <h1>A good day starts here.</h1>
          <p>Every order, every little happy moment.</p>
        </div>
        <Link className="button" to="/admin/pos">
          Open point of sale <ArrowUpRight size={17} />
        </Link>
      </div>
      {error ? (
        <div className="error">{error}</div>
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="stats-grid">
            {[
              [
                Wallet,
                "Recorded revenue",
                money(data.sales.summary.revenue),
                "Includes simulated payments",
              ],
              [ShoppingBag, "Orders", data.orders.length, "Latest 200 orders"],
              [
                Users,
                "Customers",
                data.customers.length,
                "Our little growing family",
              ],
              [
                Package,
                "Low-stock ingredients",
                data.low.length,
                "Keep the kitchen ready",
              ],
            ].map(([Icon, label, val, note]) => (
              <div className="stat-card" key={label}>
                <div>
                  <span>{label}</span>
                  <Icon size={19} />
                </div>
                <strong>{val}</strong>
                <small>{note}</small>
              </div>
            ))}
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="section-heading">
                <h3>Recent orders</h3>
                <Link className="text-link" to="/admin/orders">
                  View all <ArrowUpRight size={15} />
                </Link>
              </div>
              {data.orders.slice(0, 6).map((o) => (
                <div className="dashboard-row" key={o._id}>
                  <div>
                    <b>{o.customerName}</b>
                    <small>{o.number}</small>
                  </div>
                  <span className={"status status-" + o.status.split(" ")[0]}>
                    {o.status}
                  </span>
                  <b>{money(o.total)}</b>
                </div>
              ))}
              {!data.orders.length && (
                <p className="muted">Your first order will appear here.</p>
              )}
            </section>
            <section className="panel">
              <h3>Best-loved bites</h3>
              {data.products.slice(0, 5).map((p, i) => (
                <div className="dashboard-row" key={p._id}>
                  <span className="rank">0{i + 1}</span>
                  <b>{p.name}</b>
                  <small>{p.quantity} sold</small>
                </div>
              ))}
              {!data.products.length && (
                <p className="muted">Sales will bring this list to life.</p>
              )}
            </section>
            <section className="panel">
              <div className="section-heading">
                <h3>Kitchen check-in</h3>
                <Link className="text-link" to="/admin/inventory">
                  Inventory <ArrowUpRight size={15} />
                </Link>
              </div>
              {data.low.length ? (
                data.low.map((i) => (
                  <div className="dashboard-row" key={i._id}>
                    <b>{i.name}</b>
                    <span className="status status-Pending">
                      {i.stock} {i.unit} left
                    </span>
                  </div>
                ))
              ) : (
                <div className="success">
                  Looking good! All ingredients are above their minimum stock.
                </div>
              )}
            </section>
            <section className="panel green-panel">
              <span className="eyebrow">A LITTLE REMINDER</span>
              <h2>
                Small batches.
                <br />
                Big love.
              </h2>
              <p>
                Check orders regularly, keep stock fresh, and make someone's day
                a little sweeter.
              </p>
              <Link className="text-link" to="/admin/orders">
                Let's get started <ArrowUpRight size={16} />
              </Link>
            </section>
          </div>
        </>
      )}
    </>
  );
}
