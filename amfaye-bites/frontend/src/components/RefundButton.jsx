import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { money } from "../utils/currency";

export default function RefundButton({ order }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!user || user.role !== "customer" || order.paymentStatus !== "Paid") return;
    api("/refunds/my")
      .then((list) => {
        const match = list?.find((r) => String(r.order?._id) === String(order._id || order.id));
        setStatus(match || null);
      })
      .catch(() => setStatus(null));
  }, [user, order]);

  if (!user || user.role !== "customer" || order.paymentStatus !== "Paid") return null;

  if (status) {
    return (
      <div className="order-chat-action no-print">
        <span className={`badge ${status.status === "Approved" ? "green" : status.status === "Rejected" ? "red" : "gold"}`}>
          <RotateCcw size={14} /> Refund {status.status.toLowerCase()}
        </span>
        <small>
          Requested {money(status.amount)} refund for this order.
        </small>
      </div>
    );
  }

  return (
    <div className="order-chat-action order-refund-action no-print">
      <Link
        className="button outline"
        to={`/refunds/request?order=${encodeURIComponent(order._id || order.id || "")}`}
      >
        <RotateCcw size={17} />
        Request refund
      </Link>
      <small>Paid order? You can request a full or partial refund here.</small>
    </div>
  );
}
