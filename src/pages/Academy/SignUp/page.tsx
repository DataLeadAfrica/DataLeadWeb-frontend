import { useState } from "react";
import { Link, useNavigate } from "react-router";

import "../academy.css";
import Seo from "../../../components/Seo/component";
import AboutYou from "./AboutYou";
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
import { clearHidden, firstProblem, toMetadata, type Answers } from "./answers.js";
import {
  CODE_LENGTH,
  confirmSignUp,
  resendSignUpCode,
  signUp,
  syncAccess,
  type AccessState,
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

  // ONE OBJECT, NOT TWENTY PIECES OF STATE. The rules in answers.js all
  // take the whole set of answers, because most of them are about one
  // answer in the light of another: a postal code is only asked for in
  // Nigeria, a qualification only after tertiary. Twenty separate
  // useState calls would mean assembling that object at every call site.
  //
  // NOT IN localStorage, and that is deliberate. A half filled form left
  // in a browser's storage on a shared machine, with the disability
  // answer in it, is exactly what the Nigeria Data Protection Act is
  // about. If the tab is closed the answers are gone, which is the
  // right trade.
  const [a, setA] = useState<Answers>({ goals: [] });
  const [code, setCode] = useState("");

  const fullName = a.full_name || "";
  const email = a.email || "";
  const password = a.password || "";

  /**
   * Change some answers, and clear anything those changes just hid.
   *
   * THE CLEARING IS THE IMPORTANT HALF. Somebody picks Nigeria, types a
   * postal code, then changes to Ghana: without this the postal code is
   * still in the object, is still sent, and the database refuses the
   * whole row for a question the form stopped asking. It is done here,
   * once, rather than in twenty onChange handlers.
   */
  function set(patch: Partial<Answers>) {
    setA((old) => clearHidden({ ...old, ...patch }));
    if (error) setError("");
  }

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A plain string, not ErrorField. ErrorField is the four fields the
  // auth helpers know about; this form has twenty more, named by
  // firstProblem in answers.js, and the name is only ever compared.
  const [errorField, setErrorField] = useState<string>("form");
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [access, setAccess] = useState<AccessState | null>(null);

  const timers = useCodeTimers(step === "code");

  // An error stops being true the moment the person edits the box it was
  // about, so it is cleared then rather than being left on screen to argue
  // with what they are now typing. A message about the submission as a
  // whole clears on any change.
  function edited(field: string) {
    if (error && (errorField === field || errorField === "form")) setError("");
  }

  function fail(message: string, field: string = "form") {
    setError(message);
    setErrorField(field);
  }

  async function onCreate() {
    setError("");
    setNote("");

    // EVERY FIELD IS CHECKED BEFORE ANYTHING IS SENT, and one message at
    // a time. firstProblem walks the questions in the order they are
    // asked and returns the first that is wrong, so the message is
    // always about the field nearest the top that still needs
    // attention. A form that lists eight problems at once tells somebody
    // they got everything wrong.
    //
    // The same rules are in the database as check constraints, so a
    // request that skips this page is refused there too. This is the
    // polite half; that is the real one.
    const problem = firstProblem(a);
    if (problem) {
      fail(problem.message, problem.field);
      // Put the field on screen. On a phone the work section is a long
      // way below the fold and a message about it would otherwise
      // appear somewhere nobody is looking.
      requestAnimationFrame(() => {
        const el = document.querySelector('[aria-invalid="true"]');
        if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }

    setBusy(true);
    const r = await signUp(fullName, email, password, toMetadata(a));
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
    <AcadStage width="form" focus>
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
        <p className="acad-sub">About two minutes.</p>

        <div className="acad-fields">
          <Field
            label="Full name"
            value={fullName}
            onChange={(v) => set({ full_name: v })}
            autoComplete="name"
            disabled={busy}
            invalid={Boolean(error) && errorField === "name"}
            describedBy={error ? "acad-su-err" : undefined}
          />

          <Field
            label="Email address"
            type="email"
            value={email}
            onChange={(v) => set({ email: v })}
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
              onChange={(v) => set({ password: v })}
              autoComplete="new-password"
              disabled={busy}
              canReveal
              invalid={Boolean(error) && errorField === "password"}
              describedBy={error ? "acad-su-err" : undefined}
            />
            <PasswordStrength password={password} />
          </div>
        </div>

        {/* ----------------------------------------------- About you */}
        <h3 className="acad-su__about">About you</h3>

        <AboutYou
          a={a}
          set={set}
          badField={error ? String(errorField) : ""}
          errorId="acad-su-err"
          disabled={busy}
        />

        <div className="acad-fields acad-su__end">
          <label className="acad-agree">
            <input
              type="checkbox"
              checked={Boolean(a.consent)}
              disabled={busy}
              aria-invalid={(Boolean(error) && errorField === "consent") || undefined}
              onChange={(e) => set({ consent: e.target.checked })}
            />
            <span>
              I agree to the{" "}
              <a href="/privacy-policy" target="_blank" rel="noreferrer">
                terms and privacy policy
              </a>
            </span>
          </label>

          {error ? (
            <p className="acad-msg acad-msg--bad" id="acad-su-err" role="alert">
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
