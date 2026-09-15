import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import Seo from "../../../components/Seo/component";
import { routes } from "../../routes";
import {
  getToken,
  startAttempt,
  submitAttempt,
  type Paper,
  type Result,
} from "../../../lib/learning";
import LiveBackground from "../LiveBackground";
import "../portal.css";

// Sit one section assessment.
//
// The paper is drawn by the database, which decides how many questions to
// serve and which ones. The answer key never reaches this page: marking
// happens in the database when the paper is submitted.
//
// Questions and options are shuffled on the way in, so a retake does not
// present the same paper in the same order.

// Several questions carry code in backticks, the way it was written in the
// question bank. Turn those into real <code> spans so `df.info()` reads as
// code rather than showing the backticks to the participant.
function withCode(text: string) {
  const bits = text.split(/(`[^`]+`)/g);
  return bits.map((bit, i) =>
    bit.startsWith("`") && bit.endsWith("`") && bit.length > 2 ? (
      <code key={i}>{bit.slice(1, -1)}</code>
    ) : (
      <span key={i}>{bit}</span>
    ),
  );
}

export default function LearnerAssessment() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [blocked, setBlocked] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (!getToken()) {
      navigate(routes.learnerLogin, { replace: true });
      return;
    }
    let live = true;
    (async () => {
      const r = await startAttempt(slug);
      if (!live) return;
      if (!r.ok || !r.paper) setBlocked(r.message);
      else setPaper(r.paper);
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [slug, navigate]);

  // Warn before closing the tab halfway through. Leaving does not lose the
  // attempt, because the database keeps it open, but it is worth a nudge.
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (submitted.current || !paper) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [paper]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v.trim() !== "").length,
    [answers],
  );

  function setAnswer(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  async function handleSubmit() {
    if (!paper) return;
    setError("");
    setBusy(true);
    const r = await submitAttempt(paper.attemptId, answers);
    setBusy(false);
    if (!r.ok || !r.result) {
      setError(r.message);
      return;
    }
    submitted.current = true;
    setResult(r.result);
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- states

  if (loading) {
    return (
      <div className="lp">
        <LiveBackground />
        <main className="asm">
          <div className="asm__wrap">
            <div className="lp__msg glass">
              <div className="lp__spin" />
              <p>Preparing your paper</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (blocked) {
    return (
      <>
        <Seo title="Assessment | Data-Lead Africa" noindex />
        <div className="lp">
          <LiveBackground />
          <main className="asm">
            <div className="asm__wrap">
              <div className="lp__msg glass brk">
                <h1>Not open</h1>
                <p>{blocked}</p>
                <Link className="btn btn--go btn--wide" to={routes.myLearning}>
                  Back to my learning <span className="arw">&#8594;</span>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  if (result) {
    const passed = result.passed;
    return (
      <>
        <Seo title="Your result | Data-Lead Africa" noindex />
        <div className="lp">
          <LiveBackground />
          <main className="asm">
            <div className="asm__wrap">
              <div className="res glass brk">
                <div
                  className={`res__badge res__badge--${passed ? "pass" : "fail"}`}
                >
                  {passed ? "\u2713" : "\u21bb"}
                </div>
                <h1 className="res__h1">
                  {passed ? "You passed" : "Not this time"}
                </h1>
                <p
                  className={`res__score res__score--${passed ? "pass" : "fail"}`}
                >
                  {result.percent}%
                </p>
                <p className="res__sub">
                  {result.score} of {result.max} marks &middot;{" "}
                  {result.passMark}% needed to pass
                </p>

                {passed && result.certNumber ? (
                  <>
                    <div className="res__cert">
                      <p className="res__certLbl">Certificate issued</p>
                      <p className="res__certNo">{result.certNumber}</p>
                    </div>
                    <p className="res__text">
                      Your certificate is live now and can be verified by anyone
                      with the number above. This assessment is closed, because
                      you have already earned it.
                    </p>
                    <div className="res__acts">
                      <Link
                        className="btn btn--go"
                        to={`/certificate/${encodeURIComponent(result.certNumber)}`}
                      >
                        View certificate <span className="arw">&#8594;</span>
                      </Link>
                      <Link className="btn" to={routes.myLearning}>
                        Back to my learning
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="res__text">
                      You needed {result.passMark}% and reached {result.percent}
                      %. Nothing is lost. Take it again whenever you are ready,
                      as many times as you need, and only your best attempt is
                      recorded.
                    </p>
                    <div className="res__acts">
                      <Link
                        className="btn btn--go"
                        to={`/my-learning/${slug}`}
                        onClick={() => window.location.reload()}
                      >
                        Try again <span className="arw">&#8594;</span>
                      </Link>
                      <Link className="btn" to={routes.myLearning}>
                        Back to my learning
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  if (!paper) return null;

  const pct = Math.round((answeredCount / paper.questions.length) * 100);

  return (
    <>
      <Seo title="Assessment | Data-Lead Africa" noindex />
      <div className="lp">
        <LiveBackground />
        <main className="asm">
          <div className="asm__bar">
            <div className="asm__barIn">
              <div>
                <p className="asm__name">Assessment in progress</p>
                <p className="asm__count">
                  {answeredCount} of {paper.questions.length} answered
                </p>
              </div>
              <span className="asm__track">
                <i className="asm__trackFill" style={{ width: `${pct}%` }} />
              </span>
            </div>
          </div>

          <div className="asm__wrap">
            <p className="asm__warn">
              Answer every question you can. An unanswered question scores
              nothing, and there is no penalty for a wrong answer, so it is
              always worth a try. Your paper is marked the moment you submit.
            </p>

            {paper.questions.map((q, i) => (
              <div className="asm__q glass" key={q.question_id}>
                <div className="asm__qTop">
                  <span className="asm__qNo">
                    Question {i + 1} of {paper.questions.length}
                  </span>
                  <span className="asm__qMarks">
                    {q.marks} {q.marks === 1 ? "mark" : "marks"}
                  </span>
                </div>

                <p className="asm__prompt">{withCode(q.prompt)}</p>

                {q.options ? (
                  <div className="asm__opts">
                    {q.options.map((o) => {
                      const picked = answers[q.question_id] === o.key;
                      return (
                        <label
                          className={`asm__opt${picked ? " isPicked" : ""}`}
                          key={o.key}
                        >
                          <input
                            type="radio"
                            name={q.question_id}
                            checked={picked}
                            onChange={() => setAnswer(q.question_id, o.key)}
                          />
                          <span className="asm__optText">
                            {withCode(o.text)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <input
                      className="asm__typed"
                      type="text"
                      value={answers[q.question_id] || ""}
                      placeholder="Type your answer"
                      onChange={(e) => setAnswer(q.question_id, e.target.value)}
                    />
                    <p className="asm__hint">
                      One word. Capital letters and spaces do not matter.
                    </p>
                  </>
                )}
              </div>
            ))}

            {error ? (
              <p className="asm__warn" style={{ color: "#b3261e" }}>
                {error}
              </p>
            ) : null}

            <div className="asm__foot glass brk">
              <p className="asm__footNote">
                You have answered <b>{answeredCount}</b> of{" "}
                <b>{paper.questions.length}</b>. Once you submit, this paper is
                marked and cannot be changed.
              </p>
              <button
                type="button"
                className="btn btn--go btn--wide"
                disabled={busy}
                onClick={handleSubmit}
              >
                {busy ? "Marking" : "Submit my answers"}{" "}
                <span className="arw">&#8594;</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
