import { useEffect, useState } from "react";

import { CrossIcon, WarnIcon } from "../Icons";
import { Done, Problem } from "../ui";
import {
  asWhen,
  getLearnerRecord,
  giveAccess,
  removeAccess,
  type LearnerRecord,
  type StudioLearner,
} from "../../../../lib/studio";

// One learner's record.
//
// EVERY OPEN OF THIS IS LOGGED, by the database, because of what is in
// it. lms_learner_record writes a line into lms_admin_actions before it
// returns a row, and this component calls that function rather than
// reading the table, so the logging cannot be stepped around by a second
// route.
//
// DISABILITY IS SENSITIVE PERSONAL DATA under the Nigeria Data
// Protection Act 2023. It is here, one learner at a time, for an
// administrator, and it appears nowhere else: not in the list behind
// this drawer, not in any report, not in any export. The reports show
// totals only, and any group under five comes back as the words "fewer
// than 5".
//
// SO THE DETAIL IS NOT SHOWN UNTIL IT IS ASKED FOR. The fact that
// somebody said yes is on the card; what they wrote is behind a button.
// An administrator who opened this drawer to check an exam wait has no
// reason to read it, and a page that puts it on screen regardless makes
// that decision for them.

type Props = {
  learner: StudioLearner;
  onClose: () => void;
  onChanged: () => void;
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="stu__bar" style={{ gridTemplateColumns: "150px minmax(0,1fr)" }}>
      <span className="stu__label">{label}</span>
      <span style={{ fontSize: 13.5 }}>{value}</span>
    </div>
  );
}

export default function Drawer({ learner, onClose, onChanged }: Props) {
  const [record, setRecord] = useState<LearnerRecord | null>(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [giving, setGiving] = useState(false);
  const [reason, setReason] = useState("");
  const [course, setCourse] = useState("");

  useEffect(() => {
    getLearnerRecord(learner.user_id).then((a) => {
      if (a.ok) setRecord(a.data);
      else setProblem(a.message);
    });
  }, [learner.user_id]);

  return (
    <>
      <div className="stu__scrim" onClick={onClose} />
      <aside className="stu__drawer" role="dialog" aria-modal="true" aria-labelledby="learner">
        <header>
          <div>
            <p className="stu__eyebrow">Learner</p>
            <h2 id="learner" className="stu__h2">
              {learner.full_name || "No name"}
            </h2>
            <p className="stu__hint" style={{ marginTop: 4 }}>
              {learner.email} · joined {asWhen(learner.joined)}
            </p>
          </div>
          <button type="button" className="stu__x" onClick={onClose} aria-label="Close">
            <CrossIcon />
          </button>
        </header>

        <div className="stu__grid">
          <Problem>{problem}</Problem>
          <Done>{done}</Done>

          <section className="stu__panel">
            <header>
              <h3>Where they are</h3>
            </header>
            <div className="stu__grid" style={{ gap: 8 }}>
              <Row label="Courses" value={`${learner.course_count}`} />
              <Row
                label="Furthest"
                value={
                  learner.furthest_course
                    ? `${learner.furthest_course} · ${learner.furthest_percent || 0}%`
                    : "No course yet"
                }
              />
              <Row label="Last active" value={asWhen(learner.last_active) || "Not yet"} />
              <Row label="Certificates" value={`${learner.certificates}`} />
              <Row label="Access" value={learner.access_source || "none"} />
            </div>
          </section>

          {learner.state === "waiting" ? (
            <p className="stu__msg is-warn">
              <WarnIcon />
              <span>
                <b>Both exam tries used.</b> The exam opens again by itself after 24 hours, with a
                fresh set of questions. Lifting the wait does the same thing now, and is recorded.
                It does not hand anybody a pass: the tries are still spent and the scores still
                stand.
              </span>
            </p>
          ) : null}

          {record ? (
            <section className="stu__panel">
              <header>
                <h3>About them</h3>
                <span className="stu__label">
                  Answered {asWhen(record.consented_at) || "at sign up"}
                </span>
              </header>
              <div className="stu__grid" style={{ gap: 8 }}>
                <Row
                  label="Where"
                  value={[record.city, record.state, record.country].filter(Boolean).join(", ")}
                />
                <Row label="Age" value={record.age_band} />
                <Row label="Gender" value={record.gender} />
                <Row label="Education" value={record.education_level} />
                <Row label="Work" value={record.occupation} />
                <Row label="Heard about us" value={record.heard_from} />
                <Row label="Wants to" value={(record.goals || []).join(", ")} />
                <Row label="Disability" value={record.disability} />
              </div>

              {record.disability === "Yes" && record.disability_detail ? (
                <div style={{ marginTop: 12 }}>
                  {showDetail ? (
                    <p className="stu__msg is-warn">
                      <WarnIcon />
                      <span>
                        <b>In their own words:</b> {record.disability_detail}
                        <br />
                        This is sensitive personal data under the NDPA 2023. Reading it has been
                        recorded.
                      </span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="stu__chip"
                      onClick={() => setShowDetail(true)}
                    >
                      Show what they wrote
                    </button>
                  )}
                  <p className="stu__hint" style={{ marginTop: 8 }}>
                    Only administrators can read this, one learner at a time, and every read is in
                    the activity log. It never appears in a list, a report or an export.
                  </p>
                </div>
              ) : null}
            </section>
          ) : (
            <p className="stu__hint">
              They have not filled in the About you form, or it was refused.
            </p>
          )}

          <section className="stu__panel">
            <header>
              <h3>Access</h3>
            </header>
            {giving ? (
              <div className="stu__grid" style={{ gap: 10 }}>
                <label className="stu__field">
                  <span>Course id</span>
                  <input
                    className="stu__in"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="Paste the course id from its builder address"
                  />
                </label>
                <label className="stu__field">
                  <span>Why</span>
                  <input
                    className="stu__in"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Scholarship for the October cohort"
                  />
                  <small>
                    Not optional. "Why does this person have the paid course" is a question that
                    gets asked.
                  </small>
                </label>
                <div className="stu__chips">
                  <button
                    type="button"
                    className="acad-btn acad-btn--auto"
                    onClick={async () => {
                      const got = await giveAccess({
                        user: learner.user_id,
                        course,
                        reason,
                        source: "scholarship",
                      });
                      if (got.ok) {
                        setDone("Access given, and recorded.");
                        setGiving(false);
                        setReason("");
                        setCourse("");
                        onChanged();
                      } else setProblem(got.message);
                    }}
                  >
                    Give access
                  </button>
                  <button type="button" className="stu__chip" onClick={() => setGiving(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="stu__chips">
                <button type="button" className="stu__chip" onClick={() => setGiving(true)}>
                  Give a course
                </button>
                <button
                  type="button"
                  className="stu__chip"
                  onClick={async () => {
                    const why = window.prompt("Why is this access being removed?");
                    if (!why) return;
                    const which = window.prompt("Which course id?");
                    if (!which) return;
                    const got = await removeAccess(learner.user_id, which, why);
                    if (got.ok) {
                      setDone("Access removed. Their progress is untouched.");
                      onChanged();
                    } else setProblem(got.message);
                  }}
                >
                  Remove a course
                </button>
              </div>
            )}
            <p className="stu__hint" style={{ marginTop: 10 }}>
              Bootcamp access follows the roster and is not given by hand. Removing access revokes
              it rather than deleting it, so nothing a learner has done is lost.
            </p>
          </section>
        </div>
      </aside>
    </>
  );
}
