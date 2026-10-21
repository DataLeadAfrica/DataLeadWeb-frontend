import { useState } from "react";

import { ArrowIcon, SendIcon } from "../Icons";
import { Checks, Done, Problem } from "../ui";
import type { PublishCheck, StudioCourseFull } from "./data";
import {
  archiveCourse,
  publishCourse,
  restoreCourse,
  sendBack,
  sendForReview,
  unpublishCourse,
} from "../../../../lib/studio";

// The publish panel.
//
// IT DRAWS WHAT lms_publish_checks RETURNED, and lms_publish_course
// consults the same function before it agrees. There is one list, so
// this panel cannot show nine green ticks beside a refusal, and adding
// a tenth check means changing one thing.
//
// THE TWO ROLES SEE DIFFERENT BUTTONS AND THE SAME CHECKS. A facilitator
// gets "Send for review" and an administrator gets "Publish now". The
// checks are identical because they are the same question, and a
// facilitator who cannot see why their course is not ready cannot fix
// it.
//
// WHAT HAPPENS WHEN THE DATABASE SAYS NO. The message is shown exactly
// as it came back. file 17's refusals are written for a person, and
// replacing them here would mean two places deciding what the rule is.

type Props = {
  course: StudioCourseFull;
  isAdmin: boolean;
  onFix: (c: PublishCheck) => void;
  onChanged: () => void;
};

export default function Publish({ course, isAdmin, onFix, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState<"" | "back" | "down" | "archive" | "restore">("");

  const checks = course.checks || [];
  const passing = checks.filter((c) => c.passes).length;
  const ready = checks.length > 0 && passing === checks.length;

  type Said = { ok: true; data: string | null } | { ok: false; message: string };

  async function run(what: () => Promise<Said>) {
    setProblem("");
    setDone("");
    setBusy(true);
    const got = await what();
    setBusy(false);
    if (got.ok) {
      setDone(got.data || "Done.");
      setAsking("");
      setNote("");
      onChanged();
    } else {
      setProblem(got.message || "That did not work.");
    }
  }

  return (
    <aside className="stu__panel" aria-label="Ready to publish">
      <header>
        <div>
          <span className="stu__label">Ready to publish?</span>
          <h2 style={{ marginTop: 4 }}>
            {ready ? "Every check passes" : `${passing} of ${checks.length} pass`}
          </h2>
        </div>
      </header>

      <Checks checks={checks} onFix={onFix} />

      <div className="stu__grid" style={{ marginTop: 16, gap: 10 }}>
        <Problem>{problem}</Problem>
        <Done>{done}</Done>

        {course.state === "archived" ? (
          /* ARCHIVED, AND THERE IS A WAY BACK. Nothing used to turn an
             archived course into a draft again, so Big Sam had to
             archive a test course with SQL and could not have undone it
             at all. It returns as a DRAFT and not as live, because
             appearing again is one decision and going live is another,
             with the whole checklist in between. */
          isAdmin ? (
            asking === "restore" ? (
              <>
                <label className="stu__field">
                  <span>Why is it coming back?</span>
                  <input
                    className="stu__in"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="We are running it again in the new year"
                  />
                  <small>It comes back as a draft, so nothing goes live by accident.</small>
                </label>
                <button
                  type="button"
                  className="acad-btn"
                  disabled={busy || !note.trim()}
                  onClick={() => run(() => restoreCourse(course.id, note))}
                >
                  Bring it back to draft
                </button>
                <button type="button" className="stu__chip" onClick={() => setAsking("")}>
                  Leave it archived
                </button>
              </>
            ) : (
              <>
                <p className="stu__hint">
                  This course is archived. It is out of the catalogue and nobody can enrol, but
                  nothing has been deleted and anybody holding its certificate still has one.
                </p>
                <button type="button" className="stu__chip" onClick={() => setAsking("restore")}>
                  Bring it back to draft
                </button>
              </>
            )
          ) : (
            <p className="stu__hint">
              This course is archived. Ask an administrator if it should come back.
            </p>
          )
        ) : course.state === "published" ? (
          <>
            {isAdmin ? (
              asking === "down" ? (
                <>
                  <label className="stu__field">
                    <span>Why is it coming down?</span>
                    <input
                      className="stu__in"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="A lesson has the wrong video"
                    />
                    <small>
                      Taking a live course down is the kind of thing somebody asks about later.
                    </small>
                  </label>
                  <button
                    type="button"
                    className="acad-btn"
                    disabled={busy}
                    onClick={() => run(() => unpublishCourse(course.id, note))}
                  >
                    Take it down
                  </button>
                  <button type="button" className="stu__chip" onClick={() => setAsking("")}>
                    Leave it up
                  </button>
                </>
              ) : (
                <button type="button" className="stu__chip" onClick={() => setAsking("down")}>
                  Take it down
                </button>
              )
            ) : (
              <p className="stu__hint">
                It is live. Words can still be fixed; the video, the length and the order cannot.
                Ask an administrator to take it down for those.
              </p>
            )}
          </>
        ) : isAdmin ? (
          <>
            <button
              type="button"
              className="acad-btn"
              disabled={busy || !ready}
              onClick={() => run(() => publishCourse(course.id))}
            >
              {busy ? "Publishing" : "Publish now"}
              {busy || !ready ? null : <ArrowIcon />}
            </button>
            {!ready ? (
              <p className="stu__hint">
                {checks.length - passing} thing{checks.length - passing === 1 ? "" : "s"} still to
                do. Each one above has a button that takes you to it.
              </p>
            ) : null}

            {/* ARCHIVING, FOR AN ADMINISTRATOR, ON A COURSE THAT IS NOT
                LIVE. lms_archive_course has existed since file 17 and
                nothing ever called it, so the only way to archive
                anything was to write SQL by hand. A live course is not
                offered this at all: file 22 refuses it and says to
                unpublish first, so offering it here would be offering a
                button that cannot work. */}
            {asking === "archive" ? (
              <>
                <label className="stu__field">
                  <span>Why is it being archived?</span>
                  <input
                    className="stu__in"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="A duplicate of the Stata course"
                  />
                  <small>
                    Archiving hides a course from the catalogue. Nothing is deleted, and anybody
                    holding its certificate keeps it.
                  </small>
                </label>
                <button
                  type="button"
                  className="stu__chip"
                  disabled={busy || !note.trim()}
                  onClick={() => run(() => archiveCourse(course.id, note))}
                >
                  Archive this course
                </button>
                <button type="button" className="stu__chip" onClick={() => setAsking("")}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="stu__chip" onClick={() => setAsking("archive")}>
                Archive this course
              </button>
            )}

            {course.state === "review" ? (
              asking === "back" ? (
                <>
                  <label className="stu__field">
                    <span>What needs doing?</span>
                    <textarea
                      className="stu__in"
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Lesson 4 needs its chapters, and the summary is a bit long."
                    />
                    <small>A course sent back with no note is one nobody knows how to fix.</small>
                  </label>
                  <button
                    type="button"
                    className="stu__chip"
                    disabled={busy}
                    onClick={() => run(() => sendBack(course.id, note))}
                  >
                    Send it back
                  </button>
                  <button type="button" className="stu__chip" onClick={() => setAsking("")}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className="stu__chip" onClick={() => setAsking("back")}>
                  Send back with a note
                </button>
              )
            ) : null}
          </>
        ) : course.state === "review" ? (
          <p className="stu__hint">
            Sent for review. An administrator will publish it or send it back with a note.
          </p>
        ) : (
          <>
            <label className="stu__field">
              <span>Anything to say?</span>
              <textarea
                className="stu__in"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ready when you are."
              />
            </label>
            <button
              type="button"
              className="acad-btn"
              disabled={busy || !ready}
              onClick={() => run(() => sendForReview(course.id, note))}
            >
              {busy ? "Sending" : "Send for review"}
              <SendIcon />
            </button>
            {!ready ? (
              <p className="stu__hint">
                {checks.length - passing} thing{checks.length - passing === 1 ? "" : "s"} still to
                do before it can go.
              </p>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
