import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChefHat,
  Clock,
  RefreshCw,
  Search,
  ArrowRight,
  CheckCircle2,
  PackageCheck,
} from "lucide-react";
import { api } from "../../services/api";
import { money, date } from "../../utils/currency";
import "../../components/preparation.css";
const definitions = {
  confirmed: {
    title: "To prepare",
    hint: "Confirmed orders, oldest first",
    icon: ChefHat,
    action: "Start preparing",
    next: "Preparing",
  },
  preparing: {
    title: "In preparation",
    hint: "Currently being made",
    icon: Clock,
    action: "Mark ready",
    next: "Ready for Pickup",
  },
  ready: {
    title: "Ready for pickup",
    hint: "Waiting for customer collection",
    icon: PackageCheck,
    action: "Mark collected",
    next: "Completed",
  },
};
export function elapsed(placed, now) {
  const min = Math.max(
    0,
    Math.floor((now - new Date(placed).getTime()) / 60000),
  );
  if (!Number.isFinite(min)) return "—";
  if (min < 1) return "Less than 1m";
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`;
}
export default function PreparationQueue() {
  const [data, setData] = useState(null),
    [query, setQuery] = useState(""),
    [pages, setPages] = useState({ confirmed: 1, preparing: 1, ready: 1 }),
    [loadError, setLoadError] = useState(""),
    [actionError, setActionError] = useState(""),
    [announcement, setAnnouncement] = useState(""),
    [busy, setBusy] = useState(""),
    [refreshing, setRefreshing] = useState(false),
    [lastSync, setLastSync] = useState(0),
    [clock, setClock] = useState(Date.now());
  const sequence = useRef(0),
    fetching = useRef(false),
    live = useRef(true),
    locked = useRef(false),
    offset = useRef(0),
    reload = useRef(null);
  const load = useCallback(
    async (force = false) => {
      if (
        !force &&
        (fetching.current ||
          locked.current ||
          document.visibilityState === "hidden")
      )
        return;
      const request = ++sequence.current;
      fetching.current = true;
      setRefreshing(true);
      try {
        const result = await api(
          "/preparation?" +
            new URLSearchParams({
              q: query,
              confirmedPage: pages.confirmed,
              preparingPage: pages.preparing,
              readyPage: pages.ready,
            }),
        );
        if (!live.current || request !== sequence.current) return;
        const clamped = { ...pages };
        let changed = false;
        for (const lane of result.lanes)
          if (clamped[lane.key] > lane.pages) {
            clamped[lane.key] = lane.pages;
            changed = true;
          }
        if (changed) {
          setPages(clamped);
          return;
        }
        offset.current = Date.parse(result.serverTime) - Date.now();
        setData(result);
        setLoadError("");
        setLastSync(Date.now());
        setClock(Date.now());
      } catch (e) {
        if (live.current && request === sequence.current)
          setLoadError(e.message);
      } finally {
        if (live.current && request === sequence.current) {
          fetching.current = false;
          setRefreshing(false);
        }
      }
    },
    [query, pages.confirmed, pages.preparing, pages.ready],
  );
  reload.current = load;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      sequence.current++;
    };
  }, []);
  useEffect(() => {
    const delay = setTimeout(() => load(true), 250),
      timer = setInterval(() => load(), 10000);
    const wake = () => load();
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(delay);
      clearInterval(timer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      sequence.current++;
      fetching.current = false;
    };
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  async function advance(order, key) {
    if (locked.current) return;
    const next = definitions[key].next;
    if (
      next === "Completed" &&
      !window.confirm(
        `Has ${order.number} been handed to the customer? This marks the order completed.`,
      )
    )
      return;
    locked.current = true;
    sequence.current++;
    fetching.current = false;
    setBusy(order._id);
    setActionError("");
    setAnnouncement("");
    try {
      await api(`/orders/${order._id}/status`, {
        method: "PUT",
        body: { status: next },
      });
      if (live.current) {
        setAnnouncement(`${order.number} is now ${next}.`);
        await reload.current(true);
      }
    } catch (e) {
      if (live.current) {
        setActionError(
          e.status === 409
            ? "This order changed on another screen. The queue has been refreshed; check its current status."
            : e.message,
        );
        await reload.current(true);
      }
    } finally {
      locked.current = false;
      if (live.current) setBusy("");
    }
  }
  const stale = !!loadError || (lastSync > 0 && clock - lastSync > 30000),
    shown = data?.lanes.reduce((n, l) => n + l.total, 0) || 0;
  return (
    <div className="prep-page">
      <header className="admin-heading">
        <div>
          <span className="eyebrow">A LITTLE CARE IN EVERY ORDER</span>
          <h1>Preparation queue</h1>
          <p>Your kitchen's next steps, in one place.</p>
        </div>
        <button
          className="button outline small"
          disabled={!!busy || refreshing}
          onClick={() => {
            setActionError("");
            load(true);
          }}
        >
          <RefreshCw size={15} />
          {refreshing ? "Refreshing…" : "Refresh queue"}
        </button>
      </header>
      <div className="prep-toolbar">
        <label className="prep-search">
          <Search size={17} />
          <input
            aria-label="Search queue"
            placeholder="Search order number or customer…"
            maxLength={80}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPages({ confirmed: 1, preparing: 1, ready: 1 });
            }}
          />
          {query && (
            <button
              className="text-link"
              type="button"
              onClick={() => {
                setQuery("");
                setPages({ confirmed: 1, preparing: 1, ready: 1 });
              }}
            >
              Clear
            </button>
          )}
        </label>
        <div className={`prep-sync ${stale ? "is-stale" : ""}`}>
          <span className="prep-sync-dot" />
          {stale
            ? "Updates delayed"
            : lastSync
              ? "Auto-refresh · 10 seconds"
              : "Connecting…"}
          {lastSync > 0 && (
            <small>
              Last synced{" "}
              {new Date(lastSync).toLocaleTimeString("en-PH", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </small>
          )}
        </div>
      </div>
      {loadError && (
        <div className="error" role="alert">
          {loadError} Showing the last available queue. Actions are paused until
          it refreshes.
        </div>
      )}
      {actionError && (
        <div className="error" role="alert">
          {actionError}
        </div>
      )}
      {announcement && (
        <div className="prep-announcement" role="status">
          <CheckCircle2 size={16} />
          {announcement}
        </div>
      )}
      {data?.pendingCount > 0 && (
        <div className="prep-pending">
          <span>
            <b>
              {data.pendingCount} pending{" "}
              {data.pendingCount === 1 ? "order needs" : "orders need"}{" "}
              confirmation.
            </b>{" "}
            Confirm orders before they enter this queue.
          </span>
          <Link to="/admin/orders" className="text-link">
            Open Orders <ArrowRight size={15} />
          </Link>
        </div>
      )}
      <div className="prep-board-heading">
        <p>
          {data
            ? `${shown} ${query.trim() ? "matching" : "active"} ${shown === 1 ? "order" : "orders"}`
            : "Loading your queue…"}
        </p>
        <small>
          Time shown is since the order was placed—not preparation duration or a
          promised pickup time.
        </small>
      </div>
      {!data ? (
        <div className="prep-loading" role="status">
          {loadError
            ? "Queue unavailable. Use Refresh queue to retry."
            : "Getting the kitchen ready…"}
        </div>
      ) : (
        <div className="prep-board">
          {data.lanes.map((lane) => {
            const d = definitions[lane.key],
              Icon = d.icon;
            return (
              <section
                key={lane.key}
                className={`prep-lane prep-${lane.key}`}
                aria-label={d.title}
              >
                <header className="prep-lane-header">
                  <div>
                    <Icon size={19} />
                    <h2>{d.title}</h2>
                    <span>{lane.total}</span>
                  </div>
                  <p>{d.hint}</p>
                </header>
                <div className="prep-cards">
                  {!lane.items.length ? (
                    <div className="prep-empty">
                      <Icon size={27} />
                      <h3>
                        {query.trim() ? "No matching orders" : "All clear here"}
                      </h3>
                      <p>
                        {query.trim()
                          ? "Try a different order or customer."
                          : lane.key === "confirmed"
                            ? "Newly confirmed orders will appear here."
                            : lane.key === "preparing"
                              ? "Start preparing an order to move it here."
                              : "Finished preparations will appear here."}
                      </p>
                    </div>
                  ) : (
                    lane.items.map((order) => (
                      <OrderCard
                        key={order._id}
                        order={order}
                        lane={lane.key}
                        now={clock + offset.current}
                        disabled={
                          !!busy || stale || data.query !== query.trim()
                        }
                        busy={busy === order._id}
                        onAdvance={() => advance(order, lane.key)}
                      />
                    ))
                  )}
                </div>
                {lane.pages > 1 && (
                  <nav
                    className="prep-pagination"
                    aria-label={`${d.title} pages`}
                  >
                    <button
                      className="button outline small"
                      disabled={lane.page <= 1 || !!busy}
                      onClick={() =>
                        setPages((p) => ({ ...p, [lane.key]: p[lane.key] - 1 }))
                      }
                    >
                      Previous
                    </button>
                    <span>
                      {lane.page}/{lane.pages}
                    </span>
                    <button
                      className="button outline small"
                      disabled={lane.page >= lane.pages || !!busy}
                      onClick={() =>
                        setPages((p) => ({ ...p, [lane.key]: p[lane.key] + 1 }))
                      }
                    >
                      Next
                    </button>
                  </nav>
                )}
              </section>
            );
          })}
        </div>
      )}
      <p className="prep-footnote">
        Online orders only. POS sales are already completed in the current
        system. Collect outstanding cash in Orders before marking an order
        collected. This queue does not schedule pickups or change stock/payment
        amounts.
      </p>
    </div>
  );
}
function OrderCard({ order, lane, now, disabled, busy, onAdvance }) {
  const definition = definitions[lane],
    unpaid = order.paymentStatus !== "Paid",
    aged = lane !== "ready" && now - Date.parse(order.createdAt) >= 20 * 60000;
  return (
    <article className="prep-card" aria-label={`Order ${order.number}`}>
      <div className="prep-card-top">
        <Link className="text-link" to={"/orders/" + order._id}>
          {order.number}
        </Link>
        <span
          className={`prep-age ${aged ? "is-aged" : ""}`}
          title={"Placed " + date(order.createdAt)}
        >
          <Clock size={12} />
          {elapsed(order.createdAt, now)}
        </span>
      </div>
      <h3>{order.customerName || "Customer"}</h3>
      <p className="prep-placed">Placed {date(order.createdAt)}</p>
      <ul className="prep-items">
        {order.items.map((item, index) => (
          <li key={index}>
            <span className="prep-quantity">{item.quantity}×</span>
            <div>
              <b>{item.name}</b>
              {item.customization?.size && (
                <small>
                  {item.customization.size} · {item.customization.sugar} sugar ·{" "}
                  {item.customization.ice}
                </small>
              )}
              {item.customization?.addons?.length > 0 && (
                <small>
                  Add-ons:{" "}
                  {item.customization.addons.map((a) => a.name).join(", ")}
                </small>
              )}
            </div>
          </li>
        ))}
      </ul>
      {order.notes && (
        <div className="prep-notes">
          <b>Customer note</b>
          <p>{order.notes}</p>
        </div>
      )}
      <div className="prep-payment">
        <span>
          {money(order.total)} · {order.paymentMethod}
        </span>
        <b className={unpaid ? "is-unpaid" : ""}>{order.paymentStatus}</b>
      </div>
      {lane === "ready" && unpaid ? (
        <>
          <p className="prep-payment-warning">
            Collect payment before completing this order.
          </p>
          <Link
            className="button outline small prep-primary"
            to="/admin/orders"
          >
            Collect payment in Orders
          </Link>
        </>
      ) : (
        <button
          className="button small prep-primary"
          disabled={disabled}
          onClick={onAdvance}
        >
          {busy ? "Updating…" : definition.action}
          <ArrowRight size={15} />
        </button>
      )}
    </article>
  );
}
