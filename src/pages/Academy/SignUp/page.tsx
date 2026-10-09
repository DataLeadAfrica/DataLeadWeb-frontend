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
import { ArrowIcon, TickIcon, WarnIcon } from "../ui/Icons";
import { handOver } from "../useAccess";
import { useCodeTimers } from "../useCodeTimers";
import { routes } from "../../routes";
import {
  CODE_LENGTH,
  confirmSignUp,
  resendSignUpCode,
  signUp,
  syncAccess,
  type AccessState,
  type ErrorField,
} from "../../../lib/academy";

// Create an Academy account. Two steps on one page: the details, then the
// code that proves the address belongs to the person.
//
// Why a code rather than a link: a link opens on whichever device the
// email was read on, which is often the phone when the person is sat at a
// laptop. A code can be carried across.
//
// Nothing on this page says anything about who gets which courses, or
// about which address to sign up with. Before somebody is signed in, the
// page has no idea who they are, so any such sentence would be a guess
// dressed up as a promise. What they can reach is settled by the server
// after they confirm, and the pass card on My learning says it then.

type Step = "details" | "code";

export default function AcademySignUp() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("details");
  const [fullName, setFullName] = useState("");
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

  // An error stops being true the moment the person edits the box it was
  // about, so it is cleared then rather than being left on screen to argue
  // with what they are now typing. A message about the submission as a
  // whole clears on any change.
  function edited(field: ErrorField) {
    if (error && (errorField === field || errorField === "form")) setError("");
  }

  function fail(message: string, field: ErrorField = "form") {
    setError(message);
    setErrorField(field);
  }

  async function onCreate() {
    setError("");
    setNote("");
    setBusy(true);
    const r = await signUp(fullName, email, password);
    setBusy(false);

    if (!r.ok) {
      fail(r.message, r.field ?? "form");
      return;
    }
    setNote(r.message);
    setStep("code");
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
    const r = await confirmSignUp(email, value);

    if (!r.ok) {
      setBusy(false);
      fail(r.message, "code");
      setCode("");
      return;
    }

    // Confirming signs the person in, so their access is worked out now
    // rather than on the next page load. The answer travels with them to
    // My learning, because the sync reports a change only once and a
    // second call there would find nothing left to report.
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
      title="Create your account | Data-Lead Academy"
      description="Create a Data-Lead Academy account."
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
          submitLabel="Confirm my email"
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
                  navigate(routes.academyMe, {
                    replace: true,
                    state: handOver(access),
                  })
                }
              >
                Go to My learning
                <ArrowIcon />
              </button>
            </>
          }
          footer={
            <>
              Wrong address?{" "}
              <button
                type="button"
                className="acad-link"
                disabled={busy}
                onClick={() => {
                  setStep("details");
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
            Learn one tool
            <br />
            at a <em>time.</em>
          </>
        }
        lead="Short, self paced courses from the team that trains our bootcamps. Watch, check what you learnt, and leave with a certificate anyone can verify."
      />

      <AcadCard
        as="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onCreate();
        }}
      >
        <StepRail current={1} />

        <h2 className="acad-h2">Create your account</h2>
        <p className="acad-sub">It takes about a minute.</p>

        <div className="acad-fields">
          <Field
            label="Full name"
            value={fullName}
            onChange={(v) => {
              setFullName(v);
              edited("name");
            }}
            autoComplete="name"
            disabled={busy}
            invalid={Boolean(error) && errorField === "name"}
            describedBy={error ? "acad-su-err" : undefined}
          />

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
            invalid={Boolean(error) && errorField === "email"}
            describedBy={error ? "acad-su-err" : undefined}
          />

          <div>
            <Field
              label="Password"
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
              describedBy={error ? "acad-su-err" : undefined}
            />
            <PasswordStrength password={password} />
          </div>

          {error ? (
            <p className="acad-msg acad-msg--bad" id="acad-su-err">
              <WarnIcon />
              <span>{error}</span>
            </p>
          ) : null}

          <button type="submit" className="acad-btn" disabled={busy}>
            {busy ? "Creating your account" : "Create my account"}
            {busy ? null : <ArrowIcon />}
          </button>
        </div>

        <p className="acad-foot">
          Already have an account? <Link to={routes.academySignIn}>Sign in</Link>
        </p>
      </AcadCard>
    </AcadStage>
  );
}
