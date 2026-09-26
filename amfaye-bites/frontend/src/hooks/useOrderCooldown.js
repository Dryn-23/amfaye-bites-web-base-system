import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";

export default function useOrderCooldown() {
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState("");
  const applyBlock = useCallback((data) => {
    if (data.code === "ORDER_TEMPORARILY_BLOCKED" || data.blocked) {
      const seconds = Math.max(1, Number(data.retryAfter) || 300);
      setDeadline(Date.now() + seconds * 1000);
      setRemaining(seconds);
      return true;
    }
    return false;
  }, []);
  useEffect(() => {
    let live = true;
    let running = false;
    const check = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const result = await api("/orders/guard");
        if (!live) return;
        setCheckError("");
        if (!applyBlock(result)) {
          setDeadline(0);
          setRemaining(0);
        }
      } catch (e) {
        if (live) setCheckError(e.message);
      } finally {
        running = false;
        if (live) setChecking(false);
      }
    };
    check();
    const timer = setInterval(check, 15000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [applyBlock]);
  useEffect(() => {
    if (!deadline) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  return {
    applyBlock,
    remaining,
    checking,
    checkError,
    countdown: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`,
  };
}
