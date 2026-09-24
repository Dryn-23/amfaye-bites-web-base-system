import { Link, NavLink } from "react-router-dom";
import {
  ShoppingBag,
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
      <div className="announcement">
        A little sweetness. A little freshness. A whole lot of happiness.{" "}
        <span>
          Made fresh, just for you <Sprout size={13} />
        </span>
      </div>
      <header className="header">
        <div className="nav-wrap">
          <Logo />
          <nav
            className={open ? "main-nav open" : "main-nav"}
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
            <Link className="user-link" to={user ? "/profile" : "/login"}>
              <UserRound size={18} />
              <span>{user ? user.name.split(" ")[0] : "Sign in"}</span>
            </Link>
            <Link
              className="cart-link"
              to="/cart"
              aria-label={`Cart with ${count} items`}
            >
              <ShoppingBag size={19} />
              <span>{count}</span>
            </Link>
            <Link to="/menu" className="button small nav-order">
              Order now <ArrowUpRight size={16} />
            </Link>
            <button
              className="icon-btn mobile-toggle"
              aria-label="Toggle navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
