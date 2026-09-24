import { ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
export default function EmptyState({
  title = "A little empty, a lot of possibilities.",
  text = "Find your next favorite on our menu.",
  to = "/menu",
  label = "Explore the menu",
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ShoppingBag size={30} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {to && (
        <Link className="button" to={to}>
          {label}
        </Link>
      )}
    </div>
  );
}
