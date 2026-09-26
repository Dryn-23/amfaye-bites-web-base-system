import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Bell,
  BellRing,
  CheckCheck,
  RefreshCw,
  X,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { date } from "../utils/currency";
import "./notifications.css";

// Remount on identity changes so one customer's feed never appears for another.
export default function NotificationBell() {
  const { user } = useAuth();
  if (!user || user.role !== "customer") return null;
  return <CustomerNotifications key={user.id || user._id} />;
}

function CustomerNotifications() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]);
  const wrapper = useRef(null);
  const button = useRef(null);
  const mounted = useRef(false);
  const controller = useRef(null);
  const activeRequest = useRef(null);
  const seen = useRef(new Set());
  const initialized = useRef(false);

  const refresh = useCallback(() => {
    if (activeRequest.current) return activeRequest.current;
    controller.current = new AbortController();
    const work = api("/notifications", { signal: controller.current.signal })
      .then((data) => {
        if (!mounted.current) return;
        const fresh = initialized.current
          ? data.items.filter((n) => !seen.current.has(n._id) && !n.readAt)
          : [];
        // First load populates the bell, without replaying old popups after login/reload.
        seen.current = new Set(data.items.map((n) => n._id));
        initialized.current = true;
        setItems(data.items);
        setUnreadCount(data.unreadCount);
        setError("");
        if (fresh.length) {
          setToasts((previous) =>
            [
              ...fresh,
              ...previous.filter((n) => !fresh.some((f) => f._id === n._id)),
            ].slice(0, 3),
          );
          // Refresh the open order/history view too; no status is changed client-side.
          window.dispatchEvent(new Event("amfaye:order-status-updated"));
        }
      })
      .catch((e) => {
        if (mounted.current) setError(e.message);
      })
      .finally(() => {
        activeRequest.current = null;
        if (mounted.current) setLoading(false);
      });
    activeRequest.current = work;
    return work;
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const tick = () => {
      if (document.visibilityState !== "hidden") refresh();
    };
    const interval = setInterval(tick, 10000);
    window.addEventListener("focus", tick);
    window.addEventListener("online", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      mounted.current = false;
      controller.current?.abort();
      clearInterval(interval);
      window.removeEventListener("focus", tick);
      window.removeEventListener("online", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (e) => {
      if (!wrapper.current?.contains(e.target)) setOpen(false);
    };
    const escape = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function viewOrder(notification) {
    setOpen(false);
    setToasts((old) => old.filter((n) => n._id !== notification._id));
    navigate("/orders/" + notification.order);
    if (!notification.readAt) {
      setBusy(true);
      setActionError("");
      // Finish an in-flight read before mutation to prevent stale badge values.
      await activeRequest.current;
      try {
        await api(`/notifications/${notification._id}/read`, {
          method: "PUT",
          body: {},
        });
        await refresh();
      } catch (e) {
        if (mounted.current)
          setActionError(
            "Could not mark the notification as read. " + e.message,
          );
      } finally {
        if (mounted.current) setBusy(false);
      }
    }
  }
  async function markAll() {
    if (!items.length) return;
    setBusy(true);
    setActionError("");
    const through = items[0].createdAt;
    await activeRequest.current;
    try {
      await api("/notifications/read-all", {
        method: "PUT",
        body: { through },
      });
      if (mounted.current)
        setToasts((old) => old.filter((n) => n.createdAt > through));
      await refresh();
    } catch (e) {
      if (mounted.current) setActionError(e.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <>
      <div className="notification-control" ref={wrapper}>
        <button
          className="notification-toggle"
          ref={button}
          type="button"
          aria-label={`Order notifications, ${unreadCount} unread`}
          aria-expanded={open}
          aria-controls="order-notification-panel"
          onClick={() => {
            setOpen(!open);
            if (!open) refresh();
          }}
        >
          <Bell size={19} />
          {unreadCount > 0 && (
            <span className="notification-count">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          {error && (
            <span
              className="notification-offline"
              title="Updates paused. Open notifications to retry."
            />
          )}
        </button>
        {open && (
          <section
            id="order-notification-panel"
            className="notification-panel"
            aria-label="Your order notifications"
          >
            <div className="notification-heading">
              <div>
                <span className="eyebrow">A LITTLE UPDATE FOR YOU</span>
                <h3>Order notifications</h3>
              </div>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X size={18} />
              </button>
            </div>
            <div className="notification-toolbar">
              <span>{unreadCount} unread</span>
              <button
                type="button"
                disabled={busy || !unreadCount || !items.length}
                onClick={markAll}
              >
                <CheckCheck size={14} />
                Mark all as read
              </button>
              <button
                type="button"
                onClick={refresh}
                aria-label="Refresh notifications"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            {(error || actionError) && (
              <p className="notification-error" role="alert">
                {actionError ||
                  `Updates paused: ${error} We'll try again automatically.`}
              </p>
            )}
            <div className="notification-list">
              {loading ? (
                <p className="notification-empty">
                  Checking on your happy little order…
                </p>
              ) : !items.length ? (
                <div className="notification-empty">
                  <BellRing size={27} />
                  <b>No updates just yet.</b>
                  <p>
                    Place an order and we'll keep you posted, from confirmation
                    to pickup.
                  </p>
                </div>
              ) : (
                items.map((n) => (
                  <button
                    className={`notification-item ${n.readAt ? "" : "unread"}`}
                    key={n._id}
                    type="button"
                    onClick={() => viewOrder(n)}
                    disabled={busy}
                  >
                    <span
                      className={`notification-dot ${n.readAt ? "read" : ""}`}
                    />
                    <span className="notification-copy">
                      <strong>{n.title}</strong>
                      <span className="notification-order-number">
                        {n.orderNumber} · {n.status}
                      </span>
                      <span className="notification-message">{n.message}</span>
                      <time dateTime={n.createdAt}>{date(n.createdAt)}</time>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))
              )}
            </div>
            <div className="notification-footnote">
              Latest 50 updates · Checks every 10 seconds while this page is
              visible.
            </div>
          </section>
        )}
      </div>
      <div
        className="order-toast-region"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="New order updates"
      >
        {toasts.map((n) => (
          <article className="order-toast" key={n._id}>
            <span className="order-toast-icon">
              <BellRing size={20} />
            </span>
            <div>
              <strong>{n.title}</strong>
              <span>
                {n.orderNumber} · {n.status}
              </span>
              <p>{n.message}</p>
              <button
                type="button"
                onClick={() => viewOrder(n)}
                disabled={busy}
              >
                View my order <ArrowUpRight size={14} />
              </button>
            </div>
            <button
              className="icon-btn"
              type="button"
              aria-label="Dismiss order notification"
              onClick={() =>
                setToasts((old) => old.filter((t) => t._id !== n._id))
              }
            >
              <X size={17} />
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
