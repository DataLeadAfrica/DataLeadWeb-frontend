import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import "./page.css";
import Seo from "../../../components/Seo/component";
import { routes } from "../../routes";
import {
  fetchProgress,
  verifySession,
  clearToken,
  getToken,
  logout,
  prettyDate,
  statusLabel,
  attemptsLeft,
  type ModuleProgress,
} from "../../../lib/learning";

type State = "loading" | "ready" | "signedout" | "empty";

export default function LearnerDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [modules, setModules] = useState<ModuleProgress[]>([]);
  const [openRow, setOpenRow] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!getToken()) {
        setState("signedout");
        return;
      }
      // Checked first, because an empty module list on its own cannot tell us
      // whether the session died or the person simply has nothing open yet.
      const live = await verifySession();
      if (cancelled) return;
      if (!live) {
        clearToken();
        setState("signedout");
        return;
      }
      const rows = await fetchProgress();
      if (cancelled) return;
      if (rows === null) {
        clearToken();
        setState("signedout");
        return;
      }
      setModules(rows);
      setState(rows.length ? "ready" : "empty");
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    await logout();
    navigate(routes.learnerLogin);
  }

  const certified = modules.filter((m) => m.status === "certified").length;
  const best = modules.reduce<number | null>(
    (acc, m) => (m.best_percent != null && (acc == null || m.best_percent > acc) ? m.best_percent : acc),
    null,
  );
  const nextUp = modules.find((m) => m.status === "open" || m.status === "retry");

  return (
    <main className="dash">
      <Seo
        title="My learning | Data-Lead Africa"
        description="Your progress, assessments and certificates."
        noindex
      />

      <div className="dash__wrap">
        {state === "loading" && <p className="dash__loading">Loading your progress...</p>}

        {state === "signedout" && (
          <div className="dash__panel">
            <h1 className="dash__h1">Please sign in</h1>
            <p className="dash__text">
              Your session has ended, or you have not signed in on this device yet.
            </p>
            <Link className="dash__btn dash__btn--go" to={routes.learnerLogin}>
              Sign in
            </Link>
          </div>
        )}

        {state === "empty" && (
          <div className="dash__panel">
            <h1 className="dash__h1">Nothing here yet</h1>
            <p className="dash__text">
              You are signed in, but no modules have been opened for you yet.
              This usually means your enrolment is still being set up. Please{" "}
              <Link to={routes.contactUs}>contact the training team</Link> if
              you think that is wrong.
            </p>
            <button type="button" className="dash__btn" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}

        {state === "ready" && (
          <>
            <header className="dash__top">
              <div>
                <p className="dash__eyebrow">Your learning portal</p>
                <h1 className="dash__h1">My progress</h1>
              </div>
              <div className="dash__tally">
                <div>
                  <span className="dash__tallyNum">{certified}</span>
                  <span className="dash__tallyLbl">Certified</span>
                </div>
                <div>
                  <span className="dash__tallyNum">{modules.length}</span>
                  <span className="dash__tallyLbl">Modules</span>
                </div>
                <div>
                  <span className="dash__tallyNum">
                    {best == null ? "\u2014" : `${Math.round(best)}%`}
                  </span>
                  <span className="dash__tallyLbl">Best score</span>
                </div>
              </div>
            </header>

            {nextUp && (
              <div className="dash__next">
                <p>
                  <strong>Next up:</strong> {nextUp.module_title}. You have{" "}
                  {attemptsLeft(nextUp)} of {nextUp.max_attempts} attempts
                  remaining, and need {nextUp.pass_percent}% to pass.
                </p>
                <Link
                  className="dash__btn dash__btn--go"
                  to={routes.learnerModule.replace(":slug", nextUp.module_slug)}
                >
                  {nextUp.status === "retry" ? "Attempt again" : "Start"}
                </Link>
              </div>
            )}

            <div className="dash__trackHead">
              <h2 className="dash__h2">Your modules</h2>
              <p className="dash__legend">
                <span><i className="dash__dot dash__dot--done" />Certified</span>
                <span><i className="dash__dot dash__dot--wait" />Awaiting trainer</span>
                <span><i className="dash__dot dash__dot--open" />Open now</span>
              </p>
            </div>

            <ol className="dash__track">
              {modules.map((m, i) => {
                const cls =
                  m.status === "certified"
                    ? "done"
                    : m.status === "awaiting_trainer"
                      ? "wait"
                      : m.status === "retry"
                        ? "retry"
                        : "open";
                const expandable = m.best_percent != null || m.status === "awaiting_trainer";
                const isOpen = openRow === m.module_id;
                return (
                  <li
                    key={m.module_id}
                    className={`dash__mod dash__mod--${cls}${isOpen ? " isOpen" : ""}`}
                  >
                    <div className="dash__node">
                      {m.status === "certified" ? "\u2713" : i + 1}
                    </div>

                    <div
                      className={`dash__row${expandable ? " dash__row--click" : ""}`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("a,button")) return;
                        if (expandable) setOpenRow(isOpen ? null : m.module_id);
                      }}
                    >
                      <div className="dash__modMain">
                        <p className="dash__modName">
                          {m.module_title}
                          {expandable && <span className="dash__caret"> &#9662;</span>}
                        </p>
                        <p className="dash__modMeta">
                          {m.status === "certified" && m.cert_number
                            ? `Certified ${prettyDate(m.cert_issued_at)} \u00b7 ${m.cert_number}`
                            : `Pass mark ${m.pass_percent}% \u00b7 ${attemptsLeft(m)} of ${m.max_attempts} attempts left`}
                        </p>
                      </div>

                      <div className="dash__modRight">
                        <span className={`dash__tag dash__tag--${cls}`}>
                          {statusLabel(m)}
                        </span>
                        <span className="dash__score">
                          {m.best_percent == null ? "\u2014" : `${Math.round(m.best_percent)}%`}
                        </span>
                        <span className="dash__bar">
                          <i
                            className={`dash__barFill dash__barFill--${cls}`}
                            style={{ width: `${Math.min(100, m.best_percent ?? 0)}%` }}
                          />
                        </span>

                        {m.status === "certified" && m.cert_number ? (
                          <Link
                            className="dash__btn"
                            to={routes.shareCertificate.replace(":number", m.cert_number)}
                          >
                            View certificate
                          </Link>
                        ) : m.status === "awaiting_trainer" ? (
                          <button type="button" className="dash__btn" disabled>
                            Certificate pending
                          </button>
                        ) : attemptsLeft(m) === 0 ? (
                          <button type="button" className="dash__btn" disabled>
                            No attempts left
                          </button>
                        ) : (
                          <Link
                            className="dash__btn dash__btn--go"
                            to={routes.learnerModule.replace(":slug", m.module_slug)}
                          >
                            {m.status === "retry" ? "Attempt again" : "Start"}
                          </Link>
                        )}
                      </div>
                    </div>

                    {expandable && (
                      <div className="dash__hist">
                        {m.status === "awaiting_trainer" ? (
                          <p>
                            You have submitted this module. The parts that need a
                            person to read them are with your trainer. Your
                            certificate is released once they are marked and the
                            total reaches {m.pass_percent}%.
                          </p>
                        ) : (
                          <p>
                            Best score so far {Math.round(m.best_percent ?? 0)}%,
                            across {m.attempts_used}{" "}
                            {m.attempts_used === 1 ? "attempt" : "attempts"}. The
                            best attempt is the one that counts, so a lower score
                            later never replaces a higher one.
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="dash__strips">
              <div className="dash__strip">
                <h3>Something wrong?</h3>
                <p>
                  If a module is missing, a score looks incorrect, or your name
                  is spelled wrongly on a certificate, tell us before you share
                  it. <Link to={routes.contactUs}>Contact the training team</Link>.
                </p>
              </div>
              <div className="dash__strip">
                <h3>Signed in on a shared computer?</h3>
                <p>
                  Sign out when you are done, so nobody else can see your
                  progress or sit an assessment as you.
                </p>
                <button type="button" className="dash__btn" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
