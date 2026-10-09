import ChatNavLink from "./ChatNavLink";
import NotificationBell from "./NotificationBell";
import { Link, NavLink } from "react-router-dom";
import {
  ShoppingCart,
  UserRound,
  ArrowUpRight,
  Menu as MenuIcon,
  X,
  Sprout,
} from "lucide-react";
import { useState } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
export function Logo() {
  return (
    <Link className="logo" to="/">
      <span className="logo-mark">
        <Sprout size={27} />
      </span>
      <span>
        amfaye
        <span className="logo-bites">
          bites<span className="logo-dot">.</span>
        </span>
      </span>
    </Link>
  );
}
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const { user } = useAuth();
  return (
    <>
      <header className="header">
        <div className="nav-wrap">
          <Logo />
          <button
            className="icon-btn mobile-toggle"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <MenuIcon />}
          </button>
          <nav
            className={open ? "main-nav open" : "main-nav"}
            aria-label="Main"
            onClick={() => setOpen(false)}
          >
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/menu">Our Menu</NavLink>
            <NavLink to="/promotions">
              Sweet Deals <span className="nav-new">NEW</span>
            </NavLink>
            <NavLink to="/about">Our Story</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>
          <div className="nav-actions">
<ChatNavLink />
            <NotificationBell />
            <Link className="user-link" to={user ? "/profile" : "/login"}>
              <UserRound size={18} />
              <span>{user ? user.name.split(" ")[0] : "Sign in"}</span>
            </Link>
            <Link
              className="cart-link"
              to="/cart"
              aria-label={`Cart with ${count} items`}
            >
              <ShoppingCart size={28} strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{count}</span>
            </Link>
            <Link to="/menu" className="button small nav-order">
              Order now <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
