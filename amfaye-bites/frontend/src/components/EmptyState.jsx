import { ShoppingBag, Package, Coffee } from "lucide-react";

export default function EmptyState({
  icon = "cart",
  title = "Nothing here yet",
  text = "Start adding items to see them here",
  action,
  actionText
}) {
  const icons = {
    cart: <ShoppingBag size={48} strokeWidth={1.5} />,
    orders: <Package size={48} strokeWidth={1.5} />,
    products: <Coffee size={48} strokeWidth={1.5} />,
  };

  return (
    <div className="empty">
      <div className="empty-icon float-animation">
        {icons[icon] || icons.cart}
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && actionText && (
        <button className="button" onClick={action}>
          {actionText}
        </button>
      )}
    </div>
  );
}
