import { useState } from "react";

import { CrossIcon, TickIcon, WarnIcon } from "../Icons";
import { Problem } from "../ui";
import { readSheet } from "./sheet";
import { pasteQuestions, type PasteOutcome } from "../../../../lib/studio";

// Paste a sheet of questions.
//
// COLUMNS: Question, A, B, C, D, Right, Why, Lesson, Time.
//
// THE PASTE AREA TAKES WHAT EXCEL PUTS ON THE CLIPBOARD, which is tab
// separated with one row per line. Nothing is uploaded and no file is
// read: a paste is what somebody actually does, and asking for a .csv
// means asking them to Save As first, find the file, and discover that
// Excel wrote it in the wrong encoding.
//
// EVERY ROW IS JUDGED AND THE ANSWER SAYS WHICH WERE SKIPPED AND WHY.
// The alternative, refusing the whole paste on the first bad row, is
// what makes somebody paste forty rows eight times. The database does
// the judging, in two passes, so nothing is written until every row has
// been read: a paste that half worked is worse than one that did not,
// because they fix the sheet, paste again, and now have duplicates.

type Props = {
  quiz: string;
  onClose: () => void;
  onDone: () => void;
};

export default function Paste({ quiz, onClose, onDone }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<PasteOutcome[] | null>(null);

  const rows = readSheet(text);

  async function send() {
    setProblem("");
    setBusy(true);
    const got = await pasteQuestions(quiz, rows);
    setBusy(false);
    if (!got.ok) {
      setProblem(got.message);
      return;
    }
    setResult(got.data);
  }

  const added = (result || []).filter((r) => r.outcome === "added").length;
  const skipped = (result || []).filter((r) => r.outcome === "skipped");

  return (
    <>
      <div className="stu__scrim" onClick={onClose} />
      <aside className="stu__drawer" role="dialog" aria-modal="true" aria-labelledby="paste">
        <header>
          <div>
            <p className="stu__eyebrow">Questions</p>
            <h2 id="paste" className="stu__h2">
              Paste from a sheet
            </h2>
          </div>
          <button type="button" className="stu__x" onClick={onClose} aria-label="Close">
            <CrossIcon />
          </button>
        </header>

        <div className="stu__grid">
          {result ? (
            <>
              <p className="stu__msg is-ok">
                <TickIcon />
                <span>
                  <b>
                    {added} question{added === 1 ? "" : "s"} added.
                  </b>{" "}
                  {skipped.length > 0
                    ? `${skipped.length} row${skipped.length === 1 ? " was" : "s were"} skipped. Fix those in your sheet and paste them again.`
                    : "Every row landed."}
                </span>
              </p>

              {skipped.length > 0 ? (
                <div className="stu__scroll">
                  <table className="stu__table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Why it was skipped</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skipped.map((r) => (
                        <tr key={r.row_no}>
                          <td>{r.row_no}</td>
                          <td>{r.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <button type="button" className="acad-btn" onClick={onDone}>
                Back to the questions
              </button>
            </>
          ) : (
            <>
              <p className="stu__hint">
                Copy the rows out of your sheet and paste them in. The columns are{" "}
                <b>Question, A, B, C, D, Right, Why, Lesson, Time</b>, in that order. Right is the
                letter of the correct option. Lesson and Time are optional, and link the question
                to a chapter so a miss takes the learner back to it.
              </p>

              <label className="stu__field">
                <span>The rows</span>
                <textarea
                  className="stu__in"
                  rows={10}
                  value={text}
                  placeholder={
                    "Question\tA\tB\tC\tD\tRight\tWhy\tLesson\tTime\nWhat does read_csv return?\tA DataFrame\tA list\t\t\tA\tIt reads a file into a table.\tLoading a CSV\t2:10"
                  }
                  onChange={(e) => setText(e.target.value)}
                />
                <small>
                  {rows.length === 0
                    ? "Nothing pasted yet."
                    : `${rows.length} row${rows.length === 1 ? "" : "s"} read. Nothing is written until all of them have been checked.`}
                </small>
              </label>

              <Problem>{problem}</Problem>

              {rows.length > 0 ? (
                <p className="stu__msg is-warn">
                  <WarnIcon />
                  <span>
                    Rows that are not right are skipped and named, one at a time. The good ones
                    still land, so you only have to fix what was wrong.
                  </span>
                </p>
              ) : null}

              <button
                type="button"
                className="acad-btn"
                disabled={busy || rows.length === 0}
                onClick={send}
              >
                {busy ? "Checking every row" : `Add ${rows.length || ""} question${rows.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
