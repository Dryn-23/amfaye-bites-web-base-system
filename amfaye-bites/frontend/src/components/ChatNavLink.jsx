import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import "./chat.css";

export default function ChatNavLink({ staff = false }) {
  const { user } = useAuth();
  if (!user || (staff ? user.role !== "admin" : user.role !== "customer"))
    return null;
  return <UnreadLink key={user.id || user._id} staff={staff} />;
}
function UnreadLink({ staff }) {
  const [count, setCount] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true,
      busy = false;
    const refresh = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const result = await api("/chats/unread");
        if (alive) {
          setCount(result.unreadCount);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      } finally {
        busy = false;
      }
    };
    refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    window.addEventListener("amfaye:chat-unread", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("amfaye:chat-unread", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return (
    <NavLink
      to={staff ? "/admin/messages" : "/messages"}
      className={`chat-nav-link ${staff ? "chat-nav-staff" : "chat-nav-header"}`}
      aria-label={`Messages, ${count} unread`}
      title={
        failed
          ? "Message updates unavailable. Open Messages to retry."
          : "Order support messages"
      }
    >
      <MessageCircle size={staff ? 18 : 19} />
      <span className="chat-nav-label">Messages</span>
      {count > 0 && (
        <span className="chat-count">{count > 99 ? "99+" : count}</span>
      )}
      {failed && <span className="chat-connection-dot" />}
    </NavLink>
  );
}
