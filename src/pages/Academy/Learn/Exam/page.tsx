import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import "./page.css";
import AcadStage from "../../ui/AcadStage";
import Breadcrumb from "../../ui/Breadcrumb";
import Question from "../../ui/Question";
import Seo from "../../../../components/Seo/component";
import { ArrowIcon, SealIcon, TickIcon, WarnIcon } from "../../ui/Icons";
import { answerPayload, countdown, examView } from "./state.js";
import {
  examRewatch,
  getMyCourse,
  startExam,
  submitExam,
  type ExamRewatch,
  type ExamResult,
  type ExamState,
  type MyCourse,
  type StartedExam,
} from "../../../../lib/learn";
import { asClock } from "../../../../lib/catalogue";
import { routes } from "../../../routes";

// The course exam.
//
// THREE SCREENS IN ONE PAGE, and which one shows is decided by the
// database, not here:
//
//   the rules      what the exam is, and whether it can be started
//   sitting it     the questions, with the server's clock running
//   the result     a score, and what to watch again
//
// EVERY RULE IS THE SERVER'S. Whether it can be started, how many tries
// are left, when it opens again, when this try runs out, and what the
// score is. This page draws answers; it never works one out. The reason
// is the obvious one: a page that decides whether somebody may sit an
// exam is a page somebody can edit.
//
// THE RESULT NEVER CONTAINS AN ANSWER. Not the right option, not which
// question was missed, not even a question id. What comes back is a
// score and a list of LESSONS with a moment to watch from. A second try
// is a fresh draw from the bank, and a result that leaked the first
// try's questions would turn it into a corrected answer sheet.
//
// ANSWERS SAVE AS THEY ARE CHOSEN. Closing the tab does not end the
// try, and it does not stop the clock either; the same try carries on
// when it is opened again. "Saved" appears only after the first answer,
// because a page that says Saved before anybody has done anything is
// saying something untrue.

type Phase = "rules" | "sitting" | "result";

export default function AcademyExam() {
  const { slug = "" } = useParams();

  const [course, setCourse] = useState<MyCourse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>("rules");
  const [exam, setExam] = useState<ExamState | null>(null);

  const [sitting, setSitting] = useState<StartedExam | null>(null);
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [rewatch, setRewatch] = useState<ExamRewatch[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A clock that ticks once a second, only while it is needed, so the
  // countdown is live rather than whatever it said when the page loaded.
  const [now, setNow] = useState(() => Date.now());
  const ticking = phase === "sitting" || (exam && exam.state === "waiting");
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  const load = useCallback(() => {
    let alive = true;
    getMyCourse(slug).then((c) => {
      if (!alive) return;
      const got = c && c !== "missing" ? c : null;
      setCourse(got);
      setExam(got?.exam || null);
      setLoaded(true);
      // A try already running is picked up rather than started again.
      // Somebody who closed the tab comes back to the same questions
      // with the same clock, which is the whole point of the deadline
      // living on the server.
      if (got?.exam?.state === "in_progress") setPhase("rules");
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(load, [load]);

  async function begin() {
    if (!exam) return;
    setError("");
    setBusy(true);
    const got = await startExam(exam.exam_id);
    setBusy(false);
    if (!got) {
      setError("The exam could not be started just now. Please try again.");
      return;
    }
    setSitting(got);
    setChosen({});
    setSaved(false);
    setPhase("sitting");
  }

  async function finish() {
    if (!sitting) return;
    setError("");
    setBusy(true);
    const { payload } = answerPayload(chosen);
    const got = await submitExam(sitting.attempt_id, payload);
    if (!got) {
      setBusy(false);
      setError("Your answers could not be sent. Please try again.");
      return;
    }
    const watch = got.passed ? [] : await examRewatch(sitting.attempt_id);
    setBusy(false);
    setResult(got);
    setRewatch(watch);
    setPhase("result");
    load();
  }

  const title = course?.title || "Course exam";
  const crumbs = (
    <Breadcrumb
      items={[
        { label: title, to: routes.academyLearn.replace(":slug", slug) },
        { label: "Course exam" },
      ]}
    />
  );

  if (!loaded) {
    return (
      <AcadStage width="wide">
        <Seo title="Course exam | Data-Lead Academy" noindex />
        <div className="acad-skeleton acad-exam__waiting" aria-hidden="true" />
      </AcadStage>
    );
  }

  if (!course || !exam) {
    return (
      <AcadStage width="wide">
        <Seo title="Course exam | Data-Lead Academy" noindex />
        {crumbs}
        <h1 className="acad-h1">No exam yet</h1>
        <p className="acad-sub">
          This course does not have its exam yet. Carry on with the lessons and
          it will be here when it is ready.
        </p>
        <p>
          <Link className="acad-link" to={routes.academyLearn.replace(":slug", slug)}>
            Back to the course
          </Link>
        </p>
      </AcadStage>
    );
  }

  // What the server says about the exam right now, turned into words.
  // Worked out before the three phases below rather than inside the
  // last one, because the RESULT phase needs it too: it asks whether a
  // try remains before offering Try again. finish() calls load() after
  // a submit, so by the time this matters the status is the fresh one.
  const view = examView(exam, now);

  // ------------------------------------------------------- the result
  if (phase === "result" && result) {
    return (
      <AcadStage width="wide" focus>
        <Seo title={`Your result | ${title}`} noindex />
        {crumbs}
        <div className={`acad-exam__verdict${result.passed ? " is-pass" : ""}`}>
          <span className="acad-exam__mark" aria-hidden="true">
            {result.passed ? <SealIcon /> : <WarnIcon />}
          </span>
          <div>
            <h1 className="acad-h1">
              {result.passed ? "You passed" : "Not this time"}
            </h1>
            <p className="acad-sub">
              {Math.round(result.percent)} percent, and {exam.pass_mark} percent
              was the mark.
            </p>
            {result.certificate_message ? (
              <p className="acad-msg acad-msg--ok">
                <TickIcon />
                <span>{result.certificate_message}</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* WHAT TO WATCH AGAIN, never what the answer was. Each row is a
            lesson and a moment in it, and opening one takes you to that
            second with a way back here. */}
        {!result.passed && rewatch.length > 0 ? (
          <section className="acad-exam__again">
            <h2 className="acad-h3">Watch these again</h2>
            <p className="acad-sub">
              The parts of the course the questions you missed came from.
            </p>
            <ul>
              {rewatch.map((r) => (
                <li key={`${r.lesson_id}-${r.chapter_start}`}>
                  <div>
                    <b>{r.lesson_title}</b>
                    {r.chapter_title ? <small>{r.chapter_title}</small> : null}
                  </div>
                  <Link
                    className="acad-btn acad-btn--ghost acad-btn--auto"
                    to={`${routes.academyLesson
                      .replace(":slug", slug)
                      .replace(":lessonId", r.lesson_id)}?at=${r.chapter_start}&back=exam`}
                  >
                    Watch from {asClock(r.chapter_start)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* TRY AGAIN, while there is a try to spend. After the first of
            two fails the learner still has one, and a result page whose
            only way on is "Back to the course" hides that from them: it
            reads as the end of the matter, and the second try is left
            unused by somebody who would have taken it.

            It goes back to the rules rather than straight into the
            questions. The rules page already says "Start my last try",
            and a second try begun by accident is a try spent.

            After the SECOND fail the server's state is "waiting" rather
            than "open", so examView says no and this is not drawn. That
            is on purpose: a Try again button that will not work for 24
            hours is worse than no button. */}
        <p className="acad-exam__after">
          {!result.passed && view.showTryAgain ? (
            <button
              type="button"
              className="acad-btn acad-btn--auto"
              onClick={() => {
                setResult(null);
                setRewatch([]);
                setSitting(null);
                setChosen({});
                setError("");
                setPhase("rules");
              }}
            >
              Try again
              <ArrowIcon />
            </button>
          ) : null}
          <Link className="acad-link" to={routes.academyLearn.replace(":slug", slug)}>
            Back to the course
          </Link>
        </p>
      </AcadStage>
    );
  }

  // ------------------------------------------------------ sitting it
  if (phase === "sitting" && sitting) {
    const { answered } = answerPayload(chosen);
    const left = countdown(sitting.deadline_at, now);

    return (
      <AcadStage width="wide" focus>
        <Seo title={`Course exam | ${title}`} noindex />
        <div className="acad-exam__bar">
          <span>
            <b>{answered}</b> of {sitting.questions.length} answered
          </span>
          {/* Saved appears only after the first answer. Before that
              there is nothing to have saved. */}
          {saved ? (
            <span className="acad-exam__saved">
              <TickIcon />
              Saved
            </span>
          ) : null}
          <span className="acad-exam__clock acad-mono">{left} left</span>
        </div>

        <ol className="acad-exam__qs">
          {sitting.questions.map((q, i) => (
            <li key={q.id}>
              <Question
                question={q}
                index={i}
                total={sitting.questions.length}
                value={chosen[q.id]}
                onChange={(picked) => {
                  setChosen((old) => ({
                    ...old,
                    [q.id]: Array.isArray(picked) ? picked : [picked],
                  }));
                  setSaved(true);
                }}
              />
            </li>
          ))}
        </ol>

        {error ? (
          <p className="acad-msg acad-msg--bad" role="alert">
            <WarnIcon />
            <span>{error}</span>
          </p>
        ) : null}

        <button
          type="button"
          className="acad-btn acad-exam__send"
          disabled={busy}
          onClick={finish}
        >
          {busy ? "Sending your answers" : "Submit answers"}
          {busy ? null : <ArrowIcon />}
        </button>
      </AcadStage>
    );
  }

  // --------------------------------------------------------- the rules
  return (
    <AcadStage width="wide">
      <Seo title={`Course exam | ${title}`} noindex />
      {crumbs}

      <div className="acad-exam__top">
        <div>
          <p className="acad-band__eyebrow">Course exam</p>
          <h1 className="acad-h1">{title}</h1>
          <p className="acad-sub">
            {exam.question_count} questions from across the whole course. Pass it
            and you earn your certificate in {title}. Answers save as you go.
          </p>

          <div className="acad-exam__facts">
            <div>
              <b>{exam.question_count}</b>
              <small>Questions</small>
            </div>
            <div>
              <b>{exam.pass_mark}%</b>
              <small>Pass mark</small>
            </div>
            <div>
              <b>{exam.minutes} min</b>
              <small>Time limit</small>
            </div>
            <div>
              <b>{exam.tries_allowed}</b>
              <small>Tries, then a day's wait</small>
            </div>
          </div>
        </div>

        <aside className="acad-exam__card" aria-label="Your tries">
          <p className="acad-band__eyebrow">Your tries</p>
          {/* One pip per try, filled for each one used. A number alone
              does not show how much is left at a glance. */}
          <p className="acad-exam__pips" aria-hidden="true">
            {Array.from({ length: exam.tries_allowed }, (_, i) => (
              <i key={i} className={i < exam.tries_used ? "is-used" : ""} />
            ))}
          </p>
          <p className="acad-exam__note">{view.note}</p>

          {view.button ? (
            <button
              type="button"
              className="acad-btn"
              disabled={view.button.disabled || busy}
              onClick={begin}
            >
              {busy ? "Opening the exam" : view.button.label}
              {view.button.disabled || busy ? null : <ArrowIcon />}
            </button>
          ) : null}

          {error ? (
            <p className="acad-msg acad-msg--bad" role="alert">
              <WarnIcon />
              <span>{error}</span>
            </p>
          ) : null}
        </aside>
      </div>

      <section className="acad-notes">
        <article>
          <h3>One exam per course</h3>
          <p>
            No quiz after every module: lesson checks keep you on track, and one
            exam at the end earns the certificate for that tool or skill.
          </p>
        </article>
        <article>
          <h3>Nothing lost</h3>
          <p>
            Answers save as you go. Close the tab and the same try carries on,
            with the same clock.
          </p>
        </article>
        <article>
          <h3>Never the answers</h3>
          <p>
            A result shows how you did and which lessons to watch again. The
            answers stay secret, so the certificate keeps its worth.
          </p>
        </article>
      </section>
    </AcadStage>
  );
}
