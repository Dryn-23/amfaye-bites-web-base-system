import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { money, date } from "../../utils/currency";
import Loading from "../../components/Loading";
const next = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Preparing", "Cancelled"],
  Preparing: ["Ready for Pickup"],
  "Ready for Pickup": ["Completed"],
  Completed: [],
  Cancelled: [],
};
export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");
  const [collect, setCollect] = useState(null);
  const [received, setReceived] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    api("/orders")
      .then(setOrders)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">FROM OUR KITCHEN TO THEIR DAY</span>
          <h1>Orders</h1>
        </div>
        <button className="button outline small" onClick={load}>
          Refresh orders
        </button>
      </div>
      <div className="tabs">
        {[
          "All",
          "Pending",
          "Confirmed",
          "Preparing",
          "Ready for Pickup",
          "Completed",
          "Cancelled",
        ].map((s) => (
          <button
            key={s}
            className={filter === s ? "active" : ""}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {!orders ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order / customer</th>
                <th>Placed</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Next step</th>
              </tr>
            </thead>
            <tbody>
              {orders
                .filter((o) => filter === "All" || o.status === filter)
                .map((o) => (
                  <tr key={o._id}>
                    <td>
                      <Link className="text-link" to={"/orders/" + o._id}>
                        {o.number}
                      </Link>
                      <small>{o.customerName}</small>
                    </td>
                    <td>{date(o.createdAt)}</td>
                    <td>{money(o.total)}</td>
                    <td>
                      {o.paymentMethod}
                      <small>{o.paymentStatus}</small>
                      {o.paymentStatus === "Pending" &&
                        o.status !== "Cancelled" && (
                          <button
                            className="text-link"
                            onClick={() => {
                              setCollect(o);
                              setReceived("");
                            }}
                          >
                            Collect cash
                          </button>
                        )}
                    </td>
                    <td>
                      <span
                        className={"status status-" + o.status.split(" ")[0]}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {next[o.status].map((s) => (
                          <button
                            key={s}
                            disabled={busy}
                            className={
                              "button small " +
                              (s === "Cancelled" ? "outline" : "")
                            }
                            onClick={() => {
                              if (
                                s !== "Cancelled" ||
                                confirm("Cancel this order and restore stock?")
                              )
                                action(() =>
                                  api("/orders/" + o._id + "/status", {
                                    method: "PUT",
                                    body: { status: s },
                                  }),
                                );
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!orders.length && (
            <div className="empty">
              <h3>Fresh start. No orders yet.</h3>
            </div>
          )}
        </div>
      )}
      {collect && (
        <div className="modal-backdrop">
          <form
            className="panel payment-modal"
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                await api("/payments/cash", {
                  method: "POST",
                  body: {
                    order: collect._id,
                    amountReceived: Number(received),
                  },
                });
                setCollect(null);
              });
            }}
          >
            <h2>Cash at pickup</h2>
            <p>
              {collect.number} · Total {money(collect.total)}
            </p>
            <label>
              Amount received
              <input
                autoFocus
                type="number"
                required
                min={collect.total}
                step="0.01"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </label>
            <h3>
              Change: {money(Math.max(0, Number(received) - collect.total))}
            </h3>
            {error && <div className="error">{error}</div>}
            <div className="action-buttons">
              <button className="button" disabled={busy}>
                Collect payment
              </button>
              <button
                className="button outline"
                type="button"
                onClick={() => setCollect(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
