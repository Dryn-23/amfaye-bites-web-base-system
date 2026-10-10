import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./chat.css";

export default function OrderReportButton({ order }) {
  const { user } = useAuth();
  if (
    !user ||
    user.role !== "customer" ||
    order.source !== "web" ||
    order.paymentStatus === "Voided"
  )
    return null;
  return (
    <div className="order-chat-action order-report-action no-print">
      <Link className="button outline" to={`/quality?order=${encodeURIComponent(order._id || order.id || "")}`}>
        <ShieldAlert size={17} />
        Report an issue
      </Link>
      <small>
        Contaminated, damaged or wrong item? Report it — we refund
        defective food, no restocking fee.
      </small>
    </div>
  );
}
