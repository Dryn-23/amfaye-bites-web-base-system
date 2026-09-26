import { ReviewNavLink } from "./ReviewLinks";
import ChatNavLink from "./ChatNavLink";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Monitor,
  ClipboardList,
  Users,
  Package,
  Tags,
  Warehouse,
  ChartNoAxesCombined,
  FileChartColumn,
  UserCog,
  Settings,
  LogOut,
  ArrowUpRight,
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
  ["inventory", "Inventory", Warehouse],
  ["sales", "Sales", ChartNoAxesCombined],
  ["reports", "Reports", FileChartColumn],
  ["users", "Users", UserCog],
  ["settings", "Settings", Settings],
];
export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <aside className="sidebar">
      <Logo />
      <span className="sidebar-caption">YOUR BUSINESS, AT A GLANCE</span>
      <nav>
<ReviewNavLink />
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
        <Link to="/">
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
