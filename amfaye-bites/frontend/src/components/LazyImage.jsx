import { useState } from "react";

export default function LazyImage({ src, alt, className, ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {!loaded && !error && (
        <div
          className="skeleton"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${loaded ? "loaded" : ""}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
        {...props}
      />
      {error && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f5f5f5",
            color: "#999",
            fontSize: "0.85rem",
          }}
        >
          Image not available
        </div>
      )}
    </div>
  );
}
