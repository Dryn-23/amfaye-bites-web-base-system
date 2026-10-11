import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { RotateCcw, CheckCircle, ChevronLeft } from "lucide-react";
import { api } from "../services/api";
import { money } from "../utils/currency";

export default function RefundRequest() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("order") || "";
  const [order, setOrder] = useState(null);
  const [selected, setSelected] = useState([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError("No order selected.");
      return;
    }
    api("/orders/" + orderId)
      .then((o) => {
        setOrder(o);
        const all = (o.items || []).map((_, i) => i);
        setSelected(all);
        setAmount(String(o.total || ""));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Could not load order.");
        setLoading(false);
      });
  }, [orderId]);

  const computed =
    order && selected.length
      ? selected.reduce((s, i) => {
          const item = order.items[i];
          return s + (item?.quantity || 0) * (item?.unitPrice || 0);
        }, 0)
      : 0;

  useEffect(() => {
    if (order && selected.length === order.items?.length && !Number(amount)) {
      setAmount(String(order.total || ""));
    } else if (!amount) {
      setAmount(String(computed || ""));
    }
  }, [selected, computed, order, amount]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!orderId || !reason.trim()) {
      setError("Please describe the reason for the refund.");
      return;
    }
    setSending(true);
    const items = order?.items
      ?.filter((_, i) => selected.includes(i))
      .map((i) => ({
        product: i.product,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      }));
    try {
      const res = await api("/refunds", {
        method: "POST",
        body: {
          order: orderId,
          amount: Number(amount) || undefined,
          items,
          reason: reason.trim(),
        },
      });
      setResult(res);
    } catch (err) {
      setError((err.message || "Could not submit refund request. Please try again.") + (err.status ? ` (${err.status})` : ""));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="container page narrow"><p className="muted">Loading order…</p></div>;

  if (result) {
    return (
      <div className="container page narrow">
        <div className="page-heading centered">
          <CheckCircle className="green" size={48} />
          <h1>Refund request sent</h1>
        </div>
        <section className="panel centered">
          <p className="muted">
            Your refund request for {money(result.amount)} is now pending review.
          </p>
          <div className="stack">
            <Link className="button" to="/orders">Back to my orders</Link>
          </div>
        </section>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="container page narrow">
        <p className="error" role="alert">{error}</p>
        <Link className="button outline" to="/orders"><ChevronLeft size={16} /> My orders</Link>
      </div>
    );
  }

  return (
    <div className="container page narrow">
      <div className="page-heading centered">
        <RotateCcw size={32} />
        <h1>Request a refund</h1>
        <p>Order {order?.number}</p>
      </div>
      <form className="panel stack" onSubmit={submit}>
        {error && <p className="error" role="alert">{error}</p>}

        <label className="stack tight">
          Items to refund
          <div className="refund-items">
            {order?.items?.map((item, idx) => (
              <label key={idx} className="row tight">
                <input
                  type="checkbox"
                  checked={selected.includes(idx)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked
                        ? [...new Set([...prev, idx])]
                        : prev.filter((i) => i !== idx),
                    );
                  }}
                />
                <span>
                  {item.name} × {item.quantity} @ {money(item.unitPrice)}
                </span>
              </label>
            ))}
          </div>
        </label>

        <label>
          Refund amount
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={order?.total || 0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <small className="muted">
            Suggested full refund: {money(order?.total || 0)}. You may request less.
          </small>
        </label>

        <label>
          Reason
          <textarea
            rows={4}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need a refund?"
            required
          />
        </label>

        <button className="button" type="submit" disabled={sending}>
          {sending ? "Sending…" : "Submit refund request"}
        </button>
      </form>
      <p className="muted centered">
        <Link to="/orders">Back to my orders</Link>
      </p>
    </div>
  );
}
