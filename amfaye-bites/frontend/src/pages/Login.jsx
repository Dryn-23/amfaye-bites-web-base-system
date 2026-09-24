import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Leaf } from "lucide-react";
import { useAuth } from "../context/AuthContext";
export default function Login({ register = false }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
    login: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { authenticate } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const field = (key, label, type = "text") => (
    <label>
      {label}
      <input
        required
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        autoComplete={
          key === "password"
            ? register
              ? "new-password"
              : "current-password"
            : key === "login"
              ? "username"
              : key === "confirmPassword"
                ? "new-password"
                : key
        }
        minLength={key === "password" ? 8 : undefined}
        maxLength={key.includes("assword") ? 72 : 150}
        placeholder={key === "phone" ? "09XXXXXXXXX" : label}
      />
    </label>
  );
  return (
    <div className="auth-page container">
      <div className="auth-art">
        <Leaf size={35} />
        <span className="eyebrow">YOUR DAILY DOSE OF HAPPY</span>
        <h1>
          A warm welcome.
          <br />A sweeter day.
        </h1>
        <p>
          Your favorite pastries and fruit shakes,
          <br />
          just a few clicks away.
        </p>
        <img src="/hero.png" alt="Pastries and fruit shakes" />
        <span>Freshly Baked. Freshly Blended.</span>
      </div>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const user = await authenticate(
              register ? "register" : "login",
              form,
            );
            navigate(
              location.state?.from ||
                (["admin", "cashier"].includes(user.role)
                  ? "/admin/pos"
                  : "/menu"),
              { replace: true },
            );
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="eyebrow">
          {register ? "JOIN OUR LITTLE HAPPY PLACE" : "GOOD TO HAVE YOU BACK"}
        </span>
        <h2>
          {register ? "Make yourself at home." : "Hello again, sweet friend."}
        </h2>
        <p>
          {register
            ? "Create an account to start your order."
            : "Sign in for your next feel-good favorite."}
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {register ? (
          <>
            <div className="form-row">
              {field("name", "Full name")}
              {field("username", "Username")}
            </div>
            {field("email", "Email address", "email")}
            {field("phone", "Mobile number", "tel")}
          </>
        ) : (
          field("login", "Email or username")
        )}
        {field("password", "Password", "password")}
        {register && field("confirmPassword", "Confirm password", "password")}
        <button className="button full" disabled={busy}>
          {busy
            ? "One little moment…"
            : register
              ? "Create my account"
              : "Sign in"}
          <ArrowRight size={17} />
        </button>
        <p className="auth-switch">
          {register ? "Already part of the family?" : "New around here?"}{" "}
          <Link to={register ? "/login" : "/register"} state={location.state}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <small className="muted">
          School-project prototype. Demo payments never transfer real money.
        </small>
      </form>
    </div>
  );
}
