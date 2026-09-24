import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { useCart } from "../context/CartContext";
import { money } from "../utils/currency";
import CartItems from "../components/Cart";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
export default function Cart() {
  const cart = useCart();
  if (cart.loading) return <Loading />;
  return (
    <div className="container page">
      <div className="page-heading">
        <span className="eyebrow">YOUR LITTLE BAG OF HAPPY</span>
        <h1>Good choices. Great cravings.</h1>
        <p>
          {cart.count} item{cart.count !== 1 ? "s" : ""} waiting to brighten
          your day.
        </p>
      </div>
      {cart.syncError && (
        <div className="warning">
          Cart saved on this device, but server sync failed: {cart.syncError}
        </div>
      )}
      {cart.items.length ? (
        <div className="checkout-layout">
          <div>
            <CartItems {...cart} />
            <div className="cart-controls">
              <Link to="/menu" className="text-link">
                <ArrowLeft size={16} />
                Keep exploring
              </Link>
              <button className="text-button muted" onClick={cart.clear}>
                Clear bag
              </button>
            </div>
          </div>
          <aside className="summary-card">
            <h3>Your order summary</h3>
            <div className="summary-line">
              <span>Subtotal</span>
              <strong>{money(cart.total)}</strong>
            </div>
            <div className="summary-line">
              <span>Pickup</span>
              <span className="green">Always free</span>
            </div>
            <div className="summary-line total">
              <span>Total</span>
              <strong>{money(cart.total)}</strong>
            </div>
            <Link className="button full" to="/checkout">
              Proceed to checkout <ArrowRight size={17} />
            </Link>
            <p className="tiny">
              <ShieldCheck size={15} />
              Freshly prepared. Securely ordered.
            </p>
            <small className="muted">
              Have a sweet deal? Apply your code at checkout.
            </small>
          </aside>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
