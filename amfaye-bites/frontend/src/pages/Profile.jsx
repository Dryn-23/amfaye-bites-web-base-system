import AppearanceSettings from "../components/AppearanceSettings";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || "",
  });
  const [password, setPassword] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e, change) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (change) {
        await api("/auth/password", { method: "PUT", body: password });
        localStorage.removeItem("ab-token");
        setUser(null);
        navigate("/login");
      } else {
        setUser(await api("/auth/profile", { method: "PUT", body: form }));
        setMessage("Your details have been updated.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container page narrow">
      <div className="page-heading">
        <span className="eyebrow">YOUR LITTLE CORNER</span>
        <h1>Hello, {user.name.split(" ")[0]}.</h1>
        <p>Keep your details fresh.</p>
      </div>
      <AppearanceSettings />
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}
      <form className="panel" onSubmit={(e) => submit(e, false)}>
        <h3>Personal details</h3>
        <label>
          Full name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Phone
          <input
            required
            pattern="09[0-9]{9}"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>
        <label>
          Email
          <input readOnly value={user.email} />
        </label>
        <button className="button" disabled={busy}>
          Save changes
        </button>
      </form>
      <form className="panel" onSubmit={(e) => submit(e, true)}>
        <h3>Change password</h3>
        {Object.entries({
          currentPassword: "Current password",
          password: "New password",
          confirmPassword: "Confirm new password",
        }).map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              required
              type="password"
              minLength={8}
              maxLength={72}
              autoComplete={
                k === "currentPassword" ? "current-password" : "new-password"
              }
              value={password[k]}
              onChange={(e) =>
                setPassword({ ...password, [k]: e.target.value })
              }
            />
          </label>
        ))}
        <button className="button outline" disabled={busy}>
          Update password
        </button>
        <small className="muted">
          You'll sign in again after changing your password.
        </small>
      </form>
      <div className="cart-controls">
        <Link to="/orders" className="text-link">
          My orders
        </Link>
        {user.role !== "customer" && (
          <Link to="/admin/pos" className="text-link">
            Staff portal
          </Link>
        )}
        <button
          className="text-button"
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
