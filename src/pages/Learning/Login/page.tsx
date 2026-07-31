import { useState } from "react";
import { Link, useNavigate } from "react-router";

import "./page.css";
import Seo from "../../../components/Seo/component";
import { routes } from "../../routes";
import { requestLoginCode, loginWithCode } from "../../../lib/learning";
import { isConfigured } from "../../../lib/certificateConfig";

type Stage = "email" | "code";

export default function LearnerLogin() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    const clean = email.trim();
    if (!clean || !clean.includes("@")) {
      setError("Please enter the email address you registered with.");
      return;
    }
    setBusy(true);
    setError("");
    const sent = await requestLoginCode(clean);
    setBusy(false);
    if (!sent) {
      // Deliberately vague. Saying "no such participant" would let anyone
      // check whether a given email is on the course.
      setError(
        "We could not send a code just now. Check the address and try again, or contact us if it keeps happening.",
      );
      return;
    }
    setStage("code");
  }

  async function signIn() {
    const clean = code.trim();
    if (clean.length < 4) {
      setError("Enter the code from your email.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await loginWithCode(email, clean);
    setBusy(false);
    if (!res) {
      setError("That code was not right, or it has expired. Codes last a few minutes.");
      return;
    }
    navigate(routes.myLearning);
  }

  return (
    <main className="lgn">
      <Seo
        title="Sign in to your learning portal | Data-Lead Africa"
        description="Participants sign in to see their progress, sit module assessments and claim certificates."
        noindex
      />

      <div className="lgn__wrap">
        <p className="lgn__eyebrow">Learning portal</p>
        <h1 className="lgn__h1">Sign in</h1>

        {!isConfigured && (
          <p className="lgn__text">
            The learning portal is not live yet. Please{" "}
            <Link to={routes.contactUs}>contact us</Link> if you need your
            progress.
          </p>
        )}

        {isConfigured && stage === "email" && (
          <>
            <p className="lgn__text">
              Enter the email address you registered with. We will send you a
              code. There is no password to remember.
            </p>

            <label className="lgn__label" htmlFor="lgn-email">
              Email address
            </label>
            <input
              id="lgn-email"
              className="lgn__input"
              type="email"
              autoComplete="email"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && sendCode()}
            />

            {error && <p className="lgn__error">{error}</p>}

            <button
              type="button"
              className="lgn__btn"
              onClick={sendCode}
              disabled={busy}
            >
              {busy ? "Sending..." : "Send me a code"}
            </button>
          </>
        )}

        {isConfigured && stage === "code" && (
          <>
            <p className="lgn__text">
              We have sent a code to <b>{email}</b>. It lasts a few minutes.
              Check your spam folder if it does not arrive.
            </p>

            <label className="lgn__label" htmlFor="lgn-code">
              Your code
            </label>
            <input
              id="lgn-code"
              className="lgn__input lgn__input--code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              disabled={busy}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && signIn()}
            />

            {error && <p className="lgn__error">{error}</p>}

            <button
              type="button"
              className="lgn__btn"
              onClick={signIn}
              disabled={busy}
            >
              {busy ? "Checking..." : "Sign in"}
            </button>

            <button
              type="button"
              className="lgn__link"
              onClick={() => {
                setStage("email");
                setCode("");
                setError("");
              }}
            >
              Use a different email address
            </button>
          </>
        )}

        <p className="lgn__foot">
          Looking to check a certificate instead?{" "}
          <Link to={routes.myCertificate}>Claim your certificate</Link>.
        </p>
      </div>
    </main>
  );
}
