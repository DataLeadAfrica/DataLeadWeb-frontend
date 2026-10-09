import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import "../academy.css";
import "./page.css";
import Seo from "../../../components/Seo/component";
import AcadCard from "../ui/AcadCard";
import AcadStage from "../ui/AcadStage";
import CodeStep from "../CodeStep";
import Field from "../ui/Field";
import Pitch from "../Pitch";
import { ArrowIcon, TickIcon, WarnIcon } from "../ui/Icons";
import { handOver } from "../useAccess";
import { useCodeTimers } from "../useCodeTimers";
import { routes } from "../../routes";
import {
  CODE_LENGTH,
  confirmSignUp,
  resendSignUpCode,
  signIn,
  syncAccess,
  type AccessState,
  type ErrorField,
} from "../../../lib/academy";

// Sign in with an email address and a password.
//
// The one thing this page is careful about: a failed sign in says the same
// sentence whether the password was wrong or the address has never been
// used here. Telling them apart would turn this form into a way of finding
// out who has an account.
//
// The single exception is an account that exists but was never confirmed.
// That person is stuck with no way of guessing why, so they are offered a
// new code. It gives away that the address is in use, which is a small
// thing next to leaving somebody unable to get in at all.

type Step = "password" | "code";

export default function AcademySignIn() {
  const navigate = useNavigate();
  const location = useLocation();

  // Where to go afterwards. RequireAccount puts the page they wanted in
  // here, so they land back on it rather than somewhere they did not ask
  // for. The check on the prefix is what stops the state being used to
  // bounce somebody off the site.
  const from = (location.state as { from?: string } | null)?.from;
  const goTo = from && from.startsWith("/lms") ? from : routes.academyMe;

  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<ErrorField>("form");
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [access, setAccess] = useState<AccessState | null>(null);

  const timers = useCodeTimers(step === "code");

  function edited(field: ErrorField) {
    if (error && (errorField === field || errorField === "form")) setError("");
  }

  function fail(message: string, field: ErrorField = "form") {
    setError(message);
    setErrorField(field);
  }

  async function onSignIn() {
    setError("");
    setNote("");
    setBusy(true);
    const r = await signIn(email, password);

    if (r.ok) {
      const state = await syncAccess();
      setBusy(false);
      navigate(goTo, { replace: true, state: handOver(state) });
      return;
    }

    if (r.needsCode) {
      const sent = await resendSignUpCode(email);
      setBusy(false);
      setNote(sent.ok ? `${r.message} ${sent.message}` : r.message);
      setStep("code");
      timers.restart();
      return;
    }

    setBusy(false);
    fail(r.message, r.field ?? "form");
  }

  async function onConfirm(entered?: string) {
    // entered is the value the boxes have just finished, which the page's
    // own code state does not hold yet. See CodeStep's onSubmit.
    const value = entered ?? code;
    if (value.length !== CODE_LENGTH) {
      fail(`Please enter all ${CODE_LENGTH} digits.`, "code");
      return;
    }
    setError("");
    setBusy(true);
    const r = await confirmSignUp(email, value);

    if (!r.ok) {
      setBusy(false);
      fail(r.message, "code");
      setCode("");
      return;
    }

    const state = await syncAccess();
    setAccess(state);
    setBusy(false);
    setNote("");
    setAccepted(true);
  }

  async function onResend() {
    setError("");
    setBusy(true);
    const r = await resendSignUpCode(email);
    setBusy(false);
    setNote(r.ok ? r.message : "");
    if (!r.ok) fail(r.message, "form");
    else timers.restart();
  }

  const seo = (
    <Seo
      title="Sign in | Data-Lead Academy"
      description="Sign in to Data-Lead Academy."
      noindex
    />
  );

  if (step === "code") {
    return (
      <AcadStage width="wide" focus>
        {seo}
        <CodeStep
          email={email}
          title="Confirm your email"
          railStep={accepted ? 3 : 2}
          code={code}
          onCodeChange={(c) => {
            setCode(c);
            edited("code");
          }}
          onSubmit={onConfirm}
          onResend={onResend}
          timers={timers}
          busy={busy}
          accepted={accepted}
          error={error}
          note={note}
          submitLabel="Confirm and sign in"
          done={
            <>
              <p className="acad-msg acad-msg--ok">
                <TickIcon />
                <span>Email confirmed. Welcome to the Academy.</span>
              </p>
              <button
                type="button"
                className="acad-btn"
                onClick={() =>
                  navigate(goTo, { replace: true, state: handOver(access) })
                }
              >
                Go to My learning
                <ArrowIcon />
              </button>
            </>
          }
        />
      </AcadStage>
    );
  }

  return (
    <AcadStage focus>
      {seo}
      <Pitch
        headline={
          <>
            Welcome <em>back.</em>
          </>
        }
        lead="Sign in to pick up where you left off. Your place in every lesson is kept to the last ten seconds you watched."
      />

      <AcadCard
        as="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSignIn();
        }}
      >
        <h2 className="acad-h2">Sign in</h2>
        <p className="acad-sub">Your email address and your password.</p>

        <div className="acad-fields">
          <Field
            label="Email address"
            type="email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              edited("email");
            }}
            autoComplete="email"
            disabled={busy}
            invalid={Boolean(error)}
            describedBy={error ? "acad-si-err" : undefined}
          />

          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              edited("password");
            }}
            autoComplete="current-password"
            disabled={busy}
            canReveal
            invalid={Boolean(error)}
            describedBy={error ? "acad-si-err" : undefined}
          />

          <p className="acad-signin__forgot">
            <Link className="acad-link" to={routes.academyReset}>
              Forgot your password?
            </Link>
          </p>

          {error ? (
            <p className="acad-msg acad-msg--bad" id="acad-si-err">
              <WarnIcon />
              <span>{error}</span>
            </p>
          ) : null}

          <button type="submit" className="acad-btn" disabled={busy}>
            {busy ? "Signing you in" : "Sign in"}
            {busy ? null : <ArrowIcon />}
          </button>
        </div>

        <p className="acad-foot">
          New here? <Link to={routes.academySignUp}>Create an account</Link>
        </p>
      </AcadCard>
    </AcadStage>
  );
}
