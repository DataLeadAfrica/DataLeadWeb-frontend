import "./CodeStep.css";
import AcadCard from "./ui/AcadCard";
import CodeBoxes from "./ui/CodeBoxes";
import MeterRing from "./ui/MeterRing";
import StepRail from "./ui/StepRail";
import { asClock } from "./ui/format";
import { ArrowIcon, MailIcon, TickIcon, WarnIcon } from "./ui/Icons";
import type { CodeTimers } from "./useCodeTimers";
import { CODE_SECONDS, RESEND_WAIT_SECONDS } from "../../lib/academy";

// The code screen, shared by sign up, sign in and reset.
//
// All three ask for the same six digits in the same way, and the three
// copies this replaces had already started to drift apart: only two of
// them had a resend button, and the third was the one people were most
// likely to need it on. One component means a fix lands in all three.
//
// Everything is a real form with a real submit button, so Enter works and
// a password manager recognises the step. The boxes also submit themselves
// the moment the sixth digit lands, because nobody wants to press a button
// after typing a code they have just read off their phone.

type Props = {
  /** Shown so people can see whether they mistyped their own address. */
  email: string;
  title: string;
  /** Overrides the line under the title. Reset needs a conditional one,
      because it must not claim to have sent a code to an address that may
      have no account. */
  lead?: React.ReactNode;
  /** Which step of the three the rail should light. */
  railStep: number;
  railSteps?: [string, string, string];

  code: string;
  onCodeChange: (code: string) => void;
  /** Takes the code as an argument as well as reading it from state. The
      boxes submit themselves the instant the sixth digit lands, which is
      the same tick the parent is told about it, so at that moment the
      parent's own copy is still one digit behind. Handing the value over
      is what stops the page refusing a code that is plainly complete. */
  onSubmit: (code?: string) => void;
  onResend: () => void;

  timers: CodeTimers;
  busy: boolean;
  /** Turns the boxes green and swaps the meters for the done panel. */
  accepted: boolean;
  /** What to show once the code has been accepted. */
  done?: React.ReactNode;

  error: string;
  note: string;
  submitLabel: string;
  /** The "Wrong address?" line under the card. */
  footer?: React.ReactNode;
};

export default function CodeStep({
  email,
  title,
  lead,
  railStep,
  railSteps,
  code,
  onCodeChange,
  onSubmit,
  onResend,
  timers,
  busy,
  accepted,
  done,
  error,
  note,
  submitLabel,
  footer,
}: Props) {
  const canResend = !busy && timers.resend === 0 && !accepted;

  return (
    <AcadCard centred className="acad-verify">
      <StepRail current={railStep} steps={railSteps} />

      <div className="acad-beacon" aria-hidden="true">
        <MailIcon />
      </div>

      <h1 className="acad-h2 acad-verify__title">{title}</h1>
      <p className="acad-lead acad-verify__to">
        {lead ?? (
          <>
            We sent a 6 digit code to <b>{email}</b>
          </>
        )}
      </p>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !accepted) onSubmit();
        }}
      >
        <CodeBoxes
          value={code}
          onChange={onCodeChange}
          onComplete={(entered) => onSubmit(entered)}
          disabled={busy || accepted}
          accepted={accepted}
          refused={Boolean(error)}
        />

        {/* aria-live so the verdict is spoken without the person having to
            go looking for it. */}
        <div className="acad-verify__say" aria-live="polite">
          {error ? (
            <p className="acad-msg acad-msg--bad">
              <WarnIcon />
              <span>{error}</span>
            </p>
          ) : null}
          {!error && note ? (
            <p className="acad-msg acad-msg--note">
              <TickIcon />
              <span>{note}</span>
            </p>
          ) : null}
        </div>

        {!accepted ? (
          <>
            <div className="acad-meters">
              <MeterRing label="Code lasts" left={timers.life} total={CODE_SECONDS}>
                <b>{asClock(timers.life)}</b>
              </MeterRing>

              <MeterRing
                label={timers.resend > 0 ? "New code in" : "Ready"}
                left={timers.resend}
                total={RESEND_WAIT_SECONDS}
              >
                <button type="button" disabled={!canResend} onClick={onResend}>
                  {timers.resend > 0
                    ? `${timers.resend}s`
                    : "Send another code"}
                </button>
              </MeterRing>
            </div>

            <button
              type="submit"
              className="acad-btn acad-verify__go"
              disabled={busy}
            >
              {busy ? "Checking" : submitLabel}
              {busy ? null : <ArrowIcon />}
            </button>

            {/* The same line on every flow. Nearly every message that does
                not arrive is sitting in a spam folder, and saying so here
                saves somebody pressing resend three times first. */}
            <p className="acad-verify__spam">
              Nothing after 5 minutes? Have a look in your spam folder.
            </p>
          </>
        ) : null}
      </form>

      {accepted ? <div className="acad-verify__done">{done}</div> : null}

      {!accepted && footer ? <p className="acad-foot">{footer}</p> : null}
    </AcadCard>
  );
}
