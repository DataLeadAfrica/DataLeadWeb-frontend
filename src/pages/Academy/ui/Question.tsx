import type { QuizQuestion } from "../../../lib/learn";
import "./Question.css";

// One question with its answers. Used by the lesson check, which shows
// every question at once, and by the module quiz, which shows one at a
// time. The same component, so a question cannot look like two different
// things depending on which page it is on.
//
// MARKING IS SOMETHING THAT HAPPENS TO IT, not something it does. The
// page hands in `mark` after the server has said right or wrong. This
// component never compares an answer to anything, because the right
// answer is never in the browser to compare against.
//
// A radio input really is a radio input, hidden under the label rather
// than replaced by a div. That is what makes arrow keys, the space bar,
// a screen reader and "required" all work without writing any of it.

export type Mark = { was_right: boolean; explanation: string };

type Props = {
  question: QuizQuestion;
  index: number;
  total?: number;
  /** The chosen option id, or ids for a multi. */
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  /** Set once the server has marked it. Locks the inputs. */
  mark?: Mark | null;
  /** Hide the QUESTION n line, for a one-at-a-time quiz that has its own. */
  bare?: boolean;
};

export default function Question({
  question,
  index,
  total,
  value,
  onChange,
  mark,
  bare = false,
}: Props) {
  const multi = question.type === "multi";
  const chosen: string[] = Array.isArray(value) ? value : value ? [value] : [];
  const locked = Boolean(mark);

  function pick(optionId: string) {
    if (locked) return;
    if (!multi) {
      onChange(optionId);
      return;
    }
    onChange(
      chosen.includes(optionId)
        ? chosen.filter((x) => x !== optionId)
        : [...chosen, optionId],
    );
  }

  return (
    <div
      className={
        "acad-q" +
        (mark ? (mark.was_right ? " acad-q--good" : " acad-q--bad") : "")
      }
    >
      {bare ? null : (
        <span className="acad-q__n">
          Question {index + 1}
          {total ? ` of ${total}` : ""}
        </span>
      )}
      <p className="acad-q__p">{question.prompt}</p>

      {question.options.length === 0 ? (
        // A short answer question has no options. It is not drawn as an
        // empty box: there is nothing to choose, so it says so rather
        // than looking broken.
        <p className="acad-q__none">
          This one is answered in writing, which the Academy does not take
          yet. Please tell your tutor you saw this.
        </p>
      ) : (
        <fieldset className="acad-q__opts" disabled={locked}>
          <legend>{question.prompt}</legend>
          {question.options.map((o) => (
            <label
              key={o.id}
              className={"acad-opt" + (multi ? " acad-opt--multi" : "")}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={`q-${question.id}`}
                value={o.id}
                checked={chosen.includes(o.id)}
                onChange={() => pick(o.id)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
      )}

      {/* The explanation, once the server has sent one. For a lesson
          check it arrives whether the answer was right or wrong, which
          is the point: being told why, when you were wrong, is the only
          part of this that teaches anybody anything. */}
      {mark && mark.explanation ? (
        <p className="acad-q__why">{mark.explanation}</p>
      ) : null}
    </div>
  );
}
