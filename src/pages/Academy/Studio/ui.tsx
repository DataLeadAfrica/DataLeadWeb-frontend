import { CrossIcon, TickIcon, WarnIcon } from "./Icons";
import type { CourseState, PublishCheck } from "../../../lib/studio";

// The small pieces every control room view uses.
//
// Kept together rather than one file each, because each of them is
// under twenty lines and the alternative is nine files a person has to
// open to find out what a Tag is.

/** A page heading, with its eyebrow and its buttons. */
export function Head({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="stu__h">
      <div>
        {eyebrow ? <p className="stu__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {actions ? <div className="stu__acts">{actions}</div> : null}
    </div>
  );
}

const STATE_WORDS: Record<CourseState, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "is-draft" },
  review: { label: "Ready for review", cls: "is-review" },
  published: { label: "Live", cls: "is-live" },
  archived: { label: "Archived", cls: "is-draft" },
};

export function StateTag({ state }: { state: CourseState }) {
  const w = STATE_WORDS[state] || STATE_WORDS.draft;
  return <span className={`stu__tag ${w.cls}`}>{w.label}</span>;
}

/** One number with a label, as on the Overview and the Reports. */
export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="stu__stat">
      <p>{label}</p>
      <b>{typeof value === "number" ? value.toLocaleString("en-GB") : value}</b>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

/**
 * Whatever the database said went wrong, shown as it said it.
 *
 * The messages from file 17 are written for a person: "Only an
 * administrator can publish a course", "Say why. An access grant with
 * no reason is one nobody can explain later". Replacing them with
 * something of our own would mean two places deciding what the rule is,
 * and the page's version would be the one that went stale.
 */
export function Problem({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="stu__msg is-bad" role="alert">
      <WarnIcon />
      <span>{children}</span>
    </p>
  );
}

export function Done({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="stu__msg is-ok" role="status">
      <TickIcon />
      <span>{children}</span>
    </p>
  );
}

/** The nine publish checks, exactly as the database returned them. */
export function Checks({
  checks,
  onFix,
}: {
  checks: PublishCheck[];
  onFix?: (c: PublishCheck) => void;
}) {
  return (
    <ul className="stu__checks">
      {checks.map((c) => (
        <li key={c.n} className={`stu__check ${c.passes ? "is-ok" : "is-no"}`}>
          {c.passes ? <TickIcon /> : <CrossIcon />}
          <div>
            <b>{c.label}</b>
            {!c.passes && c.detail ? <small>{c.detail}</small> : null}
          </div>
          {!c.passes && onFix ? (
            <button type="button" className="stu__chip" onClick={() => onFix(c)}>
              Fix it
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** A horizontal bar, as used all over the Reports. */
export function Bar({
  label,
  value,
  of,
  right,
}: {
  label: string;
  value: number;
  of: number;
  right: string;
}) {
  const share = of > 0 ? Math.max(2, Math.round((value / of) * 100)) : 0;
  return (
    <div className="stu__bar">
      <span>{label}</span>
      <i style={{ width: `${share}%` }} />
      <b>{right}</b>
    </div>
  );
}

/** What to show while a page is still asking. */
export function Waiting({ what }: { what: string }) {
  return <div className="stu__empty">Reading {what}.</div>;
}
