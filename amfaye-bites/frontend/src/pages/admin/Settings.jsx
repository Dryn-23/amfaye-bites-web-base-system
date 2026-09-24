import { useState, useEffect } from "react";
import { api } from "../../services/api";
import Loading from "../../components/Loading";
export default function Settings() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/settings")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">THE WAY WE DO THINGS</span>
          <h1>Settings</h1>
          <p>Business information and system configuration.</p>
        </div>
      </div>
      {error ? (
        <div className="error">{error}</div>
      ) : !data ? (
        <Loading />
      ) : (
        <section className="panel narrow">
          <h3>Business & system</h3>
          {Object.entries(data).map(([k, v]) => (
            <div className="summary-line" key={k}>
              <span>{k.replace(/([A-Z])/g, " $1")}</span>
              <b>{typeof v === "boolean" ? (v ? "Enabled" : "Disabled") : v}</b>
            </div>
          ))}
          <div className="info">
            These deployment settings are read-only. The owner can configure
            demo payments and allowed frontend origins through backend
            environment variables. Secrets are never displayed here.
          </div>
        </section>
      )}
    </>
  );
}
