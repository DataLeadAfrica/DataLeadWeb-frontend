import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import Seo from "../../../components/Seo/component";
import { routes } from "../../routes";
import { getToken, requestCode, signIn } from "../../../lib/learning";
import LiveBackground from "../LiveBackground";
import "../portal.css";

// Sign in to the learning portal. Email address, then a one time code.
// There is no password. Deliberately noindex: this page is for enrolled
// participants and has no business in search results.

export default function LearnerLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // Already signed in? Go straight through.
  useEffect(() => {
    if (getToken()) navigate(routes.myLearning, { replace: true });
  }, [navigate]);

  async function handleSendCode() {
    setError("");
    setBusy(true);
    const r = await requestCode(email);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setNote(r.message);
    setStep("code");
  }

  async function handleSignIn() {
    setError("");
    setBusy(true);
    const r = await signIn(email, code);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    navigate(routes.myLearning, { replace: true });
  }

  return (
    <>
      <Seo
        title="Sign in | Data-Lead Africa learning portal"
        description="Sign in to sit your section assessments and collect your certificates."
        noindex
      />
      <div className="lp">
        <LiveBackground />
        <main className="lgn">
          <div className="lgn__card glass brk">
            <p className="eyebrow">
              <i />
              Learning portal
            </p>

            {step === "email" ? (
              <>
                <h1 className="lgn__h1">Sign in</h1>
                <p className="lgn__txt">
                  Enter the email address you registered with. We will send you
                  a code. There is no password to remember.
                </p>
                <label className="lbl" htmlFor="lgn-email">
                  Email address
                </label>
                <input
                  id="lgn-email"
                  className="inp"
                  type="email"
                  autoComplete="email"
                  value={email}
                  disabled={busy}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy) handleSendCode();
                  }}
                />
                {error ? (
                  <p className="err">
                    <span>&#9888;</span>
                    <span>{error}</span>
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn btn--go btn--wide w100"
                  disabled={busy}
                  onClick={handleSendCode}
                >
                  {busy ? "Sending" : "Send me a code"}{" "}
                  <span className="arw">&#8594;</span>
                </button>
              </>
            ) : (
              <>
                <h1 className="lgn__h1">Check your email</h1>
                <p className="lgn__txt">
                  {note} Check your spam folder if it does not arrive.
                </p>
                <label className="lbl" htmlFor="lgn-code">
                  Your code
                </label>
                <input
                  id="lgn-code"
                  className="inp inp--code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  disabled={busy}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy) handleSignIn();
                  }}
                />
                {error ? (
                  <p className="err">
                    <span>&#9888;</span>
                    <span>{error}</span>
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn btn--go btn--wide w100"
                  disabled={busy}
                  onClick={handleSignIn}
                >
                  {busy ? "Checking" : "Sign in"}{" "}
                  <span className="arw">&#8594;</span>
                </button>
                <button
                  type="button"
                  className="lnk"
                  disabled={busy}
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError("");
                  }}
                >
                  Use a different email address
                </button>
              </>
            )}

            <p className="foot">
              Looking to check a certificate instead?{" "}
              <Link to={routes.myCertificate}>Claim your certificate</Link>.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
