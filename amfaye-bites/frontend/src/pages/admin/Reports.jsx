import { useEffect, useState } from "react";
import { Download, BarChart3 } from "lucide-react";
import { api } from "../../services/api";
import { money, date } from "../../utils/currency";
import Loading from "../../components/Loading";
export default function Reports({ salesOnly = false }) {
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  async function load() {
    setError("");
    try {
      const q = new URLSearchParams({
        ...(from && { from }),
        ...(to && { to }),
      });
      const [d, p] = await Promise.all([
        api("/reports/sales?" + q),
        api("/reports/products?" + q),
      ]);
      setData(d);
      setProducts(p);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function csv() {
    const rows = [
      ["Order", "Date", "Customer", "Payment method", "Total PHP"],
      ...data.entries.map((s) => [
        s.order?.number,
        date(s.createdAt),
        s.order?.customerName,
        s.order?.paymentMethod,
        s.amount,
      ]),
    ];
    const text = rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v ?? "")
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "amfaye-sales.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">THE NUMBERS BEHIND THE HAPPY</span>
          <h1>{salesOnly ? "Sales" : "Reports"}</h1>
          <p>Recorded payments, including simulated demo transactions.</p>
        </div>
        <button className="button outline" disabled={!data} onClick={csv}>
          <Download size={17} />
          Export CSV
        </button>
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
        <button className="button">Apply dates</button>
        <small className="muted">Philippine time · All dates when blank</small>
      </form>
      {error && <div className="error">{error}</div>}
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="stats-grid three">
            <div className="stat-card">
              <span>Net recorded revenue</span>
              <strong>{money(data.summary.revenue)}</strong>
              <small>Non-voided payments</small>
            </div>
            <div className="stat-card">
              <span>Paid transactions</span>
              <strong>{data.summary.count}</strong>
              <small>Cash and demo GCash</small>
            </div>
            <div className="stat-card">
              <span>Discounts given</span>
              <strong>{money(data.summary.discount)}</strong>
              <small>A little extra happy</small>
            </div>
          </div>
          {!salesOnly && (
            <div className="dashboard-grid">
              <section className="panel">
                <h3>Revenue by day</h3>
                <div className="bar-chart">
                  {data.daily.slice(-14).map((d) => (
                    <div className="bar-column" key={d._id}>
                      <small>{money(d.total)}</small>
                      <div
                        style={{
                          height: Math.max(
                            5,
                            (d.total /
                              Math.max(...data.daily.map((x) => x.total))) *
                              140,
                          ),
                        }}
                      />
                      <span>{d._id.slice(5)}</span>
                    </div>
                  ))}
                  {!data.daily.length && (
                    <p className="muted">
                      Your sales story starts with your first paid order.
                    </p>
                  )}
                </div>
              </section>
              <section className="panel">
                <h3>Product performance</h3>
                <small className="muted">
                  Gross item sales, before order-level discounts
                </small>
                {products.map((p) => (
                  <div className="dashboard-row" key={p._id}>
                    <div>
                      <b>{p.name}</b>
                      <small>{p.quantity} sold</small>
                    </div>
                    <b>{money(p.grossRevenue)}</b>
                  </div>
                ))}
              </section>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((s) => (
                  <tr key={s._id}>
                    <td>{s.order?.number}</td>
                    <td>{date(s.createdAt)}</td>
                    <td>{s.order?.customerName}</td>
                    <td>{s.order?.paymentMethod}</td>
                    <td>{money(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.entries.length && (
              <div className="empty compact">
                <h3>No sales in this date range.</h3>
              </div>
            )}
          </div>
          <p className="tiny">
            Export and transaction list show the latest 500 payments. Summary
            totals include all matching payments.
          </p>
        </>
      )}
    </>
  );
}
