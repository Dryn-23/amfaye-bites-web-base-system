import { useState } from "react";
import {
  Smartphone,
  MessageSquare,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { api } from "../services/api";
export default function DemoPayment({ onVerified }) {
  const [session, setSession] = useState(null);
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="demo-payment">
      <div className="demo-warning">
        <ShieldCheck size={17} />
        <span>
          <b>Demo Payment — No real money will be transferred.</b>
          <br />
          Do not enter a real PIN, password, OTP, or financial information.
        </span>
      </div>
      <div className="phone-frame">
        <div className="phone-notch" />
        <div className="demo-brand">
          <Smartphone size={20} />
          GCash <span>DEMO</span>
        </div>
        {verified ? (
          <div className="demo-success">
            <CheckCircle2 size={42} />
            <h3>Demo verification successful!</h3>
            <p>You're ready to place your demo order.</p>
          </div>
        ) : !session ? (
          <>
            <h3>A safe little simulation.</h3>
            <label>
              Simulated mobile number
              <input readOnly value="09XX XXX XXXX" />
            </label>
            <button
              type="button"
              className="button full"
              disabled={busy}
              onClick={() =>
                run(async () =>
                  setSession(
                    await api("/payments/demo-otp", {
                      method: "POST",
                      body: {},
                    }),
                  ),
                )
              }
            >
              Continue
            </button>
            <small>
              Prototype only. No real payment is processed.
              <br />
              No mobile number is collected.
            </small>
          </>
        ) : (
          <>
            <h3>Verify your demo payment</h3>
            <p>Use the code from the simulated Messages app.</p>
            <button
              type="button"
              className="button outline full"
              onClick={() => setShow(!show)}
            >
              <MessageSquare size={16} />
              {show ? "Hide" : "Show"} Demo OTP
            </button>
            {show && (
              <div className="demo-message">
                <b>Amfaye Bites Demo</b>
                <p>Your verification code is:</p>
                <strong>{session.demoCode}</strong>
                <small>
                  This is a demo code. No real SMS was sent.
                  <br />
                  Expires after 5 minutes.
                </small>
              </div>
            )}
            <input
              aria-label="Demo verification code"
              className="otp-input"
              placeholder="000000"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              maxLength={6}
            />
            <button
              type="button"
              className="button full"
              disabled={busy || code.length !== 6}
              onClick={() =>
                run(async () => {
                  await api("/payments/demo-verify", {
                    method: "POST",
                    body: { sessionId: session.sessionId, code },
                  });
                  setVerified(true);
                  onVerified(session.sessionId);
                })
              }
            >
              Verify demo code
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setSession(null);
                setCode("");
                setShow(false);
              }}
            >
              Request a new code
            </button>
          </>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
