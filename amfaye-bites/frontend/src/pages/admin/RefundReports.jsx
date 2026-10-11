import { useEffect, useState } from "react";
import { Download, Banknote } from "lucide-react";
import { api } from "../../services/api";
import { money, date } from "../../utils/currency";
import Loading from "../../components/Loading";

export default function RefundReports() {
  const [data, setData] = useState(null);
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
      const d = await api("/reports/refunds?" + q);
      setData(d);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  function csv() {
    const rows = [
      ["Order", "Date", "Customer", "Amount PHP", "Reason", "Processed by"],
      ...data.entries.map((r) => [
        r.order?.number,
        date(r.processedAt || r.createdAt),
        r.customer?.name,
        r.amount,
        r.reason,
        r.processedBy?.name,
      ]),
    ];
    const text = rows
      .map((r) =>
        r
          .map((v) =>
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
    a.download = "amfaye-refunds.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">MONEY BACK TRACKER</span>
          <h1>Refund Report</h1>
          <p>Approved refunds and outstanding refund requests.</p>
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
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
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
              <span>Total refunded</span>
              <strong>{money(data.summary.totalRefunded)}</strong>
              <small>Approved refunds</small>
            </div>
            <div className="stat-card">
              <span>Approved refunds</span>
              <strong>{data.summary.count}</strong>
              <small>Processed</small>
            </div>
            <div className="stat-card">
              <span>Pending requests</span>
              <strong>{money(data.summary.pending)}</strong>
              <small>Awaiting approval</small>
            </div>
            <div className="stat-card">
              <span>Rejected requests</span>
              <strong>{money(data.summary.rejected)}</strong>
              <small>Denied refunds</small>
            </div>
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <h3>Refunds by day</h3>
              <div className="bar-chart">
                {data.daily.slice(-14).map((d) => (
                  <div className="bar-column" key={d._id}>
                    <small>{money(d.total)}</small>
                    <div
                      style={{
                        height: Math.max(
                          5,
                          (d.total /
                            Math.max(...data.daily.map((x) => x.total), 1)) *
                            140,
                        ),
                      }}
                    />
                    <span>{d._id.slice(5)}</span>
                  </div>
                ))}
                {!data.daily.length && (
                  <p className="muted">No refunds in this date range.</p>
                )}
              </div>
            </section>
            <section className="panel">
              <h3>Status overview</h3>
              {data.counts.map((c) => (
                <div className="dashboard-row" key={c._id}>
                  <div>
                    <b>{c._id}</b>
                    <small>{c.count} request(s)</small>
                  </div>
                  <b>{money(c.amount)}</b>
                </div>
              ))}
              {!data.counts.length && <p className="muted">No data.</p>}
            </section>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Processed by</th>
                  <th>Processed</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((r) => (
                  <tr key={r._id}>
                    <td>{r.order?.number}</td>
                    <td>{r.customer?.name}</td>
                    <td><strong>{money(r.amount)}</strong></td>
                    <td>{r.reason && r.reason.slice(0, 80)}{r.reason?.length > 80 ? "…" : ""}</td>
                    <td>{r.processedBy?.name || "—"}</td>
                    <td>{r.processedAt ? new Date(r.processedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.entries.length && (
              <div className="empty compact">
                <h3>No approved refunds in this range.</h3>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
