import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import Seo from "../../../components/Seo/component";
import { routes } from "../../routes";
import {
  fetchDashboard,
  getLearnerName,
  signOut,
  type SectionRow,
} from "../../../lib/learning";
import LiveBackground from "../LiveBackground";
import "../portal.css";

// The participant's own progress. Certified sections are closed and sit at the
// top, numbered in the order they were sat. Everything else is open, in no
// particular order, because the bootcamp does not fix one.

function firstName(full: string): string {
  const part = full.trim().split(/\s+/)[0] || "";
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export default function LearnerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const name = getLearnerName();

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await fetchDashboard();
      if (!live) return;
      setSignedIn(r.signedIn);
      setSections(r.sections);
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate(routes.learnerLogin, { replace: true });
  }

  if (loading) {
    return (
      <div className="lp">
        <LiveBackground />
        <main className="dash">
          <div className="wrap">
            <div className="lp__msg glass">
              <div className="lp__spin" />
              <p>Loading your progress</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <>
        <Seo title="Please sign in | Data-Lead Africa" noindex />
        <div className="lp">
          <LiveBackground />
          <main className="dash">
            <div className="wrap">
              <div className="panel glass brk">
                <p className="eyebrow">
                  <i />
                  Learning portal
                </p>
                <h1>Please sign in</h1>
                <p>
                  Your session has ended, or you have not signed in on this
                  device yet.
                </p>
                <Link
                  className="btn btn--go btn--wide"
                  to={routes.learnerLogin}
                >
                  Sign in <span className="arw">&#8594;</span>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  if (sections.length === 0) {
    return (
      <>
        <Seo title="My learning | Data-Lead Africa" noindex />
        <div className="lp">
          <LiveBackground />
          <main className="dash">
            <div className="wrap">
              <div className="panel glass brk">
                <p className="eyebrow">
                  <i />
                  Learning portal
                </p>
                <h1>Nothing here yet</h1>
                <p>
                  You are signed in, but no sections have been opened for you
                  yet. This usually means your enrolment is still being set up.
                  Please{" "}
                  <Link className="inl" to={routes.contactUs}>
                    contact the training team
                  </Link>{" "}
                  if you think that is wrong.
                </p>
                <button type="button" className="btn" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  const certified = sections.filter((t) => t.status === "certified");
  const open = sections.filter((t) => t.status !== "certified");
  const best = sections.reduce<number | null>(
    (n, t) => (t.best_percent === null ? n : Math.max(n ?? 0, t.best_percent)),
    null,
  );

  // Numbering follows the order assessments were actually sat, not any planned
  // order. A section with no attempt has no number at all.
  const satOrder = new Map<string, number>();
  sections
    .filter((t) => t.attempts_used > 0)
    .sort((a, b) => (a.week_number ?? 99) - (b.week_number ?? 99))
    .forEach((t, i) => satOrder.set(t.module_slug, i + 1));
  const totalSat = satOrder.size;

  function row(t: SectionRow) {
    const done = t.status === "certified";
    const tried = t.attempts_used > 0;
    const cls = done ? "done" : tried ? "retry" : "open";
    const no = satOrder.get(t.module_slug);
    const expandable = tried;
    const isOpen = openRow === t.module_slug;

    return (
      <li
        key={t.module_slug}
        className={`mod mod--${cls}${isOpen ? " isOpen" : ""}`}
      >
        <div className={`node${!tried ? " node--todo" : ""}`}>
          {done ? <>&#10003;</> : tried ? no : <i />}
        </div>

        <div
          className={`row glass${expandable ? " row--click" : ""}`}
          onClick={(e) => {
            if (!expandable) return;
            if ((e.target as HTMLElement).closest("a,button")) return;
            setOpenRow(isOpen ? null : t.module_slug);
          }}
        >
          <div className="modMain">
            <p className="modName">
              {t.module_title}
              {expandable ? <span className="caret"> &#9662;</span> : null}
            </p>
            <p className="modMeta">
              {done ? (
                <>
                  Assessment {no} of {totalSat} taken &middot; Certified{" "}
                  {t.cert_issued_at
                    ? new Date(t.cert_issued_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : ""}{" "}
                  &middot; <code>{t.cert_number}</code>
                </>
              ) : tried ? (
                <>
                  Assessment {no} of {totalSat} taken &middot; Best{" "}
                  {t.best_percent}% after {t.attempts_used}{" "}
                  {t.attempts_used === 1 ? "attempt" : "attempts"} &middot;{" "}
                  {t.pass_percent}% to pass
                </>
              ) : (
                <>Not taken yet &middot; {t.pass_percent}% to pass</>
              )}
            </p>
          </div>

          <div className="modRight">
            {done ? (
              <>
                <span className="tag tag--done">Passed</span>
                <span className="tag tag--shut">Closed</span>
              </>
            ) : tried ? (
              <span className="tag tag--retry">Try again</span>
            ) : (
              <span className="tag tag--open">Open</span>
            )}

            <span className="score">
              {t.best_percent === null ? <>&#8212;</> : `${t.best_percent}%`}
            </span>
            <span className="bar">
              <i
                className={`fill fill--${cls}`}
                style={{ width: `${Math.min(100, t.best_percent ?? 0)}%` }}
              />
            </span>

            {done ? (
              <Link
                className="btn"
                to={`/certificate/${encodeURIComponent(t.cert_number || "")}`}
              >
                View certificate
              </Link>
            ) : (
              <Link
                className="btn btn--go"
                to={`/my-learning/${t.module_slug}`}
              >
                {tried ? "Try again" : "Start"}{" "}
                <span className="arw">&#8594;</span>
              </Link>
            )}
          </div>
        </div>

        {expandable ? (
          <div className="hist">
            <p>
              {done
                ? `Passed at ${t.best_percent}% after ${t.attempts_used} ${
                    t.attempts_used === 1 ? "attempt" : "attempts"
                  }. This assessment is now closed, because your certificate has already been issued.`
                : `You are ${Math.max(
                    0,
                    Math.ceil(t.pass_percent - (t.best_percent ?? 0)),
                  )} points short. Take it again whenever you are ready, as many times as you need. Only your best attempt is recorded, so a lower score later never replaces a higher one.`}
            </p>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <>
      <Seo
        title="My learning | Data-Lead Africa"
        description="Your section assessments and certificates."
        noindex
      />
      <div className="lp">
        <LiveBackground />
        <main className="dash">
          <div className="wrap">
            <header className="top">
              <div>
                <p className="eyebrow">
                  <i />
                  Learning portal
                </p>
                <h1 className="h1">
                  Welcome back, <span>{firstName(name) || "there"}</span>
                </h1>
                <p className="sub">
                  {sections.length} sections, each separately certified.
                </p>
              </div>
              <div className="tally">
                <div className="tile glass">
                  <b>{certified.length}</b>
                  <small>Certified</small>
                  <span className="tile__spark" />
                </div>
                <div className="tile glass">
                  <b>{open.length}</b>
                  <small>Still open</small>
                </div>
                <div className="tile glass tile--hi">
                  <b>{best === null ? "\u2014" : `${best}%`}</b>
                  <small>Best score</small>
                </div>
              </div>
            </header>

            {open.length > 0 ? (
              <div className="next glass brk">
                <span className="next__accent" />
                <div>
                  <p className="next__lbl">Ready when you are</p>
                  <p className="next__nm">
                    {open.length}{" "}
                    {open.length === 1 ? "assessment is" : "assessments are"}{" "}
                    open to you
                  </p>
                  <p className="next__meta">
                    Every assessment stays open until you pass it. Take it as
                    many times as you need. Reach <b>70%</b> and your
                    certificate is issued straight away, and that assessment
                    then closes.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="trackHead">
              <h2 className="h2">Your sections</h2>
              <p className="legend">
                <span>
                  <i className="lg-shut" />
                  Certified
                </span>
                <span>
                  <i className="lg-retry" />
                  Try again
                </span>
                <span>
                  <i className="lg-open" />
                  Open
                </span>
              </p>
            </div>

            <ol className="track">
              {certified.length > 0 ? (
                <>
                  <li className="grp grp--first">
                    <h3>Certified</h3>
                    <span>
                      {certified.length} of {sections.length} &middot; numbered
                      in the order you sat them
                    </span>
                  </li>
                  {certified.map(row)}
                </>
              ) : null}

              {open.length > 0 ? (
                <>
                  <li
                    className={`grp${certified.length === 0 ? " grp--first" : ""}`}
                  >
                    <h3>Open to you</h3>
                    <span>
                      {open.length}{" "}
                      {open.length === 1 ? "assessment" : "assessments"}
                      {totalSat > 0
                        ? ` \u00b7 ${totalSat} of ${sections.length} taken so far`
                        : ""}
                    </span>
                  </li>
                  {open.map(row)}
                </>
              ) : null}
            </ol>

            <div className="strips">
              <div className="strip glass">
                <h3>Something wrong?</h3>
                <p>
                  If a section is missing, a score looks incorrect, or your name
                  is spelled wrongly on a certificate, tell us before you share
                  it.{" "}
                  <Link to={routes.contactUs}>Contact the training team</Link>.
                </p>
              </div>
              <div className="strip glass">
                <h3>Signed in on a shared computer?</h3>
                <p>
                  Sign out when you are done, so nobody else can see your
                  progress or sit an assessment as you.
                </p>
                <button type="button" className="btn" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
