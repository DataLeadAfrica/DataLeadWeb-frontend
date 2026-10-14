import { useId } from "react";

import "./Ask.css";

// The three controls the About you section is made of: a dropdown, a
// plain box, and a row of chips.
//
// WHY THEY ARE NOT Field. Field has a floating label, which is right
// for three boxes in a column where the label can afford to be inside
// the box. About you asks twenty questions in four sections, and a
// floating label on a dropdown is wrong twice over: a dropdown is never
// empty, so the label never floats, and a question like "Sector of your
// place of primary assignment" does not fit inside a box. These put the
// question above the control, in bold, where it reads as a question.
//
// EVERY ONE OF THEM CAN BE HIDDEN, and hidden means disabled. A
// question that does not apply is not rendered at all, so there is
// nothing to send, nothing to check, and nothing for a screen reader to
// read out. The brief asks for exactly this: "A hidden question is
// disabled, so it is never sent and never checked."
//
// INVALID IS ONE AT A TIME. The form shows one message, under the one
// control it is about, and that control gets the red outline. A form
// that lights up eight boxes at once tells somebody they got everything
// wrong, which is both untrue and unhelpful.

type Common = {
  label: string;
  /** Shown under the control in small grey type. Not a rule, a fact. */
  hint?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
};

// ---------------------------------------------------------------------
// A dropdown
// ---------------------------------------------------------------------

export function Pick({
  label,
  hint,
  invalid,
  describedBy,
  disabled,
  value,
  onChange,
  options,
  placeholder = "Choose one",
}: Common & {
  value: string;
  onChange: (v: string) => void;
  /** Either plain words, or [value, what the person reads] pairs. */
  options: readonly (string | readonly [string, string])[];
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="acad-ask">
      <label className="acad-ask__label" htmlFor={id}>
        {label}
      </label>
      <div className="acad-ask__wrap">
        <select
          id={id}
          className={`acad-ask__pick${invalid ? " is-bad" : ""}`}
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => {
            const [v, text] = typeof o === "string" ? [o, o] : o;
            return (
              <option key={v} value={v}>
                {text}
              </option>
            );
          })}
        </select>
        {/* The arrow. The browser's own is a different shape on every
            platform, so the box hides it and this is drawn instead. */}
        <svg className="acad-ask__caret" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {hint ? <p className="acad-ask__hint">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// A plain box
// ---------------------------------------------------------------------

export function Box({
  label,
  hint,
  invalid,
  describedBy,
  disabled,
  value,
  onChange,
  maxLength,
  autoComplete,
  inputMode,
}: Common & {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: "text" | "numeric";
}) {
  const id = useId();
  return (
    <div className="acad-ask">
      <label className="acad-ask__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`acad-ask__box${invalid ? " is-bad" : ""}`}
        type="text"
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="acad-ask__hint">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// A row of chips
// ---------------------------------------------------------------------

/**
 * One tap rather than a dropdown, for the two or three way questions
 * where every answer fits on the screen at once.
 *
 * A dropdown hides its options until you open it, which for three words
 * is more work than reading three words. It is a radio group underneath,
 * so the arrow keys move between them and a screen reader says "1 of 3".
 */
export function Chips({
  label,
  hint,
  invalid,
  describedBy,
  disabled,
  value,
  onChange,
  options,
  max,
  note,
}: Common & {
  /** A string for one answer, an array when max is set. */
  value: string | string[];
  onChange: (v: never) => void;
  options: readonly (string | readonly [string, string])[];
  /** Set it to allow more than one, up to this many. */
  max?: number;
  /** Small grey words beside the question, like "Up to two". */
  note?: string;
}) {
  const many = typeof max === "number";
  const chosen = many ? (value as string[]) || [] : [];
  const name = useId();

  const pick = (v: string) => {
    if (!many) {
      (onChange as (x: string) => void)(v === value ? "" : v);
      return;
    }
    const next = chosen.includes(v)
      ? chosen.filter((x) => x !== v)
      : chosen.length >= (max as number)
        ? chosen
        : [...chosen, v];
    (onChange as (x: string[]) => void)(next);
  };

  return (
    <div
      className="acad-ask"
      role={many ? "group" : "radiogroup"}
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    >
      <p className="acad-ask__label">
        {label}
        {note ? <span className="acad-ask__note">{note}</span> : null}
      </p>
      <div className={`acad-answers${invalid ? " is-bad" : ""}`}>
        {options.map((o) => {
          const [v, text] = typeof o === "string" ? [o, o] : o;
          const on = many ? chosen.includes(v) : value === v;
          // At the limit, the ones not already chosen are off. Not
          // disabled: a disabled button says nothing about why, and
          // tapping one that is already on is how you change your mind.
          const full = many && !on && chosen.length >= (max as number);
          return (
            <button
              key={v}
              type="button"
              name={name}
              role={many ? "checkbox" : "radio"}
              aria-checked={on}
              aria-disabled={full || undefined}
              disabled={disabled}
              className={`acad-answer${on ? " is-on" : ""}${full ? " is-full" : ""}`}
              onClick={() => (full ? undefined : pick(v))}
            >
              <i className="acad-answer__dot" aria-hidden="true" />
              {text}
            </button>
          );
        })}
      </div>
      {hint ? <p className="acad-ask__hint">{hint}</p> : null}
    </div>
  );
}

/** The small grey heading above each group of questions. */
export function AskSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="acad-asks">
      <h4 className="acad-asks__title">{title}</h4>
      <div className="acad-asks__grid">{children}</div>
    </section>
  );
}
