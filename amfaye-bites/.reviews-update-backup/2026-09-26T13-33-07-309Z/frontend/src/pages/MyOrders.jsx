import OrderChatButton from "../components/OrderChatButton";
import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { ArrowUpRight, Printer, CheckCircle2, RefreshCw } from "lucide-react";
import { api } from "../services/api";
import { money, date } from "../utils/currency";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";
export default function MyOrders() {
  const { id } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = () =>
    api(id ? "/orders/" + id : "/orders")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    setData(null);
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener("amfaye:order-status-updated", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("amfaye:order-status-updated", load);
    };
  }, [id]);
  return (
    <div className="container page">
      <div className="section-heading no-print">
        <div className="page-heading">
          <span className="eyebrow">A LITTLE HAPPINESS, ON ITS WAY</span>
          <h1>{id ? "Your order. Made with love." : "Your happy history."}</h1>
        </div>
        <button className="button outline small" onClick={load}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>
      {error ? (
        <div className="error">{error}</div>
      ) : !data ? (
        <Loading />
      ) : id ? (
        <>
          {location.state?.justOrdered && (
            <div className="success no-print">
              <CheckCircle2 size={21} />
              Order received! We can't wait to make your day a little sweeter.
            </div>
          )}
          <div className="order-detail panel">
<OrderChatButton order={data} />
            <div className="section-heading">
              <div>
                <h2>AMFAYE BITES</h2>
                <p>Freshly Baked. Freshly Blended.</p>
                <b>{data.number}</b>
              </div>
              <div className="no-print">
                <span className={"status status-" + data.status.split(" ")[0]}>
                  {data.status}
                </span>
              </div>
            </div>
            <p>
              {date(data.createdAt)}
              <br />
              Customer: {data.customerName}
              <br />
              Cashier: {data.cashier?.name || "Online order"}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i, n) => (
                  <tr key={n}>
                    <td>
                      {i.name}
                      {i.customization?.size && (
                        <small>
                          {i.customization.size} · {i.customization.sugar} sugar
                          · {i.customization.ice}
                          {i.customization.addons?.map((a) => ` · ${a.name}`)}
                        </small>
                      )}
                    </td>
                    <td>{i.quantity}</td>
                    <td>{money(i.unitPrice)}</td>
                    <td>{money(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="receipt-totals">
              <div className="summary-line">
                <span>Subtotal</span>
                <b>{money(data.subtotal)}</b>
              </div>
              <div className="summary-line">
                <span>Discount</span>
                <b>−{money(data.discount)}</b>
              </div>
              <div className="summary-line total">
                <span>Total</span>
                <b>{money(data.total)}</b>
              </div>
              <div className="summary-line">
                <span>Payment method</span>
                <b>{data.paymentMethod}</b>
              </div>
              <div className="summary-line">
                <span>Payment status</span>
                <b>{data.paymentStatus}</b>
              </div>
              {data.payment && (
                <>
                  <div className="summary-line">
                    <span>Amount paid</span>
                    <b>{money(data.payment.received)}</b>
                  </div>
                  <div className="summary-line">
                    <span>Change</span>
                    <b>{money(data.payment.change)}</b>
                  </div>
                </>
              )}
            </div>
            {data.notes && <p>Notes: {data.notes}</p>}
            <p className="centered">
              Thank you! A little bite, a lot of happiness.
              <br />
              <small>
                {data.paymentMethod === "Demo GCash"
                  ? "Demo Payment — No real money will be transferred."
                  : data.paymentStatus === "Pending"
                    ? "Order summary — payment due at pickup."
                    : "Payment receipt"}
              </small>
            </p>
            <button
              className="button outline no-print"
              onClick={() => window.print()}
            >
              <Printer size={17} />
              Print {data.receipt ? "receipt" : "order summary"}
            </button>
          </div>
        </>
      ) : data.length ? (
        <div className="orders-list">
          {data.map((o) => (
            <Link
              className="panel order-row"
              to={"/orders/" + o._id}
              key={o._id}
            >
              <div>
                <b>{o.number}</b>
                <small>{date(o.createdAt)}</small>
              </div>
              <span>{o.items.reduce((s, i) => s + i.quantity, 0)} items</span>
              <span className={"status status-" + o.status.split(" ")[0]}>
                {o.status}
              </span>
              <b>{money(o.total)}</b>
              <ArrowUpRight size={19} />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your first happy moment is waiting."
          text="Place an order and follow its progress here."
        />
      )}
    </div>
  );
}
