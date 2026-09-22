import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import Seo from "../../../components/Seo/component";
import { routes } from "../../routes";
import {
  getToken,
  passwordSignIn,
  requestCode,
  signIn,
} from "../../../lib/learning";
import LiveBackground from "../LiveBackground";
import "../portal.css";

// Sign in to the learning portal.
//
// The usual route is email and password, with the password issued by the
// training team. Signing in with a one time email code is kept as a backup,
// one click away, for anyone who has forgotten their password or is locked
// out. Both create exactly the same session.
//
// Deliberately noindex: this page is for enrolled participants only.

type Mode = "password" | "email" | "code";

export default function LearnerLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [suggestCode, setSuggestCode] = useState(false);

  // Already signed in? Go straight through.
  useEffect(() => {
    if (getToken()) navigate(routes.myLearning, { replace: true });
  }, [navigate]);

  function clearMessages() {
    setError("");
    setNotEnrolled(false);
    setSuggestCode(false);
  }

  function switchTo(next: Mode) {
    clearMessages();
    setCode("");
    setMode(next);
  }

  async function handlePasswordSignIn() {
    clearMessages();
    setBusy(true);
    const r = await passwordSignIn(email, password);
    setBusy(false);
    if (r.status === "ok") {
      navigate(routes.myLearning, { replace: true });
      return;
    }
    setError(r.message);
    setNotEnrolled(r.status === "not_enrolled");
    // No password yet, or locked out: the email code is the way in
    setSuggestCode(r.status === "no_password" || r.status === "locked");
  }

  async function handleSendCode() {
    clearMessages();
    setBusy(true);
    const r = await requestCode(email);
    setBusy(false);
    if (r.status === "not_enrolled") {
      setNotEnrolled(true);
      setError(r.message);
      return;
    }
    if (r.status === "invalid" || r.status === "failed") {
      setError(r.message);
      return;
    }
    // "sent", or enrolled with a code already on its way
    setNote(r.message);
    setMode("code");
  }

  async function handleCodeSignIn() {
    clearMessages();
    setBusy(true);
    const r = await signIn(email, code);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    navigate(routes.myLearning, { replace: true });
  }

  const errorBlock = error ? (
    <p className="err">
      <span>&#9888;</span>
      <span>
        {error}
        {notEnrolled ? (
          <>
            {" "}
            If you think this is wrong,{" "}
            <Link to={routes.contactUs}>contact the training team</Link>.
          </>
        ) : null}
      </span>
    </p>
  ) : null;

  const emailField = (
    <>
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
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) clearMessages();
        }}
      />
    </>
  );

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

            {mode === "password" ? (
              <>
                <h1 className="lgn__h1">Sign in</h1>
                <p className="lgn__txt">
                  Use the email address you registered with and the password the
                  training team gave you.
                </p>
                {emailField}
                <label className="lbl" htmlFor="lgn-pass">
                  Password
                </label>
                <div className="pw">
                  <input
                    id="lgn-pass"
                    className="inp pw__inp"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    disabled={busy}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) clearMessages();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !busy) handlePasswordSignIn();
                    }}
                  />
                  <button
                    type="button"
                    className="pw__eye"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errorBlock}
                <button
                  type="button"
                  className="btn btn--go btn--wide w100"
                  disabled={busy}
                  onClick={handlePasswordSignIn}
                >
                  {busy ? "Signing in" : "Sign in"}{" "}
                  <span className="arw">&#8594;</span>
                </button>
                <button
                  type="button"
                  className={`lnk${suggestCode ? " lnk--nudge" : ""}`}
                  disabled={busy}
                  onClick={() => switchTo("email")}
                >
                  {suggestCode
                    ? "Sign in with an email code instead"
                    : "Forgotten your password? Sign in with an email code"}
                </button>
              </>
            ) : mode === "email" ? (
              <>
                <h1 className="lgn__h1">Sign in with a code</h1>
                <p className="lgn__txt">
                  We will email you a one time code. Use this if you have
                  forgotten your password or are locked out.
                </p>
                {emailField}
                {errorBlock}
                <button
                  type="button"
                  className="btn btn--go btn--wide w100"
                  disabled={busy}
                  onClick={handleSendCode}
                >
                  {busy ? "Sending" : "Send me a code"}{" "}
                  <span className="arw">&#8594;</span>
                </button>
                <button
                  type="button"
                  className="lnk"
                  disabled={busy}
                  onClick={() => switchTo("password")}
                >
                  Sign in with a password instead
                </button>
              </>
            ) : (
              <>
                <h1 className="lgn__h1">Check your email</h1>
                <p className="lgn__txt">
                  {note} It lasts a few minutes. Check your spam folder if it
                  does not arrive.
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
                    if (e.key === "Enter" && !busy) handleCodeSignIn();
                  }}
                />
                {errorBlock}
                <button
                  type="button"
                  className="btn btn--go btn--wide w100"
                  disabled={busy}
                  onClick={handleCodeSignIn}
                >
                  {busy ? "Checking" : "Sign in"}{" "}
                  <span className="arw">&#8594;</span>
                </button>
                <button
                  type="button"
                  className="lnk"
                  disabled={busy}
                  onClick={() => switchTo("password")}
                >
                  Sign in with a password instead
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
