import { Link } from "react-router-dom";
import { MessageCircle, ShoppingBag, ShieldCheck } from "lucide-react";
export default function Contact() {
  return (
    <div className="container page narrow">
      <div className="page-heading centered">
        <span className="eyebrow">LET'S MAKE YOUR DAY BETTER</span>
        <h1>We're happy you're here.</h1>
        <p>A little help for your next happy bite.</p>
      </div>
      <section className="panel">
        <MessageCircle className="green" />
        <h3>Questions about your order?</h3>
        <p>
          Check the latest status in My Orders. For special requests, add a note
          at checkout so the staff can review it.
        </p>
        <Link className="button outline" to="/orders">
          View my orders
        </Link>
      </section>
      <section className="panel">
        <ShoppingBag className="green" />
        <h3>Pickup & allergen information</h3>
        <p>
          Our pastries may contain wheat, milk, eggs, and nuts. Shakes may
          contain dairy. This demo cannot guarantee allergen-free preparation.
        </p>
        <p className="muted">
          Business phone, store address, and operating hours have not been
          configured. Ask the project owner for details before using this system
          for an actual business.
        </p>
      </section>
      <div className="info">
        <ShieldCheck size={22} />
        <span>
          This is a school-project prototype. No real payment is processed and
          no real pickup location is advertised.
        </span>
      </div>
    </div>
  );
}
