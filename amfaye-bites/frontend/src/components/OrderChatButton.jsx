import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./chat.css";
export default function OrderChatButton({ order }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (
    !user ||
    !["customer", "admin"].includes(user.role) ||
    order.source !== "web"
  )
    return null;
  async function open() {
    setBusy(true);
    setError("");
    try {
      const chat = await api("/chats", {
        method: "POST",
        body: { order: order._id },
      });
      navigate(`${user.role === "admin" ? "/admin" : ""}/messages/${chat._id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="order-chat-action no-print">
      <button
        type="button"
        className="button outline"
        disabled={busy}
        onClick={open}
      >
        <MessageCircle size={17} />
        {busy
          ? "Opening conversation…"
          : user.role === "admin"
            ? "Chat with customer"
            : "Chat with admin"}
      </button>
      <small>
        Questions about this order? Send us a message. Replies may take a few
        minutes.
      </small>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
