import { useEffect, useState } from "react";
import { TrendingUp, Clock, CreditCard, PieChart } from "lucide-react";
import { api } from "../../services/api";
import { money } from "../../utils/currency";
import Loading from "../../components/Loading";
import SalesChart from "../../components/charts/SalesChart";
import ProductPieChart from "../../components/charts/ProductPieChart";
import CategoryBarChart from "../../components/charts/CategoryBarChart";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        ...(from && { from }),
        ...(to && { to }),
      });
      const [sales, products, categories, peakHours, paymentMethods, monthly] =
        await Promise.all([
          api("/reports/sales?" + q),
          api("/reports/products?" + q),
          api("/reports/categoryPerformance?" + q),
          api("/reports/peakHours?" + q),
          api("/reports/paymentMethods?" + q),
          api("/reports/monthlyComparison"),
        ]);
      setData({ sales, products, categories, peakHours, paymentMethods, monthly });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">ENHANCED ANALYTICS</span>
          <h1>Deep Dive Into Your Business</h1>
          <p>Comprehensive insights and data visualization</p>
        </div>
      </div>

      <form
        className="report-filters panel"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Through
          <input
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="button" disabled={loading}>
          {loading ? "Loading..." : "Apply Filter"}
        </button>
        <button
          type="button"
          className="button outline"
          onClick={() => {
            setFrom("");
            setTo("");
            setTimeout(load, 0);
          }}
        >
          Clear
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {!data ? (
        <Loading />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div>
                <span>Total Revenue</span>
                <TrendingUp size={19} />
              </div>
              <strong>{money(data.sales.summary.revenue)}</strong>
              <small>Net recorded revenue</small>
            </div>
            <div className="stat-card">
              <div>
                <span>Total Orders</span>
                <PieChart size={19} />
              </div>
              <strong>{data.sales.summary.count}</strong>
              <small>Paid transactions</small>
            </div>
            <div className="stat-card">
              <div>
                <span>Average Order</span>
                <CreditCard size={19} />
              </div>
              <strong>
                {data.sales.summary.count > 0
                  ? money(data.sales.summary.revenue / data.sales.summary.count)
                  : money(0)}
              </strong>
              <small>Revenue per order</small>
            </div>
            <div className="stat-card">
              <div>
                <span>Discounts Given</span>
                <TrendingUp size={19} />
              </div>
              <strong>{money(data.sales.summary.discount)}</strong>
              <small>Promotional savings</small>
            </div>
          </div>

          {/* Sales Trend Chart */}
          <div className="panel">
            <h3>📈 Sales Trend</h3>
            <small className="muted">Daily revenue over time</small>
            {data.sales.daily.length > 0 ? (
              <SalesChart daily={data.sales.daily} />
            ) : (
              <p className="muted" style={{ padding: "40px", textAlign: "center" }}>
                No sales data for the selected period
              </p>
            )}
          </div>

          <div className="dashboard-grid">
            {/* Product Distribution */}
            <section className="panel">
              <h3>🥧 Product Distribution</h3>
              <small className="muted">Top 10 products by quantity sold</small>
              {data.products.length > 0 ? (
                <ProductPieChart products={data.products} />
              ) : (
                <p className="muted" style={{ padding: "40px", textAlign: "center" }}>
                  No product sales yet
                </p>
              )}
            </section>

            {/* Category Performance */}
            <section className="panel">
              <h3>📊 Category Performance</h3>
              <small className="muted">Revenue and quantity by category</small>
              {data.categories.length > 0 ? (
                <CategoryBarChart categoryData={data.categories} />
              ) : (
                <p className="muted" style={{ padding: "40px", textAlign: "center" }}>
                  No category data available
                </p>
              )}
            </section>
          </div>

          <div className="dashboard-grid">
            {/* Peak Hours */}
            <section className="panel">
              <h3>🕐 Peak Hours Analysis</h3>
              <small className="muted">Orders by hour of day</small>
              <div style={{ marginTop: "20px" }}>
                {data.peakHours.length > 0 ? (
                  data.peakHours.map((h) => (
                    <div className="dashboard-row" key={h._id}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Clock size={16} />
                        <b>
                          {h._id === 0 ? "12" : h._id > 12 ? h._id - 12 : h._id}:00{" "}
                          {h._id >= 12 ? "PM" : "AM"}
                        </b>
                      </div>
                      <small>{h.count} orders</small>
                      <b>{money(h.revenue)}</b>
                    </div>
                  ))
                ) : (
                  <p className="muted">No hourly data available</p>
                )}
              </div>
            </section>

            {/* Payment Methods */}
            <section className="panel">
              <h3>💳 Payment Methods</h3>
              <small className="muted">Revenue by payment type</small>
              <div style={{ marginTop: "20px" }}>
                {data.paymentMethods.length > 0 ? (
                  data.paymentMethods.map((pm) => (
                    <div className="dashboard-row" key={pm._id}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <CreditCard size={16} />
                        <b>{pm._id}</b>
                      </div>
                      <small>{pm.count} orders</small>
                      <b>{money(pm.revenue)}</b>
                    </div>
                  ))
                ) : (
                  <p className="muted">No payment data available</p>
                )}
              </div>
            </section>
          </div>

          {/* Monthly Comparison */}
          <div className="panel">
            <h3>📅 Year-to-Date Monthly Comparison</h3>
            <small className="muted">Current year performance by month</small>
            <div className="bar-chart" style={{ marginTop: "20px" }}>
              {data.monthly.length > 0 ? (
                data.monthly.map((m) => (
                  <div className="bar-column" key={m._id}>
                    <small>{money(m.revenue)}</small>
                    <div
                      style={{
                        height: Math.max(
                          5,
                          (m.revenue / Math.max(...data.monthly.map((x) => x.revenue))) *
                            140
                        ),
                      }}
                    />
                    <span>{monthNames[m._id - 1]}</span>
                    <small style={{ fontSize: "10px" }}>{m.count} orders</small>
                  </div>
                ))
              ) : (
                <p className="muted">No monthly data available</p>
              )}
            </div>
          </div>

          {/* Top Products Table */}
          <div className="panel">
            <h3>🏆 Top Performing Products</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Product</th>
                    <th>Quantity Sold</th>
                    <th>Revenue</th>
                    <th>Avg Price</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.slice(0, 10).map((p, i) => (
                    <tr key={p._id}>
                      <td>
                        <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                      </td>
                      <td>
                        <b>{p.name}</b>
                      </td>
                      <td>{p.quantity}</td>
                      <td>{money(p.grossRevenue)}</td>
                      <td>{money(p.grossRevenue / p.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.products.length === 0 && (
                <div className="empty compact">
                  <h3>No product sales yet</h3>
                  <p>Start selling to see product performance</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
