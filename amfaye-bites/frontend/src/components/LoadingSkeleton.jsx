export default function LoadingSkeleton({ type = "card", count = 1 }) {
  if (type === "card") {
    return (
      <div className="products-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-card skeleton" />
        ))}
      </div>
    );
  }

  if (type === "list") {
    return (
      <div className="stagger-list">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="panel" style={{ marginBottom: "1rem" }}>
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-text" style={{ width: "70%" }} />
          </div>
        ))}
      </div>
    );
  }

  if (type === "text") {
    return (
      <div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton skeleton-text" />
        ))}
      </div>
    );
  }

  // Default: simple spinner
  return <div className="loading">Loading...</div>;
}
