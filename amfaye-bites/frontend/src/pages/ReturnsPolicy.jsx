import { Link } from "react-router-dom";
import { ShieldCheck, Camera, Clock, AlertCircle, CreditCard } from "lucide-react";

export default function ReturnsPolicy() {
  return (
    <div className="container page narrow">
      <div className="page-heading centered">
        <span className="eyebrow">RETURNS & REFUNDS</span>
        <h1>Quality guarantee</h1>
        <p>If it's wrong, damaged, or contaminated — we make it right.</p>
      </div>

      <section className="panel">
        <ShieldCheck className="green" />
        <h3>Food safety exception</h3>
        <p>
          Any product containing <strong>insects, mold, spoilage, or other
          contamination</strong> is <strong>fully refunded — no restocking
          fee, no questions asked</strong>. Please report it as soon as
          possible with a photo.
        </p>
      </section>

      <section className="panel stack tight">
        <h3>How to report</h3>
        <ol className="stack tight">
          <li>
            Go to <Link to="/quality">Report a problem</Link> and enter your
            order ID.
          </li>
          <li>
            Choose the issue type and describe what happened. Photos speed up
            approval (<Camera size={14} /> recommended).
          </li>
          <li>
            Save the ticket number (e.g. <code>QC-XXXXXX-XXXXX</code>) to
            track progress.
          </li>
          <li>
            Staff review within <strong>3–5 business days</strong>. Approved
            refunds are processed back to the original payment method.
          </li>
        </ol>
      </section>

      <section className="panel stack tight">
        <h3>Good to know</h3>
        <ul className="stack tight">
          <li>
            <AlertCircle size={15} /> Photos strongly recommended for
            contamination claims.
          </li>
          <li>
            <Clock size={15} /> Review time: 3–5 business days after
            inspection.
          </li>
          <li>
            <CreditCard size={15} /> Refunds go back to the original payment
            method (demo GCash or cash record).
          </li>
        </ul>
      </section>

      <p className="muted centered small">
        This is a school-project prototype. No real payment is processed and
        refunds are simulated.
      </p>
    </div>
  );
}
