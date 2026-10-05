import { useEffect, useState } from "react";
import { Wallet, Download, User } from "lucide-react";
import { api } from "../../services/api";
import { money } from "../../utils/currency";
import Loading from "../../components/Loading";

// Opening float the drawer started with. Kept as a constant for now; a real
// shift-closing flow would record the counted amount against this.
const OPENING_FLOAT = 500;

export default function ShiftReport() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [only, setOnly] = useState("");
  const [counted, setCounted] = useState("");

  async function load() {
    setError("");
    try {
      const q = new URLSearchParams({
        ...(from && { from }),
        ...(to && { to }),
        ...(only && { user: only }),
      });
      setData(await api("/reports/cashDrawer?" + q));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const variance =
    counted === "" ? null : Number(counted) - (data?.totals.expected || 0);

  function csv() {
    const rows = [
      ["Cashier", "Cash orders", "Sales PHP", "Received PHP", "Change PHP", "Expected PHP"],
      ...data.rows.map((r) => [
        r.name,
        r.orders,
        r.sales,
        r.received,
        r.change,
        r.expected,
      ]),
      ["TOTAL", data.totals.orders, data.totals.sales, data.totals.received, data.totals.change, data.totals.expected],
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
      new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "amfaye-cash-drawer.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">TILLING UP THE DAY</span>
          <h1>Cash drawer</h1>
          <p>
            What each cashier took in, what they gave back as change, and what
            the drawer should hold.
          </p>
        </div>
        <button
          className="button outline"
          disabled={!data}
          onClick={csv}
        >
          <Download size={17} /> Export CSV
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
        <label>
          Cashier
          <select value={only} onChange={(e) => setOnly(e.target.value)}>
            <option value="">Everyone</option>
            {data?.rows
              .filter((r) => r.cashier)
              .map((r) => (
                <option key={r.cashier} value={r.cashier}>
                  {r.name}
                </option>
              ))}
          </select>
        </label>
        <button className="button">Apply</button>
        <small className="muted">Philippine time · All dates when blank</small>
      </form>

      {error && <div className="error">{error}</div>}
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="stats-grid three">
            <div className="stat-card">
              <span>Cash orders</span>
              <strong>{data.totals.orders}</strong>
              <small>Settled at the counter</small>
            </div>
            <div className="stat-card">
              <span>Cash received</span>
              <strong>{money(data.totals.received)}</strong>
              <small>Handed over by customers</small>
            </div>
            <div className="stat-card">
              <span>Change given</span>
              <strong>{money(data.totals.change)}</strong>
              <small>Already back to customers</small>
            </div>
            <div className="stat-card">
              <span>Expected in drawer</span>
              <strong>
                {money(data.totals.expected + (OPENING_FLOAT || 0))}
              </strong>
              <small>Includes {money(OPENING_FLOAT)} opening float</small>
            </div>
          </div>

          <section className="panel" style={{ marginBottom: "1.25rem" }}>
            <h3>
              <Wallet size={17} /> Count the drawer
            </h3>
            <form
              className="report-filters"
              onSubmit={(e) => e.preventDefault()}
            >
              <label>
                Cash counted
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                  placeholder={data.totals.expected + OPENING_FLOAT}
                />
              </label>
            </form>
            {variance !== null && (
              <div
                className={variance === 0 ? "info" : variance < 0 ? "error" : "warning"}
                role="status"
              >
                {variance === 0
                  ? "Drawer balances exactly."
                  : variance < 0
                    ? `Short by ${money(Math.abs(variance))}.`
                    : `Over by ${money(variance)}.`}
              </div>
            )}
            <small className="muted">
              Expected = {money(data.totals.expected)} net cash +{" "}
              {money(OPENING_FLOAT)} opening float.
            </small>
          </section>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cashier</th>
                  <th>Orders</th>
                  <th>Sales</th>
                  <th>Received</th>
                  <th>Change</th>
                  <th>Expected</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.cashier || "web"}>
                    <td>
                      <b>{r.name}</b>
                      {!r.cashier && (
                        <small className="muted"> Paid at pickup</small>
                      )}
                    </td>
                    <td>{r.orders}</td>
                    <td>{money(r.sales)}</td>
                    <td>{money(r.received)}</td>
                    <td>{money(r.change)}</td>
                    <td>
                      <b>{money(r.expected)}</b>
                    </td>
                  </tr>
                ))}
                {!data.rows.length && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty compact">
                        <User size={28} />
                        <h3>No cash payments in this range.</h3>
                        <p>Demo GCash and unpaid orders are not in the drawer.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {!!data.rows.length && (
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{data.totals.orders}</td>
                    <td>{money(data.totals.sales)}</td>
                    <td>{money(data.totals.received)}</td>
                    <td>{money(data.totals.change)}</td>
                    <td>
                      <b>{money(data.totals.expected)}</b>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="tiny">
            Voided payments are excluded. Only settled Cash payments count —
            demo GCash is simulated and never entered the drawer.
          </p>
        </>
      )}
    </>
  );
}