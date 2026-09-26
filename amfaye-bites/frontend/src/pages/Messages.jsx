import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { date, money } from "../utils/currency";
import "../components/chat.css";

export default function Messages() {
  const { user } = useAuth();
  const staff = user.role === "admin";
  const { chatId } = useParams();
  const navigate = useNavigate();
  const base = staff ? "/admin/messages" : "/messages";
  const [inbox, setInbox] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  useEffect(() => {
    let live = true,
      busy = false;
    const load = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const data = await api(
          "/chats?" +
            new URLSearchParams({ page: String(page), status, q: query }),
        );
        if (live) {
          setInbox(data);
          setError("");
        }
      } catch (e) {
        if (live) setError(e.message);
      } finally {
        busy = false;
      }
    };
    const debounce = setTimeout(load, 200);
    const interval = setInterval(load, 10000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      clearTimeout(debounce);
      clearInterval(interval);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [query, status, page, version]);
  function updateInbox(c) {
    setInbox((old) =>
      old
        ? {
            ...old,
            items: old.items.map((row) =>
              row._id === c._id ? { ...row, ...c } : row,
            ),
          }
        : old,
    );
    window.dispatchEvent(new Event("amfaye:chat-unread"));
  }
  return (
    <div className={staff ? "chat-page" : "container page chat-page"}>
      <div
        className={staff ? "admin-heading" : "page-heading chat-page-heading"}
      >
        <div>
          <span className="eyebrow">A LITTLE HELP, A HUMAN CONVERSATION</span>
          <h1>{staff ? "Messages" : "Your conversations"}</h1>
          <p>
            {staff
              ? "Order questions, thoughtful answers. Keep every customer in the loop."
              : "Talk to the Amfaye Bites team about your order."}
          </p>
        </div>
        <button
          className="button outline small"
          type="button"
          onClick={refresh}
        >
          <RefreshCw size={15} />
          Refresh inbox
        </button>
      </div>
      <div className={`chat-workspace ${chatId ? "has-active" : ""}`}>
        <aside className="chat-inbox" aria-label="Order conversations">
          <div className="chat-inbox-heading">
            <h3>{staff ? "Customer inbox" : "Order support"}</h3>
            <span>{inbox?.total ?? 0}</span>
          </div>
          <div className="chat-inbox-tools">
            <div className="search-field">
              <Search size={15} />
              <input
                aria-label="Search conversations"
                placeholder={
                  staff ? "Customer or order number…" : "Order number…"
                }
                value={query}
                maxLength={80}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              {query && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Clear conversation search"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="chat-status-tabs">
              {["All", "Open", "Closed"].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={status === s ? "active" : ""}
                  onClick={() => {
                    setStatus(s);
                    setPage(1);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="chat-error" role="alert">
              {error}{" "}
              <button type="button" onClick={refresh}>
                Retry
              </button>
            </div>
          )}
          <div className="chat-inbox-list">
            {!inbox ? (
              <p className="chat-placeholder">Loading conversations…</p>
            ) : !inbox.items.length ? (
              <div className="chat-placeholder">
                <MessageCircle size={28} />
                <h4>No conversations yet.</h4>
                <p>
                  {query
                    ? "Try a different customer or order number."
                    : staff
                      ? "Customer order questions will appear here."
                      : "Open one of your orders and select “Chat with admin” to start."}
                </p>
                {!staff && (
                  <Link className="text-link" to="/orders">
                    View my orders <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>
            ) : (
              inbox.items.map((c) => (
                <Link
                  key={c._id}
                  className={`chat-inbox-item ${c._id === chatId ? "selected" : ""}`}
                  to={`${base}/${c._id}`}
                >
                  <div className="chat-avatar">
                    {staff ? (
                      c.customerName.slice(0, 1).toUpperCase()
                    ) : (
                      <MessageCircle size={18} />
                    )}
                  </div>
                  <div className="chat-inbox-copy">
                    <div>
                      <b>{staff ? c.customerName : "Amfaye Bites"}</b>
                      {c.unreadCount > 0 && (
                        <span className="chat-count">
                          {c.unreadCount > 99 ? "99+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="chat-order-ref">{c.orderNumber}</span>
                    <p>{c.lastMessage || "Conversation started. Say hello."}</p>
                    <small>
                      {date(c.lastMessageAt)} · {c.status}
                    </small>
                  </div>
                </Link>
              ))
            )}
          </div>
          {inbox && inbox.pages > 1 && (
            <div className="chat-pagination">
              <button
                type="button"
                className="icon-btn"
                disabled={page <= 1}
                aria-label="Previous conversations"
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                Page {page} of {inbox.pages}
              </span>
              <button
                type="button"
                className="icon-btn"
                disabled={page >= inbox.pages}
                aria-label="Next conversations"
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </aside>
        {chatId ? (
          <ChatThread
            key={chatId}
            id={chatId}
            staff={staff}
            onBack={() => navigate(base)}
            onRead={updateInbox}
            onChanged={refresh}
          />
        ) : (
          <section className="chat-empty-thread">
            <span>
              <MessageCircle size={36} />
            </span>
            <h2>A little conversation goes a long way.</h2>
            <p>
              Select an order conversation to read or send a message.
              <br />
              Replies may take a few minutes.
            </p>
            <small>
              <ShieldCheck size={15} />
              Only you and authorized admins can access your order conversation.
            </small>
          </section>
        )}
      </div>
      <p className="chat-page-note">
        Text-only support. Never send passwords, PINs, real OTPs or financial
        credentials. Chat does not change order or payment status.
      </p>
    </div>
  );
}
function ChatThread({ id, staff, onBack, onRead, onChanged }) {
  const [conversation, setConversation] = useState(null);
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [changing, setChanging] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [newBelow, setNewBelow] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(true);
  const latest = useRef(0);
  const currentConversation = useRef(null);
  const reading = useRef(false);
  const scroll = useRef(null);
  const followBottom = useRef(true);
  const restoreScroll = useRef(null);
  const pendingMessage = useRef(null);
  const textarea = useRef(null);
  const callbacks = useRef({ onRead, onChanged });
  callbacks.current = { onRead, onChanged };
  function setMeta(c) {
    currentConversation.current = c;
    setConversation(c);
  }
  function merge(rows) {
    if (!rows.length) return;
    latest.current = Math.max(latest.current, ...rows.map((m) => m.sequence));
    setMessages((old) =>
      [...new Map([...old, ...rows].map((m) => [m._id, m])).values()].sort(
        (a, b) => a.sequence - b.sequence,
      ),
    );
  }
  async function acknowledge() {
    const c = currentConversation.current;
    if (
      !mounted.current ||
      reading.current ||
      !c ||
      document.visibilityState === "hidden" ||
      latest.current <= c.myReadSequence
    )
      return;
    reading.current = true;
    try {
      const updated = await api(`/chats/${id}/read`, {
        method: "PUT",
        body: { through: latest.current },
      });
      if (mounted.current) {
        const current = currentConversation.current;
        const merged = {
          ...current,
          myReadSequence: Math.max(
            current.myReadSequence,
            updated.myReadSequence,
          ),
          unreadCount: updated.unreadCount,
        };
        setMeta(merged);
        callbacks.current.onRead(merged);
      }
    } catch {
      /* Retry on next poll; never falsely clear the unread badge. */
    } finally {
      reading.current = false;
    }
  }
  useEffect(() => {
    mounted.current = true;
    let alive = true,
      busy = false;
    const load = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const after = latest.current;
        const data = await api(
          `/chats/${id}/messages${after ? `?after=${after}` : ""}`,
        );
        if (!alive || !mounted.current) return;
        setMeta(data.conversation);
        setOrder(data.order);
        merge(data.messages);
        if (!after) setHasOlder(data.hasMore);
        if (after && data.messages.length && !followBottom.current)
          setNewBelow(true);
        setError("");
        setLastSync(new Date());
        await acknowledge();
      } catch (e) {
        if (mounted.current) setError(e.message);
      } finally {
        busy = false;
        if (mounted.current) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 5000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("online", load);
    return () => {
      alive = false;
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("online", load);
    };
  }, [id, retry]);
  useLayoutEffect(() => {
    if (!scroll.current) return;
    if (restoreScroll.current) {
      const previous = restoreScroll.current;
      scroll.current.scrollTop =
        previous.top + scroll.current.scrollHeight - previous.height;
      restoreScroll.current = null;
    } else if (followBottom.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    if (!cooldown) return;
    const tick = () =>
      setSeconds(Math.max(0, Math.ceil((cooldown - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);
  function failure(e) {
    setSendError(e.message);
    if (e.status === 429) {
      setCooldown(Date.now() + Math.max(1, Number(e.retryAfter) || 60) * 1000);
      setSeconds(Math.max(1, Number(e.retryAfter) || 60));
    }
  }
  async function older() {
    if (loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    try {
      const data = await api(
        `/chats/${id}/messages?before=${messages[0].sequence}`,
      );
      if (!mounted.current) return;
      restoreScroll.current = scroll.current
        ? { height: scroll.current.scrollHeight, top: scroll.current.scrollTop }
        : null;
      merge(data.messages);
      setHasOlder(data.hasMore);
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setLoadingOlder(false);
    }
  }
  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || seconds || conversation?.status !== "Open") return;
    setSending(true);
    setSendError("");
    if (!pendingMessage.current || pendingMessage.current.text !== text)
      pendingMessage.current = { text, clientMessageId: crypto.randomUUID() };
    try {
      const data = await api(`/chats/${id}/messages`, {
        method: "POST",
        body: pendingMessage.current,
      });
      if (!mounted.current) return;
      // Do not advance the polling cursor past unseen concurrent replies. Poll will merge
      // the saved message and any intervening partner messages on its next fetch.
      setMessages((old) =>
        [
          ...new Map([...old, data.message].map((m) => [m._id, m])).values(),
        ].sort((a, b) => a.sequence - b.sequence),
      );
      setMeta(data.conversation);
      setDraft("");
      pendingMessage.current = null;
      followBottom.current = true;
      setNewBelow(false);
      callbacks.current.onChanged();
      setRetry((v) => v + 1);
    } catch (e) {
      if (mounted.current) failure(e);
    } finally {
      if (mounted.current) setSending(false);
    }
  }
  async function changeStatus(status) {
    if (changing || seconds) return;
    setChanging(true);
    setSendError("");
    try {
      const c = await api(`/chats/${id}/status`, {
        method: "PUT",
        body: { status },
      });
      if (mounted.current) {
        setMeta(c);
        callbacks.current.onChanged();
      }
    } catch (e) {
      if (mounted.current) failure(e);
    } finally {
      if (mounted.current) setChanging(false);
    }
  }
  const closed = conversation?.status === "Closed";
  return (
    <section className="chat-thread" aria-label="Order chat">
      <header className="chat-thread-header">
        <button
          type="button"
          className="icon-btn chat-back"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="chat-avatar">
          <MessageCircle size={20} />
        </div>
        <div className="chat-thread-title">
          <h2>
            {staff
              ? conversation?.customerName || "Customer conversation"
              : "Amfaye Bites support"}
          </h2>
          <span>
            {conversation?.orderNumber || "Loading order…"} ·{" "}
            {conversation?.status || "Connecting"}
          </span>
        </div>
        {conversation && (
          <Link
            className="text-link chat-order-link"
            to={"/orders/" + conversation.order}
          >
            View order <ArrowUpRight size={15} />
          </Link>
        )}
      </header>
      {conversation && (
        <div className="chat-order-context">
          <span>
            Order: <b>{order?.status || "Unavailable"}</b>
          </span>
          <span>
            Total: <b>{money(order?.total)}</b>
          </span>
          <span>
            Payment: <b>{order?.paymentStatus || "—"}</b>
          </span>
          {staff && (
            <button
              className="text-link"
              type="button"
              disabled={changing || seconds > 0}
              onClick={() => changeStatus(closed ? "Open" : "Closed")}
            >
              {changing
                ? "Saving…"
                : closed
                  ? "Reopen conversation"
                  : "Close conversation"}
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="chat-error" role="alert">
          {error}{" "}
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Retry
          </button>
        </div>
      )}
      <div
        className="chat-transcript"
        ref={scroll}
        onScroll={() => {
          const node = scroll.current;
          followBottom.current =
            node.scrollHeight - node.scrollTop - node.clientHeight < 80;
          if (followBottom.current) setNewBelow(false);
        }}
        role="log"
        aria-label="Messages in this conversation"
        aria-live="polite"
        aria-relevant="additions"
      >
        {hasOlder && (
          <button
            type="button"
            className="chat-load-older"
            onClick={older}
            disabled={loadingOlder}
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}
        {loading ? (
          <p className="chat-placeholder">Opening your conversation…</p>
        ) : !messages.length ? (
          <div className="chat-placeholder">
            <MessageCircle size={30} />
            <h3>Start with a hello.</h3>
            <p>
              Ask a question about this order. An admin can reply here.
              <br />
              Replies may take a few minutes.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const own = m.senderRole === (staff ? "admin" : "customer");
            return (
              <article
                className={`chat-message ${own ? "own" : "incoming"}`}
                key={m._id}
              >
                <span className="chat-sender">
                  {own
                    ? staff
                      ? `${m.senderName} · Admin`
                      : "You"
                    : m.senderRole === "admin"
                      ? `${m.senderName} · Admin`
                      : m.senderName}
                </span>
                <div className="chat-bubble">{m.text}</div>
                <span className="chat-message-meta">
                  <time dateTime={m.createdAt}>{date(m.createdAt)}</time>
                  {own && (
                    <span>
                      <CheckCheck size={12} />
                      {m.sequence <= (conversation?.theirReadSequence || 0)
                        ? "Seen"
                        : "Sent"}
                    </span>
                  )}
                </span>
              </article>
            );
          })
        )}
      </div>
      {newBelow && (
        <button
          type="button"
          className="chat-new-below"
          onClick={() => {
            followBottom.current = true;
            if (scroll.current)
              scroll.current.scrollTop = scroll.current.scrollHeight;
            setNewBelow(false);
          }}
        >
          New messages ↓
        </button>
      )}
      {closed && (
        <div className="chat-closed-note">
          <span>
            This conversation is closed. Reopen it for a follow-up question.
          </span>
          <button
            type="button"
            className="text-link"
            onClick={() => changeStatus("Open")}
            disabled={changing || seconds > 0}
          >
            Reopen conversation
          </button>
        </div>
      )}
      <form className="chat-composer" onSubmit={send}>
        {sendError && (
          <div className="chat-error" role="alert">
            {sendError} Your unsent text is kept below.
          </div>
        )}
        {seconds > 0 && (
          <div className="chat-cooldown" role="status">
            Please wait {seconds}s before sending another chat update.
          </div>
        )}
        <label className="chat-input-label" htmlFor={`chat-draft-${id}`}>
          Message {staff ? "customer" : "admin"}
        </label>
        <div className="chat-compose-row">
          <textarea
            id={`chat-draft-${id}`}
            ref={textarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder={
              closed
                ? "Reopen the conversation to reply."
                : "Write a message about this order…"
            }
            disabled={closed || sending || !conversation}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                e.currentTarget.form.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            className="button chat-send"
            disabled={
              sending || !draft.trim() || closed || !conversation || seconds > 0
            }
            aria-label="Send message"
          >
            <Send size={18} />
            <span>{sending ? "Sending…" : "Send"}</span>
          </button>
        </div>
        <div className="chat-composer-info">
          <span>Enter to send · Shift + Enter for a new line</span>
          <span>{draft.length}/1000</span>
        </div>
        <small className="chat-sync-note">
          {error
            ? "Connection interrupted. Retrying automatically."
            : lastSync
              ? "Checks every 5 seconds while visible. Replies may take a few minutes."
              : "Connecting to order support…"}
        </small>
      </form>
    </section>
  );
}
