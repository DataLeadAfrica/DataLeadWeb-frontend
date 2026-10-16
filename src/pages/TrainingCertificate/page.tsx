import { useEffect, useMemo, useRef, useState } from "react";

import Seo from "../../components/Seo/component";
import { type Certificate, prettyDate } from "../../lib/certificates";
import { renderCertificate } from "../../lib/certificateRenderer";
import {
  deviceId,
  fetchConfig,
  newId,
  startTest,
  submitTest,
  type IssuedCertificate,
  type MarkedReply,
  type Question,
  type TrainingConfig,
} from "./api";
import { type TrainingSetup } from "./config";
import { downloadPdf, downloadPng } from "./download";
import "./page.css";

// Self-service certificate for a short training.
//
// A participant scans the QR code, types their name, confirms it, sits a
// short multiple choice test and, on a pass, downloads their certificate
// straight away. No email and no account: the name is the only thing asked.
//
// The certificate is drawn by the same renderer and the same artwork family
// as every other Data-Lead Africa certificate (src/lib/certificateRenderer).
// Marking, attempt limits and certificate numbers live in the training's
// Google Sheet, so the answer key never reaches the phone.

type Step =
  | "name"
  | "confirm"
  | "starting"
  | "test"
  | "review"
  | "marking"
  | "result"
  | "locked"
  | "closed";

type Paper = {
  questions: Question[];
  attemptNumber: number;
  attemptsLeft: number;
  maxAttempts: number;
  passMark: number;
  paperSig: string;
};

type Progress = {
  name: string;
  paper: Paper;
  answers: Record<string, string>;
  index: number;
  submissionId: string;
};

function cleanName(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

function needed(passMark: number, total: number) {
  return Math.ceil((passMark / 100) * total - 1e-9);
}

function todayIso() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toCertificate(c: IssuedCertificate, slug: string): Certificate {
  return {
    certificate_number: c.id,
    full_name: c.name,
    programme_title: c.courseLine,
    programme_slug: slug,
    module_title: null,
    module_slug: null,
    week_number: null,
    is_module: false,
    course_url: null,
    duration_text: null,
    completed_on: c.date,
    template_key: "training",
    subtitle: c.subLine,
  };
}

// The certificate faces are only fetched when something asks for them, so
// ask before drawing, otherwise the first draw uses a fallback face.
async function loadCertificateFonts() {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  try {
    await Promise.all([
      fonts.load('400 48px "Bebas Neue DLA"'),
      fonts.load('400 48px "Antonio DLA"'),
      fonts.load("400 32px Poppins"),
      fonts.load("500 32px Poppins"),
    ]);
  } catch {
    // carry on with whatever loaded
  }
}

function store<T>(key: string, value: T | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: the page still works, it just cannot resume
  }
}

function recall<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ page

export default function TrainingCertificate({ setup }: { setup: TrainingSetup }) {
  const fb = setup.fallback;
  const KEY_PROGRESS = `dla_tc_progress_${setup.slug}`;
  const KEY_CERT = `dla_tc_cert_${setup.slug}`;
  const configured = !setup.endpoint.startsWith("PASTE_");

  const [cfg, setCfg] = useState<TrainingConfig>({
    training: { title: fb.title, theme: fb.theme, dates: fb.dates },
    certificate: { courseLine: "", subLine: "" },
    passMark: fb.passMark,
    maxAttempts: fb.maxAttempts,
    questionCount: fb.questionCount,
    participants: [],
    open: true,
  });
  const [cfgFailed, setCfgFailed] = useState(false);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [banner, setBanner] = useState("");
  const [paper, setPaper] = useState<Paper | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [submissionId, setSubmissionId] = useState("");
  const [result, setResult] = useState<MarkedReply | null>(null);
  const [cert, setCert] = useState<IssuedCertificate | null>(null);
  const [locked, setLocked] = useState<{ used: number; max: number } | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [saving, setSaving] = useState<"" | "pdf" | "png">("");

  const previewRef = useRef<HTMLCanvasElement>(null);
  const certRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const device = useMemo(() => deviceId(), []);

  // Settings and the participant list from the Sheet. The name dropdown
  // cannot be shown without it, so a failure offers a retry.
  function loadConfig(stillHere: () => boolean = () => true) {
    setCfgFailed(false);
    fetchConfig(setup.endpoint).then((r) => {
      if (!stillHere()) return;
      if (!r.ok) {
        setCfgFailed(true);
        return;
      }
      setCfg({
        training: r.training,
        certificate: r.certificate,
        passMark: r.passMark,
        maxAttempts: r.maxAttempts,
        questionCount: r.questionCount,
        participants: r.participants || [],
        open: r.open,
      });
      setCfgLoaded(true);
    });
  }

  // Settings from the Sheet, and anything left on this phone from before.
  useEffect(() => {
    const savedCert = recall<IssuedCertificate>(KEY_CERT);
    const savedProgress = recall<Progress>(KEY_PROGRESS);
    if (savedCert) {
      setCert(savedCert);
      setName(savedCert.name);
      setStep("result");
    } else if (savedProgress && savedProgress.paper && savedProgress.paper.paperSig) {
      setName(savedProgress.name);
      setPaper(savedProgress.paper);
      setAnswers(savedProgress.answers || {});
      setIndex(savedProgress.index || 0);
      setSubmissionId(savedProgress.submissionId);
      setStep("test");
    }
    if (!configured) return;
    let live = true;
    loadConfig(() => live);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The site's floating WhatsApp button sits over the answer options and the
  // buttons on a phone, so it is hidden while this page is open.
  useEffect(() => {
    document.body.classList.add("tc-open");
    return () => document.body.classList.remove("tc-open");
  }, []);

  // Keep an unfinished test on the phone, so a reload does not lose answers.
  useEffect(() => {
    if ((step === "test" || step === "review") && paper) {
      store<Progress>(KEY_PROGRESS, { name, paper, answers, index, submissionId });
    }
  }, [step, paper, answers, index, submissionId, name, KEY_PROGRESS]);

  // A nudge before leaving half way through.
  useEffect(() => {
    if (step !== "test" && step !== "review") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);

  // Each new screen starts at the top.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
    window.scrollTo(0, 0);
  }, [step, index]);

  // The preview on the confirmation screen.
  useEffect(() => {
    if (step !== "confirm" || !previewRef.current) return;
    const canvas = previewRef.current;
    loadCertificateFonts().then(() =>
      renderCertificate(
        canvas,
        toCertificate(
          {
            id: "to be issued when you pass",
            name: cleanName(name),
            date: todayIso(),
            score: 0,
            total: 0,
            percent: 0,
            courseLine: cfg.certificate.courseLine,
            subLine: cfg.certificate.subLine,
          },
          setup.slug,
        ),
      ).catch(() => undefined),
    );
  }, [step, name, cfg.certificate, setup.slug]);

  // The real certificate. The wording always comes from the Sheet as it is
  // now, so a correction made in the Settings tab reaches people who passed
  // earlier as soon as they open the page again.
  useEffect(() => {
    if (step !== "result" || !cert || !certRef.current) return;
    const canvas = certRef.current;
    const wording = cfgLoaded
      ? { courseLine: cfg.certificate.courseLine, subLine: cfg.certificate.subLine }
      : { courseLine: cert.courseLine, subLine: cert.subLine };
    setDrawn(false);
    loadCertificateFonts()
      .then(() => renderCertificate(canvas, toCertificate({ ...cert, ...wording }, setup.slug)))
      .then(() => setDrawn(true))
      .catch(() => setBanner("The certificate could not be drawn. Please refresh the page."));
  }, [step, cert, setup.slug, cfgLoaded, cfg.certificate]);

  // ---------------------------------------------------------------- actions

  function onContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!name) {
      setNameError("Please select your name from the list.");
      return;
    }
    setNameError("");
    setBanner("");
    setStep("confirm");
  }

  async function begin() {
    if (!configured) {
      setBanner("This page is not connected to its Google Sheet yet.");
      return;
    }
    setBanner("");
    setStep("starting");
    const r = await startTest(setup.endpoint, cleanName(name), device);
    if (!r.ok) {
      if (r.error === "not_listed") {
        setNameError(r.message);
        setStep("name");
        loadConfig();
        return;
      }
      setBanner(r.message);
      setStep(paper ? "result" : "confirm");
      return;
    }
    if (r.state === "certified") {
      setCert(r.certificate);
      store(KEY_CERT, r.certificate);
      setResult(null);
      setStep("result");
      return;
    }
    if (r.state === "locked") {
      setLocked({ used: r.attemptsUsed, max: r.maxAttempts });
      setStep("locked");
      return;
    }
    if (r.state === "closed") {
      setStep("closed");
      return;
    }
    if (r.name) setName(r.name);
    setPaper({
      questions: r.questions,
      attemptNumber: r.attemptNumber,
      attemptsLeft: r.attemptsLeft,
      maxAttempts: r.maxAttempts,
      passMark: r.passMark,
      paperSig: r.paperSig,
    });
    setAnswers({});
    setIndex(0);
    setSubmissionId(newId());
    setResult(null);
    setStep("test");
  }

  async function submit() {
    if (!paper) return;
    setBanner("");
    setStep("marking");
    const r = await submitTest(
      setup.endpoint,
      cleanName(name),
      device,
      submissionId,
      answers,
      paper.questions.map((qq) => qq.id),
      paper.paperSig,
    );
    if (!r.ok) {
      if (r.error === "bad_paper") {
        store(KEY_PROGRESS, null);
        setPaper(null);
        setBanner(r.message);
        setStep("confirm");
        return;
      }
      setBanner(r.message + " Your answers are still here.");
      setStep("review");
      return;
    }
    store(KEY_PROGRESS, null);
    if (r.state === "certified") {
      setCert(r.certificate);
      store(KEY_CERT, r.certificate);
      setStep("result");
      return;
    }
    if (r.state === "locked") {
      setLocked({ used: r.attemptsUsed, max: r.maxAttempts });
      setStep("locked");
      return;
    }
    if (r.state === "closed") {
      setStep("closed");
      return;
    }
    setResult(r);
    if (r.certificate) {
      setCert(r.certificate);
      store(KEY_CERT, r.certificate);
    }
    setStep("result");
  }

  function startOver() {
    store(KEY_CERT, null);
    store(KEY_PROGRESS, null);
    setCert(null);
    setResult(null);
    setPaper(null);
    setName("");
    setStep("name");
  }

  async function save(kind: "pdf" | "png") {
    if (!certRef.current || !cert || !drawn) return;
    setSaving(kind);
    const base = `Data-Lead-Africa-Certificate-${cert.id}`;
    try {
      if (kind === "pdf") {
        await downloadPdf(certRef.current, base, `Data-Lead Africa Certificate ${cert.id}`);
      } else {
        await downloadPng(certRef.current, base);
      }
    } catch {
      setBanner("The download did not start. Please try again.");
    }
    setSaving("");
  }

  // ---------------------------------------------------------------- pieces

  const total = paper?.questions.length || cfg.questionCount;
  const answered = paper ? paper.questions.filter((q) => answers[q.id]).length : 0;
  const q = paper?.questions[index];
  const firstName = cleanName(name).split(" ")[0] || "";
  const firstBlank = paper ? paper.questions.findIndex((qq) => !answers[qq.id]) : -1;

  // ---------------------------------------------------------------- render

  return (
    <div className="tc" ref={topRef}>
      <Seo
        title={`Certificate test | ${cfg.training.title} | Data-Lead Africa`}
        description="Take the end of training test and download your Data-Lead Africa certificate."
        noindex
      />
      <main className="tc__card">
        {banner && (
          <p className="tc-banner" role="alert">
            {banner}
          </p>
        )}

        {step === "name" && (
          <section>
            <p className="tc-kicker">{cfg.training.dates}</p>
            <h1 className="tc-h1">{cfg.training.title}</h1>
            <p className="tc-text">
              Select your name, then take a short test of {cfg.questionCount} questions.
            </p>
            <p className="tc-text">
              Score {cfg.passMark}% or more to download your certificate.
              {cfg.maxAttempts
                ? ` You have ${cfg.maxAttempts} attempts.`
                : " You can retake the test as often as you need."}
            </p>

            <form className="tc-form" onSubmit={onContinue} noValidate>
              <label className="tc-label" htmlFor="tc-name">
                Your name
              </label>
              {cfgLoaded ? (
                <div className={"tc-select" + (nameError ? " is-bad" : "")}>
                  <select
                    id="tc-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError("");
                    }}
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={nameError ? "tc-name-err" : undefined}
                  >
                    <option value="">Select your name</option>
                    {cfg.participants.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              ) : cfgFailed || !configured ? (
                <div className="tc-loadfail">
                  <p>The list of names could not be loaded. Check your internet connection.</p>
                  {configured && (
                    <button type="button" className="tc-btn tc-btn--quiet" onClick={() => loadConfig()}>
                      Try again
                    </button>
                  )}
                </div>
              ) : (
                <div className="tc-select is-loading" aria-live="polite">
                  Loading names
                </div>
              )}
              {nameError && (
                <p className="tc-err" id="tc-name-err">
                  {nameError}
                </p>
              )}
              {cfgLoaded && cfg.participants.length === 0 && (
                <p className="tc-err">The list of names is empty. Please speak to the facilitator.</p>
              )}
              <p className="tc-hint">Name missing or misspelt? Tell the facilitator.</p>
              <button className="tc-btn" type="submit" disabled={!cfgLoaded}>
                Continue
              </button>
            </form>
          </section>
        )}

        {step === "confirm" && (
          <section>
            <h1 className="tc-h1">This is how your name will appear. Confirm?</h1>
            <p className="tc-name">{cleanName(name)}</p>
            <div className="tc-frame">
              <canvas ref={previewRef} className="tc-canvas" aria-label="Preview of your certificate" />
            </div>
            <div className="tc-actions">
              <button className="tc-btn" onClick={begin}>
                Yes, start the test
              </button>
              <button className="tc-btn tc-btn--quiet" onClick={() => setStep("name")}>
                Select a different name
              </button>
            </div>
          </section>
        )}

        {(step === "starting" || step === "marking") && (
          <section className="tc-wait" aria-live="polite">
            <span className="tc-spinner" aria-hidden="true" />
            <p>{step === "starting" ? "Preparing your test" : "Marking your test"}</p>
          </section>
        )}

        {step === "test" && paper && q && (
          <section className="tc-test">
            <div className="tc-test__top">
              <span className="tc-test__count">
                Question {index + 1} of {total}
              </span>
              {paper.attemptNumber > 1 && (
                <span className="tc-muted">
                  Attempt {paper.attemptNumber}
                  {paper.maxAttempts ? ` of ${paper.maxAttempts}` : ""}
                </span>
              )}
            </div>
            <div
              className="tc-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={index + 1}
            >
              <span style={{ width: `${((index + 1) / total) * 100}%` }} />
            </div>

            <fieldset className="tc-q" key={q.id}>
              <legend className="tc-q__text">{q.text}</legend>
              <div className="tc-q__opts">
                {q.options.map((o) => {
                  const on = answers[q.id] === o.key;
                  return (
                    <label key={o.key} className={"tc-opt" + (on ? " is-on" : "")}>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={o.key}
                        checked={on}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                      />
                      <span className="tc-opt__text">{o.text}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="tc-pager">
              <button
                className="tc-btn tc-btn--quiet"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
              >
                Back
              </button>
              {index < total - 1 ? (
                <button className="tc-btn" onClick={() => setIndex((i) => i + 1)}>
                  Next
                </button>
              ) : (
                <button className="tc-btn" onClick={() => setStep("review")}>
                  Finish
                </button>
              )}
            </div>
          </section>
        )}

        {step === "review" && paper && (
          <section>
            <h1 className="tc-h1">Ready to submit?</h1>
            <p className="tc-text">
              You have answered {answered} of {total} questions.
              {answered < total &&
                ` ${total - answered} ${total - answered === 1 ? "is" : "are"} still blank and will score zero.`}
            </p>
            <div className="tc-actions">
              <button className="tc-btn" onClick={submit}>
                Submit my answers
              </button>
              <button
                className="tc-btn tc-btn--quiet"
                onClick={() => {
                  setIndex(firstBlank >= 0 ? firstBlank : total - 1);
                  setStep("test");
                }}
              >
                {firstBlank >= 0 ? "Go to the first blank question" : "Back to the questions"}
              </button>
            </div>
          </section>
        )}

        {step === "result" && (
          <section>
            {result && (
              <div className={"tc-score" + (result.passed ? " is-pass" : " is-fail")}>
                <p className="tc-muted">Your score</p>
                <p className="tc-score__big">
                  {result.score} / {result.total}
                  <span className="tc-score__pct">{result.percent}%</span>
                </p>
                <p className="tc-score__verdict">
                  {result.passed
                    ? `Well done, ${firstName}. You passed.`
                    : `Not yet. You need ${result.passMark}% (${needed(result.passMark, result.total)} of ${result.total}) to pass.`}
                </p>
              </div>
            )}

            {result && !result.passed && (
              <div className="tc-retake">
                {!result.maxAttempts || result.attemptsLeft > 0 ? (
                  <>
                    <p className="tc-text">
                      {result.maxAttempts
                        ? `You have ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "attempt" : "attempts"} left. `
                        : ""}
                      Your next test will have a new set of questions.
                    </p>
                    <button className="tc-btn" onClick={begin}>
                      Retake the test
                    </button>
                  </>
                ) : (
                  <p className="tc-text">
                    You have used all {result.maxAttempts} attempts. Please speak to the facilitator.
                  </p>
                )}
              </div>
            )}

            {cert && (
              <div className="tc-cert">
                {!result && <h1 className="tc-h1">Your certificate</h1>}
                <div className="tc-frame">
                  <canvas ref={certRef} className="tc-canvas" aria-label={`Certificate for ${cert.name}`} />
                  {!drawn && <div className="tc-cert__loading">Preparing your certificate</div>}
                </div>
                <p className="tc-muted tc-facts">
                  Certificate number <span className="tc-facts__id">{cert.id}</span>
                  <br />
                  Issued {prettyDate(cert.date)}
                </p>
                <div className="tc-actions tc-actions--pair">
                  <button className="tc-btn" onClick={() => save("pdf")} disabled={!drawn || saving !== ""}>
                    {saving === "pdf" ? "Preparing" : "Download PDF"}
                  </button>
                  <button
                    className="tc-btn tc-btn--quiet"
                    onClick={() => save("png")}
                    disabled={!drawn || saving !== ""}
                  >
                    {saving === "png" ? "Preparing" : "Download PNG"}
                  </button>
                </div>
                <p className="tc-hint">
                  Lost it? Come back to this page and select your name to download it again.
                </p>
                <button className="tc-link" onClick={startOver}>
                  Not {cert.name}? Select a different name
                </button>
              </div>
            )}
          </section>
        )}

        {step === "locked" && locked && (
          <section>
            <h1 className="tc-h1">No attempts left</h1>
            <p className="tc-text">
              {cleanName(name)} has used all {locked.max} attempts. Please speak to the facilitator.
            </p>
            <button className="tc-link" onClick={() => setStep("name")}>
              Go back
            </button>
          </section>
        )}

        {step === "closed" && (
          <section>
            <h1 className="tc-h1">The test is closed</h1>
            <p className="tc-text">
              New attempts are no longer accepted. If you already passed, select your name again to
              download your certificate.
            </p>
            <button className="tc-link" onClick={() => setStep("name")}>
              Go back
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
