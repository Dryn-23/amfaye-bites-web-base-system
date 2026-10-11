import { useState } from "react";
import { api } from "../../services/api";
export default function SeedProducts() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function seed() {
    setLoading(true);
    try {
      const res = await api("/admin/seed-products", { method: "POST" });
      setResult(res);
    } catch (err) {
      setResult({ error: err.message || "Failed to add products." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-page">
      <h1>Temporary: Add sample products</h1>
      <p className="muted">
        Click once to add the 47 sample products to the live database.
        This page will be removed right after.
      </p>
      {result ? (
        <div className="panel">
          {result.error ? (
            <p className="error">{result.error}</p>
          ) : (
            <p className="success">
              Created <strong>{result.created}</strong> products, skipped{" "}
              <strong>{result.skipped}</strong> duplicates.
              You can now remove this temporary page.
            </p>
          )}
        </div>
      ) : (
        <button className="button" onClick={seed} disabled={loading}>
          {loading ? "Adding…" : "Add all sample products"}
        </button>
      )}
    </div>
  );
}
