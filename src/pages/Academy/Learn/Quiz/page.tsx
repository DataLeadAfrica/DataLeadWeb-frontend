import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import "../../academy.css";
import "../learn.css";
import "./page.css";
import Seo from "../../../../components/Seo/component";
import AcadStage from "../../ui/AcadStage";
import Breadcrumb from "../../ui/Breadcrumb";
import EmptyState from "../../ui/EmptyState";
import ProgressRing from "../../ui/ProgressRing";
import Question, { type Mark } from "../../ui/Question";
import { ArrowIcon, WarnIcon } from "../../ui/Icons";
import { routes } from "../../../routes";
import {
  getAttemptMarks,
  getMyCourse,
  getQuizStatus,
  plural,
  startQuiz,
  submitQuiz,
  whenItOpens,
  type MyCourse,
  type QuizQuestion,
  type QuizResult,
  type QuizStatus,
} from "../../../../lib/learn";

// /lms/learn/:slug/quiz/:quizId. The module quiz.
//
// FOUR STEPS: the intro, one question at a time, a review, the result.
//
// THE INTRO EXISTS BECAUSE A TRY IS SPENT. Questions, pass mark, timer
// and tries are all on screen before anybody presses anything. Nobody
// should discover the rules of an assessment by failing it.
//
// ANSWERS ARE SAVED AS THEY GO, under the try's id in this browser. A
// closed tab, a flat battery or a tap on the wrong thing all leave the
// same try to carry on from. The word "Saved" is shown only when that
// write actually succeeded: a private window rejects it, and claiming
// to have saved something that was not saved is worse than saying
// nothing. The server holds the try itself, so even a browser that
// stores nothing loses only the half typed answers, not the attempt.
//
// NOBODY IS TRAPPED. Three failed tries used to shut the quiz for ever,
// which put the certificate out of reach with no way back except hand
// written SQL. Database file 15 reopens it 24 hours after the last try
// with a fresh set of tries, and lms_quiz_status is what this page
// reads to say exactly when.

const KEY = "dla-quiz-";

type Step = "intro" | "run" | "review" | "result";

export default function AcademyQuiz() {
  const params = useParams();
  const navigate = useNavigate();
  const slug = params.slug || "";
  const quizId = params.quizId || "";

  const [course, setCourse] = useState<MyCourse | "missing" | null>(null);
  const [status, setStatus] = useState<QuizStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [step, setStep] = useState<Step>("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [at, setAt] = useState(0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState("");
  const [result, setResult] = useState<QuizResult | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const top = useRef<HTMLDivElement | null>(null);

  // ------------------------------------------------------------ loading
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    Promise.all([getMyCourse(slug), getQuizStatus(quizId)]).then(([c, s]) => {
      if (!alive) return;
      setCourse(c);
      setStatus(s);
      setLoaded(true);
      // Somebody who has already passed lands straight on the review,
      // which is the only thing left to do here.
      if (s && s.passed) {
        void showReview(s);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, quizId]);

  /** The passed state: the score and the full review with explanations. */
  async function showReview(s: QuizStatus) {
    setStep("result");
    setResult({
      kind: "quiz",
      correct_count: 0,
      question_count: s.question_count,
      score: 0,
      max_score: 0,
      percent: s.best_percent || 0,
      passed: true,
      pass_mark: s.pass_mark,
      feedback: "You have passed this quiz.",
    });
  }

  // -------------------------------------------------- saving as they go
  const remember = useCallback(
    (id: string, next: Record<string, string | string[]>) => {
      try {
        localStorage.setItem(KEY + id, JSON.stringify(next));
        setSaved(true);
      } catch {
        // A private window, or storage that is full. The try itself is
        // on the server, so nothing important is lost. The page simply
        // does not claim to have saved anything.
        setSaved(false);
      }
    },
    [],
  );

  function recall(id: string): Record<string, string | string[]> {
    try {
      const raw = localStorage.getItem(KEY + id);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function forget(id: string) {
    try {
      localStorage.removeItem(KEY + id);
    } catch {
      // nothing to do
    }
  }

  // ------------------------------------------------------------ starting
  async function start() {
    if (busy) return;
    setBusy(true);
    setTrouble("");
    const started = await startQuiz(quizId);
    setBusy(false);
    if (!started) {
      // lms_quiz_status already said why, in words. Asking it again
      // rather than guessing means the page says the true reason even
      // if something changed in the last minute.
      const fresh = await getQuizStatus(quizId);
      setStatus(fresh);
      setTrouble(
        (fresh && fresh.reason) ||
          "We could not open the quiz just now. No try has been used. Please try again in a moment.",
      );
      return;
    }
    setAttemptId(started.attemptId);
    setQuestions(started.questions);
    setAnswers(recall(started.attemptId));
    setAt(0);
    setStep("run");
    if (top.current) top.current.scrollIntoView({ block: "start" });
  }

  function answer(qid: string, value: string | string[]) {
    const next = { ...answers, [qid]: value };
    setAnswers(next);
    if (attemptId) remember(attemptId, next);
  }

  // ------------------------------------------------------------ marking
  async function send() {
    if (!attemptId || busy) return;
    setBusy(true);
    setTrouble("");
    const got = await submitQuiz(attemptId, answers);
    if (!got) {
      setBusy(false);
      setTrouble(
        "We could not send that just now. Your answers are still here. Please try again in a moment.",
      );
      return;
    }
    forget(attemptId);

    // What the server is willing to show depends on whether they
    // passed. A failed module quiz returns nothing at all, by design:
    // right or wrong per question across three tries is solvable by
    // elimination without watching a lesson.
    const got2 = await getAttemptMarks(attemptId);
    const byId: Record<string, Mark> = {};
    for (const m of got2) {
      byId[m.question_id] = { was_right: m.was_right, explanation: m.explanation };
    }
    setMarks(byId);

    const fresh = await getQuizStatus(quizId);
    setStatus(fresh);
    setResult(got);
    setStep("result");
    setBusy(false);
    if (top.current) top.current.scrollIntoView({ block: "start" });

    // Passing a module quiz can finish a course.
    if (got.passed) {
      const after = await getMyCourse(slug);
      if (after && after !== "missing") {
        const done =
          after.lesson_count > 0 &&
          after.lessons_done >= after.lesson_count &&
          after.quizzes_passed >= after.quiz_count;
        if (done) navigate(`/lms/learn/${encodeURIComponent(slug)}/complete`);
      }
    }
  }

  // ------------------------------------------------------------ states
  const backToCourse = routes.academyLearn.replace(":slug", encodeURIComponent(slug));

  if (!loaded) {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Module quiz | Data-Lead Academy" noindex />
        <div className="acad-skeleton acad-quiz__waiting" aria-hidden="true" />
      </AcadStage>
    );
  }

  if (course === null) {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Module quiz | Data-Lead Academy" noindex />
        <EmptyState label="Module quiz" title="We could not load this just now">
          Something went wrong on our side, not yours. No try has been used.
        </EmptyState>
        <p className="acad-actions">
          <button
            type="button"
            className="acad-btn acad-btn--auto"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </p>
      </AcadStage>
    );
  }

  if (course === "missing" || !status) {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Module quiz | Data-Lead Academy" noindex />
        <EmptyState label="Module quiz" title="This quiz is not open to you">
          Either it is not published yet, or your access to this course has
          ended. Nothing you have done has been lost.
        </EmptyState>
        <p className="acad-actions">
          <Link className="acad-btn acad-btn--auto" to={routes.academyMe}>
            Back to my learning
            <ArrowIcon />
          </Link>
        </p>
      </AcadStage>
    );
  }

  const moduleTitle =
    course.modules.find((m) => m.quiz && m.quiz.id === quizId)?.title || "this module";

  return (
    <AcadStage width="wide" focus>
      <Seo title={`${status.title} | Data-Lead Academy`} noindex />
      <div ref={top} />

      <Breadcrumb
        items={[
          { label: course.title, to: backToCourse },
          { label: status.title },
        ]}
      />

      {/* =================================================== the intro */}
      {step === "intro" ? (
        // WAITING CHANGES THE SHAPE OF THIS SCREEN, not just a word on
        // it. The four rule tiles say "3 tries, then a day's wait"
        // right beside a card saying the tries are gone, which reads as
        // a contradiction at a glance. They are dimmed, and on a phone
        // the waiting card comes first, because the thing somebody
        // needs to know is when they can come back, not what the rules
        // were.
        <div className={"acad-qintro" + (status.can_start ? "" : " acad-qintro--waiting")}>
          <div>
            <p className="acad-eyebrow">
              <i />
              Module quiz
            </p>
            <h1 className="acad-h1 acad-qintro__h1">{moduleTitle}</h1>
            <p className="acad-lead">
              {plural(status.question_count, "question")} on this module. Pass it
              and it counts towards your certificate. There is no timer, and
              your answers are saved as you go.
            </p>

            <div
              className="acad-rules"
              aria-hidden={status.can_start ? undefined : "true"}
            >
              <div className="acad-rule">
                <b>{status.question_count}</b>
                <small>Questions</small>
              </div>
              <div className="acad-rule">
                <b>{status.pass_mark}%</b>
                <small>Pass mark</small>
              </div>
              <div className="acad-rule">
                <b>None</b>
                <small>Time limit</small>
              </div>
              <div className="acad-rule">
                <b>
                  {status.can_start
                    ? status.tries_allowed
                    : `${status.tries_used}/${status.tries_allowed}`}
                </b>
                <small>
                  {status.can_start ? "Tries, then a day's wait" : "Tries used"}
                </small>
              </div>
            </div>
          </div>

          <aside className="acad-tries">
            <span className="acad-check__kicker">Your tries</span>
            <div
              className="acad-tries__pips"
              aria-label={`${status.tries_used} of ${status.tries_allowed} tries used`}
            >
              {Array.from({ length: status.tries_allowed }, (_, i) => (
                <i
                  key={i}
                  className={
                    i < status.tries_used
                      ? "is-used"
                      : i === status.tries_used
                        ? "is-now"
                        : ""
                  }
                />
              ))}
            </div>

            <p className="acad-tries__say">
              {status.can_start ? (
                status.tries_used === 0 ? (
                  <>
                    This is your first try. If you do not pass, you can try{" "}
                    {status.tries_allowed - 1} more{" "}
                    {status.tries_allowed - 1 === 1 ? "time" : "times"}. After
                    that the quiz opens again 24 hours later, with a fresh set
                    of tries.
                  </>
                ) : (
                  <>
                    {plural(status.tries_left || 0, "try", "tries")} left in this
                    round. When they are used the quiz opens again 24 hours
                    later, with a fresh set. Your certificate stays reachable.
                  </>
                )
              ) : (
                status.reason
              )}
            </p>

            {trouble ? (
              <p className="acad-note acad-note--bad">
                <WarnIcon />
                <span>{trouble}</span>
              </p>
            ) : null}

            {status.can_start ? (
              <button
                type="button"
                className="acad-btn acad-tries__go"
                disabled={busy}
                onClick={() => void start()}
              >
                {busy
                  ? "Opening..."
                  : status.open_attempt_id
                    ? "Carry on with your try"
                    : "Start the quiz"}
                {busy ? null : <ArrowIcon />}
              </button>
            ) : (
              <Link className="acad-btn acad-btn--ghost acad-tries__go" to={backToCourse}>
                Revise the lessons
              </Link>
            )}
          </aside>
        </div>
      ) : null}

      {/* ============================================ one at a time */}
      {step === "run" && questions.length > 0 ? (
        <div className="acad-quizbox">
          <div className="acad-quizbox__head">
            <span className="acad-check__kicker">
              Question {at + 1} of {questions.length}
            </span>
            {saved ? (
              <span className="acad-quizbox__saved acad-mono">Saved</span>
            ) : null}
          </div>

          {/* The numbered squares. Answered, current and untouched are
              three different looks, and pressing one jumps to it: on a
              ten question quiz, going back to number two should not
              mean pressing Back eight times. */}
          <div className="acad-qprog" role="tablist" aria-label="Questions">
            {questions.map((q, i) => {
              const a = answers[q.id];
              const done = Array.isArray(a) ? a.length > 0 : Boolean(a);
              return (
                <button
                  key={q.id}
                  type="button"
                  role="tab"
                  aria-selected={i === at}
                  aria-label={`Question ${i + 1}${done ? ", answered" : ""}`}
                  className={
                    (done ? "is-answered " : "") + (i === at ? "is-at" : "")
                  }
                  onClick={() => setAt(i)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <Question
            question={questions[at]}
            index={at}
            total={questions.length}
            value={answers[questions[at].id]}
            onChange={(v) => answer(questions[at].id, v)}
            bare
          />

          <div className="acad-actions">
            <button
              type="button"
              className="acad-btn acad-btn--ghost"
              disabled={at === 0}
              onClick={() => setAt((i) => Math.max(0, i - 1))}
            >
              Back
            </button>
            {at < questions.length - 1 ? (
              <button
                type="button"
                className="acad-btn"
                onClick={() => setAt((i) => Math.min(questions.length - 1, i + 1))}
              >
                Next
              </button>
            ) : (
              <button type="button" className="acad-btn" onClick={() => setStep("review")}>
                Review my answers
                <ArrowIcon />
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* =================================================== the review

          THE STEP THAT STOPS THE AVOIDABLE FAILURE. On a ten question
          quiz with three tries, sending it with question seven blank
          because of a mis-tap is a try gone for nothing. So nothing is
          sent until somebody has seen what they are sending, and a
          blank question is named and linked rather than merely
          counted. */}
      {step === "review" ? (
        <div className="acad-quizbox">
          <span className="acad-check__kicker">Before you send it</span>
          <h2 className="acad-h2 acad-quizbox__h2">
            {unanswered(questions, answers) === 0
              ? "All answered"
              : `${plural(unanswered(questions, answers), "question")} still blank`}
          </h2>

          {unanswered(questions, answers) > 0 ? (
            <p className="acad-note acad-note--warn">
              <WarnIcon />
              <span>
                A blank answer is marked wrong. You can go back to any of
                them, and this does not use up a try.
              </span>
            </p>
          ) : null}

          <ol className="acad-review">
            {questions.map((q, i) => {
              const a = answers[q.id];
              const done = Array.isArray(a) ? a.length > 0 : Boolean(a);
              const chosen = Array.isArray(a) ? a : a ? [a] : [];
              const labels = q.options
                .filter((o) => chosen.includes(o.id))
                .map((o) => o.label)
                .join(", ");
              return (
                <li key={q.id} className={done ? "" : "acad-review--blank"}>
                  <button
                    type="button"
                    onClick={() => {
                      setAt(i);
                      setStep("run");
                    }}
                  >
                    <span className="acad-review__n acad-mono">{i + 1}</span>
                    <span className="acad-review__mid">
                      <b>{q.prompt}</b>
                      <small>{done ? labels : "Not answered"}</small>
                    </span>
                    <span className="acad-review__go acad-mono">Change</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {trouble ? (
            <p className="acad-note acad-note--bad">
              <WarnIcon />
              <span>{trouble}</span>
            </p>
          ) : null}

          <div className="acad-actions">
            <button
              type="button"
              className="acad-btn acad-btn--ghost"
              onClick={() => setStep("run")}
            >
              Keep answering
            </button>
            <button
              type="button"
              className="acad-btn"
              disabled={busy}
              onClick={() => void send()}
            >
              {busy ? "Sending..." : "Send my answers"}
              {busy ? null : <ArrowIcon />}
            </button>
          </div>
        </div>
      ) : null}

      {/* =================================================== the result */}
      {step === "result" && result ? (
        <div className={"acad-result" + (result.passed ? "" : " acad-result--no")}>
          <ProgressRing
            percent={result.percent}
            size={132}
            tone={result.passed ? "signal" : "bad"}
            title={`${Math.round(result.percent)} percent`}
          />
          <p className="acad-result__verdict">
            {result.passed ? "Passed" : "Not this time"}
          </p>
          <h2 className="acad-h2">
            {result.passed
              ? `${Math.round(result.percent)}% on ${status.title}`
              : `${result.correct_count} of ${result.question_count} correct`}
          </h2>
          <p className="acad-result__say">
            {result.passed ? (
              <>
                That counts towards your certificate. The review is below, with
                an explanation for every question.
              </>
            ) : status.can_start ? (
              <>
                You need {result.pass_mark}%. You have{" "}
                {plural(status.tries_left || 0, "try", "tries")} left. The
                lessons in this module stay open, so you can watch any of them
                again first.
              </>
            ) : (
              <>
                You need {result.pass_mark}%. Your tries for now are used, and
                the quiz opens again at{" "}
                <b>{whenItOpens(status.next_opens_at)}</b> with a fresh set.
                Your certificate is still reachable.
              </>
            )}
          </p>

          {!result.passed && status.tries_allowed > 0 ? (
            <div
              className="acad-tries__pips acad-result__pips"
              aria-label={`${status.tries_used} of ${status.tries_allowed} tries used`}
            >
              {Array.from({ length: status.tries_allowed }, (_, i) => (
                <i key={i} className={i < status.tries_used ? "is-used" : ""} />
              ))}
            </div>
          ) : null}

          <div className="acad-actions acad-result__actions">
            {result.passed ? (
              <Link className="acad-btn" to={backToCourse}>
                Back to the course
                <ArrowIcon />
              </Link>
            ) : status.can_start ? (
              <button type="button" className="acad-btn" onClick={() => void start()}>
                Try again
              </button>
            ) : null}
            <Link className="acad-btn acad-btn--ghost" to={backToCourse}>
              Revise the lessons
            </Link>
          </div>

          {/* THE REVIEW, only once it has been passed. Before that the
              server returns nothing here, and this is simply absent. */}
          {result.passed && Object.keys(marks).length > 0 ? (
            <div className="acad-result__review">
              <h3 className="acad-h3">The answers, now you have passed</h3>
              {questions.map((q, i) => (
                <Question
                  key={q.id}
                  question={q}
                  index={i}
                  total={questions.length}
                  value={answers[q.id]}
                  mark={marks[q.id] || null}
                  onChange={() => undefined}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </AcadStage>
  );
}

function unanswered(
  questions: QuizQuestion[],
  answers: Record<string, string | string[]>,
): number {
  return questions.filter((q) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.length === 0 : !a;
  }).length;
}
