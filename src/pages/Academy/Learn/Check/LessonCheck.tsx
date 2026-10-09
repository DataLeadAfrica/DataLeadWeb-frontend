import { useEffect, useRef, useState } from "react";

import "./LessonCheck.css";
import Question, { type Mark } from "../../ui/Question";
import { ArrowIcon, TickIcon, WarnIcon } from "../../ui/Icons";
import {
  getAttemptMarks,
  getQuizStatus,
  plural,
  startQuiz,
  submitQuiz,
  type QuizQuestion,
} from "../../../../lib/learn";

// The lesson check: a few questions after the video, on one card.
//
// IT IS LEARNING, NOT AN EXAM, and everything about it follows from
// that one sentence.
//
//   Try as often as you like. Database file 15 removed the try limit
//   entirely for a check. Before that the twentieth wrong answer locked
//   the lesson, and therefore the whole course, for ever.
//
//   Every question comes back marked with its explanation, right or
//   wrong. The old rule showed the explanation only when the answer was
//   right, which is the one time nobody needs it.
//
//   A wrong answer says how many were right and lets them go again at
//   once. No waiting, no scolding.
//
// All the marking is the server's. The right answer is never in the
// browser, so this component could not mark anything if it wanted to.

type Props = {
  lessonId: string;
  lessonTitle: string;
  onPassed: () => void;
  onWatchAgain: () => void;
};

export default function LessonCheck({
  lessonId,
  lessonTitle,
  onPassed,
  onWatchAgain,
}: Props) {
  const [quizId, setQuizId] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [verdict, setVerdict] = useState<{ ok: boolean; words: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState("");
  const [ready, setReady] = useState(false);
  const card = useRef<HTMLDivElement | null>(null);

  // The check belongs to the lesson, so its id is found through the
  // outline rather than passed in: the player does not need to know it.
  useEffect(() => {
    let alive = true;
    setReady(false);
    // lms_quiz_status takes a quiz id, and the only place the lesson's
    // check id appears is the outline. Rather than add another call,
    // the start itself does the finding: lms_start_quiz is given the
    // lesson's check through the course outline, which the player
    // already has. Here the id arrives as the lesson's check via the
    // dedicated lookup below.
    findCheck(lessonId).then((id) => {
      if (!alive) return;
      setQuizId(id);
      if (!id) {
        setTrouble("This lesson has no questions attached. Please tell your tutor.");
        setReady(true);
        return;
      }
      void begin(id, alive);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function begin(id: string, alive = true) {
    const status = await getQuizStatus(id);
    if (!alive) return;

    if (status && status.passed) {
      // Already passed it, which happens if they come back to a lesson
      // they half finished. Nothing to answer.
      setVerdict({ ok: true, words: "You have already passed this one." });
      setReady(true);
      return;
    }
    if (status && !status.can_start && status.reason) {
      setTrouble(status.reason);
      setReady(true);
      return;
    }

    const started = await startQuiz(id);
    if (!alive) return;
    if (!started) {
      setTrouble(
        "We could not open the questions just now. Your watching is saved. Please try again in a moment.",
      );
      setReady(true);
      return;
    }
    setAttemptId(started.attemptId);
    setQuestions(started.questions);
    setAnswers({});
    setMarks({});
    setVerdict(null);
    setReady(true);
  }

  async function check() {
    if (!attemptId || busy) return;
    setBusy(true);
    setTrouble("");

    const result = await submitQuiz(attemptId, answers);
    if (!result) {
      setBusy(false);
      setTrouble("We could not mark that just now. Nothing has been used up.");
      return;
    }

    // The marks come back separately, because what the server is
    // willing to say differs by kind. For a check it is everything.
    const got = await getAttemptMarks(attemptId);
    const byId: Record<string, Mark> = {};
    for (const m of got) {
      byId[m.question_id] = { was_right: m.was_right, explanation: m.explanation };
    }
    setMarks(byId);
    setBusy(false);

    if (result.passed) {
      setVerdict({ ok: true, words: result.feedback });
      return;
    }
    setVerdict({
      ok: false,
      words: `${result.correct_count} of ${result.question_count} correct. Read why under each one, change your answers and check again.`,
    });
  }

  /** Clears the marks so they can change an answer and go again. */
  async function again() {
    if (!quizId) return;
    setBusy(true);
    setMarks({});
    setVerdict(null);
    await begin(quizId);
    setBusy(false);
    if (card.current) card.current.scrollIntoView({ block: "start" });
  }

  const marked = Object.keys(marks).length > 0;
  const answered = questions.filter((q) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.length > 0 : Boolean(a);
  }).length;

  return (
    <section className="acad-check" ref={card} aria-label="Lesson check">
      <div className="acad-check__head">
        <span className="acad-check__kicker">Lesson check</span>
        <span className="acad-check__free acad-mono">
          {questions.length > 0 ? `${plural(questions.length, "question")} · ` : ""}
          try as often as you like
        </span>
      </div>
      <h2 className="acad-h2 acad-check__title">{lessonTitle}</h2>
      <p className="acad-check__lead">
        You watched the whole lesson. A few quick questions, then the next one
        opens. Getting one wrong costs nothing.
      </p>

      {!ready ? (
        <div className="acad-skeleton acad-check__waiting" aria-hidden="true" />
      ) : trouble ? (
        <p className="acad-note acad-note--bad">
          <WarnIcon />
          <span>{trouble}</span>
        </p>
      ) : questions.length === 0 && verdict && verdict.ok ? (
        <>
          <p className="acad-note acad-note--ok">
            <TickIcon />
            <span>{verdict.words}</span>
          </p>
          <div className="acad-actions">
            <button type="button" className="acad-btn" onClick={onPassed}>
              Carry on
              <ArrowIcon />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="acad-check__qs">
            {questions.map((q, i) => (
              <Question
                key={q.id}
                question={q}
                index={i}
                total={questions.length}
                value={answers[q.id]}
                mark={marks[q.id] || null}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              />
            ))}
          </div>

          {verdict ? (
            <p
              className={
                "acad-note " + (verdict.ok ? "acad-note--ok" : "acad-note--bad")
              }
              aria-live="polite"
            >
              {verdict.ok ? <TickIcon /> : <WarnIcon />}
              <span>{verdict.words}</span>
            </p>
          ) : null}

          <div className="acad-actions">
            {verdict && verdict.ok ? (
              <button type="button" className="acad-btn" onClick={onPassed}>
                Next lesson
                <ArrowIcon />
              </button>
            ) : marked ? (
              <button
                type="button"
                className="acad-btn"
                disabled={busy}
                onClick={() => void again()}
              >
                {busy ? "..." : "Try again"}
              </button>
            ) : (
              <button
                type="button"
                className="acad-btn"
                disabled={busy || answered < questions.length}
                onClick={() => void check()}
              >
                {busy ? "Checking..." : "Check my answers"}
              </button>
            )}
            <button
              type="button"
              className="acad-btn acad-btn--ghost"
              onClick={onWatchAgain}
            >
              Watch again
            </button>
          </div>

          {!marked && answered < questions.length ? (
            <p className="acad-check__todo acad-mono">
              {questions.length - answered} still to answer
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * The id of a lesson's check.
 *
 * lms_quizzes has a unique index on lesson_id, so a lesson has at most
 * one, and a learner may read published quizzes. No new database
 * function was needed for this, which is why there is not one.
 */
async function findCheck(lessonId: string): Promise<string | null> {
  const { certDb } = await import("../../../../lib/certificates");
  if (!certDb) return null;
  try {
    const { data, error } = await certDb
      .from("lms_quizzes")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("status", "published")
      .maybeSingle();
    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}
