import { useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";

export default function Toast({ type = "success", message, onClose, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle2 size={20} />,
    error: <XCircle size={20} />,
    warning: <AlertCircle size={20} />,
    info: <Info size={20} />,
  };

  const styles = {
    success: { background: "#4CAF50", color: "white" },
    error: { background: "#f44336", color: "white" },
    warning: { background: "#ff9800", color: "white" },
    info: { background: "#2196F3", color: "white" },
  };

  return (
    <div
      className="toast"
      style={{
        ...styles[type],
        position: "fixed",
        top: "20px",
        right: "20px",
        padding: "1rem 1.5rem",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        animation: "slideInFromRight 0.3s ease-out",
        zIndex: 10000,
        maxWidth: "400px",
      }}
    >
      {icons[type]}
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          marginLeft: "1rem",
          opacity: 0.7,
          fontSize: "1.2rem",
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
