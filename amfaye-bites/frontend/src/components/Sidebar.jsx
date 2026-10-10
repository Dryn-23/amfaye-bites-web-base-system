import PreparationNavLink from "./PreparationNavLink";
import { ReviewNavLink } from "./ReviewLinks";
import ChatNavLink from "./ChatNavLink";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Monitor,
  ClipboardList,
  Users,
  Package,
  Percent,
  Tags,
  Warehouse,
  ChartNoAxesCombined,
  Flame,
  Gift,
  FileChartColumn,
  Wallet,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { Logo } from "./Navbar";
import { useAuth } from "../context/AuthContext";

const links = [
  ["", "Dashboard", LayoutDashboard],
  ["pos", "Point of sale", Monitor],
  ["orders", "Orders", ClipboardList],
  ["customers", "Customers", Users],
  ["products", "Products", Package],
  ["categories", "Categories", Tags],
  ["promotions", "Promotions", Percent],
  ["flash-sales", "Flash sales", Flame],
  ["bundles", "Bundles", Gift],
  ["inventory", "Inventory", Warehouse],
  ["sales", "Sales", ChartNoAxesCombined],
  ["reports", "Reports", FileChartColumn],
  ["cash-drawer", "Cash drawer", Wallet],
  ["analytics", "Analytics", BarChart3],
  ["users", "Users", UserCog],
  ["settings", "Settings", Settings],
];

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // One handler on <nav> closes the drawer when ANY link inside is tapped,
  // including PreparationNavLink, ReviewNavLink and ChatNavLink.
  const closeOnLinkClick = (e) => {
    if (e.target.closest("a")) onClose?.();
  };

  return (
    <aside className="sidebar" id="admin-sidebar">
      <Logo />
      <span className="sidebar-caption">YOUR BUSINESS, AT A GLANCE</span>

      <nav onClick={closeOnLinkClick}>
        <PreparationNavLink />
        <ReviewNavLink />
        {user.role !== "customer" && (
          <NavLink to="/admin/quality-reports">
            <ShieldAlert size={18} />
            Refunds
          </NavLink>
        )}
        <ChatNavLink staff />
        {links
          .filter(
            ([path]) =>
              user.role === "admin" ||
              ["pos", "orders", "inventory"].includes(path),
          )
          .map(([path, label, Icon]) => (
            <NavLink key={path} to={"/admin" + (path ? "/" + path : "")} end>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
      </nav>

      <div className="sidebar-bottom">
        <Link to="/" onClick={onClose}>
          View storefront <ArrowUpRight size={16} />
        </Link>
        <div className="staff-info">
          <span>{user.name[0]}</span>
          <div>
            <b>{user.name}</b>
            <small>{user.role}</small>
          </div>
        </div>
        <button
          className="text-button"
          onClick={async () => {
            onClose?.();
            await logout();
            navigate("/login");
          }}
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </aside>
  );
}