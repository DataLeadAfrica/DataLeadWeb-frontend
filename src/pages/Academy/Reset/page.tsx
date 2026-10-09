import { useState } from "react";
import { Link, useNavigate } from "react-router";

import "../academy.css";
import Seo from "../../../components/Seo/component";
import AcadCard from "../ui/AcadCard";
import AcadStage from "../ui/AcadStage";
import CodeStep from "../CodeStep";
import Field from "../ui/Field";
import PasswordStrength from "../ui/PasswordStrength";
import Pitch from "../Pitch";
import StepRail from "../ui/StepRail";
import { ArrowIcon, WarnIcon } from "../ui/Icons";
import { handOver } from "../useAccess";
import { useCodeTimers } from "../useCodeTimers";
import { routes } from "../../routes";
import {
  CODE_LENGTH,
  confirmPasswordReset,
  setNewPassword,
  startPasswordReset,
  syncAccess,
  type ErrorField,
} from "../../../lib/academy";

// Forgot password, in three steps: the address, the code, the new
// password.
//
// The first step ALWAYS shows the same message, whether or not the address
// has an account, and so does "send another code". Anything else would
// make this page a way of checking who has an account, which is worth more
// to somebody guessing than it is to the person who mistyped their own
// address. src/lib/academy.ts explains how that survives rate limiting,
// which is the part that is easy to get wrong.

type Step = "email" | "code" | "password";

const RAIL: [string, string, string] = ["Address", "Code", "New password"];

export default function AcademyReset() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<ErrorField>("form");
  const [note, setNote] = useState("");

  const timers = useCodeTimers(step === "code");

  function edited(field: ErrorField) {
    if (error && (errorField === field || errorField === "form")) setError("");
  }

  function fail(message: string, field: ErrorField = "form") {
    setError(message);
    setErrorField(field);
  }

  async function onSend() {
    setError("");
    setNote("");
    setBusy(true);
    const r = await startPasswordReset(email);
    setBusy(false);

    if (!r.ok) {
      fail(r.message, r.field ?? "form");
      return;
    }
    // No note: the code screen's own line says it, conditionally.
    setNote("");
    setStep("code");
    timers.restart();
  }

  // The same call as the first send, deliberately. If "send another code"
  // could answer differently from the first one, the page would leak on
  // the second press what it had been careful not to leak on the first.
  async function onResend() {
    setError("");
    setBusy(true);
    const r = await startPasswordReset(email);
    setBusy(false);
    if (!r.ok) {
      fail(r.message, "form");
      return;
    }
    // Conditional, like everything else on this page.
    setNote("If that address has an account, another code is on its way.");
    timers.restart();
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
    const r = await confirmPasswordReset(email, value);
    setBusy(false);

    if (!r.ok) {
      fail(r.message, "code");
      setCode("");
      return;
    }
    setNote("");
    setStep("password");
  }

  async function onSetPassword() {
    setError("");
    setBusy(true);
    const r = await setNewPassword(password);

    if (!r.ok) {
      setBusy(false);
      fail(r.message, r.field ?? "password");
      return;
    }

    // Confirming the code signed them in, so they go straight through
    // rather than being asked to type the password they just chose.
    const state = await syncAccess();
    setBusy(false);
    navigate(routes.academyMe, { replace: true, state: handOver(state) });
  }

  const seo = (
    <Seo
      title="Reset your password | Data-Lead Academy"
      description="Reset your Data-Lead Academy password."
      noindex
    />
  );

  if (step === "code") {
    return (
      <AcadStage width="wide" focus>
        {seo}
        <CodeStep
          email={email}
          title="Check your inbox"
          lead={
            <>
              If <b>{email}</b> has an account, a {CODE_LENGTH} digit code is
              on its way.
            </>
          }
          railStep={2}
          railSteps={RAIL}
          code={code}
          onCodeChange={(c) => {
            setCode(c);
            edited("code");
          }}
          onSubmit={onConfirm}
          onResend={onResend}
          timers={timers}
          busy={busy}
          accepted={false}
          error={error}
          note={note}
          submitLabel="Continue"
          footer={
            <>
              Wrong address?{" "}
              <button
                type="button"
                className="acad-link"
                disabled={busy}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                  setNote("");
                }}
              >
                Go back and change it
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
            Back in, in <em>three steps.</em>
          </>
        }
        lead="We send a six digit code to your email address, you type it in, and then you choose a new password."
        showPath={false}
      />

      {step === "email" ? (
        <AcadCard
          as="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) onSend();
          }}
        >
          <StepRail current={1} steps={RAIL} />
          <h2 className="acad-h2">Reset your password</h2>
          <p className="acad-sub">
            Enter your email address and we will send you a {CODE_LENGTH} digit
            code.
          </p>

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
              describedBy={error ? "acad-rs-err" : undefined}
            />

            {error ? (
              <p className="acad-msg acad-msg--bad" id="acad-rs-err">
                <WarnIcon />
                <span>{error}</span>
              </p>
            ) : null}

            <button type="submit" className="acad-btn" disabled={busy}>
              {busy ? "Sending" : "Send me a code"}
              {busy ? null : <ArrowIcon />}
            </button>
          </div>

          <p className="acad-foot">
            Remembered it? <Link to={routes.academySignIn}>Sign in</Link>
          </p>
        </AcadCard>
      ) : (
        <AcadCard
          as="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) onSetPassword();
          }}
        >
          <StepRail current={3} steps={RAIL} />
          <h2 className="acad-h2">Choose a new password</h2>
          <p className="acad-sub">
            Almost done. Pick something you have not used elsewhere.
          </p>

          <div className="acad-fields">
            <div>
              <Field
                label="New password"
                type="password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  edited("password");
                }}
                autoComplete="new-password"
                disabled={busy}
                canReveal
                invalid={Boolean(error) && errorField === "password"}
                describedBy={error ? "acad-rs2-err" : undefined}
              />
              <PasswordStrength password={password} />
            </div>

            {error ? (
              <p className="acad-msg acad-msg--bad" id="acad-rs2-err">
                <WarnIcon />
                <span>{error}</span>
              </p>
            ) : null}

            <button type="submit" className="acad-btn" disabled={busy}>
              {busy ? "Saving" : "Save and continue"}
              {busy ? null : <ArrowIcon />}
            </button>
          </div>
        </AcadCard>
      )}
    </AcadStage>
  );
}
