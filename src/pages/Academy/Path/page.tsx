import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import "./page.css";
import AcadStage from "../ui/AcadStage";
import Breadcrumb from "../ui/Breadcrumb";
import CourseCover from "../ui/CourseCover";
import Seo from "../../../components/Seo/component";
import { ArrowIcon, LockIcon, SealIcon, TickIcon } from "../ui/Icons";
import { ACADEMY_PUBLIC } from "../../../lib/site";
import { asLength, getMyPath, type MyPath } from "../../../lib/catalogue";
import { routes } from "../../routes";

// One learning path: its courses in order, what you have done to each,
// and the exam at the end.
//
// THE IDEA THE PAGE HAS TO CARRY is that a course is ONE course
// wherever it appears. Somebody who finished Excel for data
// visualisation inside the Business Analytics path has finished it
// here too, and the row says so in words: "Already taken in the
// Business Analytics path, so it counts here." Without that line a
// ticked course they have never opened looks like a mistake, and the
// first thing they would do is open it to check.
//
// EVERYTHING ON IT COMES FROM lms_my_path, in one call. Nothing is
// counted in the browser: the total time, the number done and the
// exam's state are all worked out in the database, where they can be
// worked out once and the same way for every page that needs them.
//
// A SIGNED OUT VISITOR SEES THE PATH AND NOTHING TICKED. The page is
// not behind a sign in, because the path is one of the things somebody
// is deciding about before they have an account.

export default function AcademyPath() {
  const { slug = "" } = useParams();
  const [path, setPath] = useState<MyPath | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    getMyPath(slug).then((p) => {
      if (!alive) return;
      setPath(p);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (!loaded) {
    return (
      <AcadStage width="wide">
        <Seo title="Learning path | Data-Lead Academy" noindex />
        <div className="acad-skeleton acad-path__waiting" aria-hidden="true" />
      </AcadStage>
    );
  }

  if (!path) {
    return (
      <AcadStage width="wide">
        <Seo title="Path not found | Data-Lead Academy" noindex />
        <h1 className="acad-h1">Path not found</h1>
        <p className="acad-sub">
          This learning path is not available. The catalogue has every course
          that is.
        </p>
        <p>
          <Link className="acad-link" to={routes.academyCourses}>
            All courses
          </Link>
        </p>
      </AcadStage>
    );
  }

  const done = path.courses.filter((c) => c.certificate_number).length;
  const elsewhere = path.courses.filter((c) => c.certificate_number && c.also_in).length;
  const left = path.course_count - done;

  return (
    <AcadStage width="wide">
      <Seo
        title={`${path.name} path | Data-Lead Academy`}
        description={path.description || undefined}
        canonicalPath={routes.academyPath.replace(":slug", path.slug)}
        // THE LAUNCH SWITCH, and this page is the fourth public Academy
        // page, not the third. The landing page carries "noindex,
        // follow", and follow means a crawler is told to walk the links
        // on it. One of those links is the path banner, pointing here.
        // So a page here with no robots tag at all is a way into the
        // Academy that the switch does not cover, which is the whole
        // thing round 2 was for. It says the same as the landing page,
        // the catalogue and a course page, for the same reason: stay out
        // of the results, but pass the links on, so the day the switch
        // flips nothing has to be re-earned.
        noindex={!ACADEMY_PUBLIC}
        robots="noindex, follow"
      />

      <Breadcrumb
        items={[
          { label: "My learning", to: routes.academyMe },
          { label: `${path.name} path` },
        ]}
      />

      <div className="acad-path__top">
        <div className="acad-path__intro">
          <p className="acad-band__eyebrow">Learning path</p>
          <h1 className="acad-h1">{path.name}</h1>
          {path.description ? <p className="acad-sub">{path.description}</p> : null}

          <p className="acad-path__stats">
            <span>
              <b>
                {done} of {path.course_count}
              </b>{" "}
              courses done
            </span>
            {/* Only when it is true. A nought here would be a sentence
                about something that has not happened. */}
            {elsewhere > 0 ? (
              <span>
                <b>{elsewhere}</b> counted from another path
              </span>
            ) : null}
            <span>
              <b>{asLength(path.total_seconds)}</b> of video in all
            </span>
          </p>
        </div>

        {/* The certificate at the end, drawn rather than described. It
            is the thing the path is for, and a picture of it says more
            than a sentence about it. The number is an example and says
            so. */}
        <aside className="acad-path__cert" aria-label="The certificate at the end">
          <p className="acad-path__certlabel">Professional certificate</p>
          <b>{path.certificate_name}</b>
          <small>
            Data-Lead Africa · {path.course_count} course
            {path.course_count === 1 ? "" : "s"} and a final exam
          </small>
          <span className="acad-path__certno acad-example">DLA-2026-PDA-…</span>
        </aside>
      </div>

      <ol className="acad-path__list">
        {path.courses.map((c) => (
          <li
            key={c.slug}
            className={`acad-path__row${c.certificate_number ? " is-done" : ""}`}
          >
            <span className="acad-path__no">
              {String(c.position).padStart(2, "0")}
            </span>

            <CourseCover
              course={{
                slug: c.slug,
                title: c.title,
                tool: c.tool,
                area: c.area,
                cover_code: c.cover_code,
              }}
              variant="square"
              badge={false}
            />

            <div className="acad-path__words">
              {c.area ? <span className="acad-path__area">{c.area}</span> : null}
              <b>{c.title}</b>
              <small>
                {c.lesson_count} lesson{c.lesson_count === 1 ? "" : "s"} ·{" "}
                {asLength(c.total_seconds)} · course exam
              </small>
              {c.certificate_number && c.also_in ? (
                <span className="acad-path__also">
                  <TickIcon />
                  Already taken in the {c.also_in} path, so it counts here
                </span>
              ) : null}
            </div>

            <div className="acad-path__state">
              {c.certificate_number ? (
                <span
                  className={`acad-path__tag${c.also_in ? " is-other" : ""}`}
                >
                  {c.also_in ? "Already taken" : "Certified"}
                </span>
              ) : c.percent > 0 ? (
                <Link
                  className="acad-btn acad-btn--auto"
                  to={routes.academyLearn.replace(":slug", c.slug)}
                >
                  Carry on · {Math.round(c.percent)}%
                </Link>
              ) : (
                <Link
                  className="acad-btn acad-btn--ghost acad-btn--auto"
                  to={routes.academyCourse.replace(":slug", c.slug)}
                >
                  See course
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* The exam at the end. It is shown even before it can be opened,
          because what it takes to open it is the shape of the whole
          path and somebody deciding whether to start should see it. */}
      <section className="acad-path__exam">
        <span className="acad-path__examicon" aria-hidden="true">
          {path.exam && path.exam.state === "passed" ? <SealIcon /> : <LockIcon />}
        </span>
        <div>
          <p className="acad-band__eyebrow">Final exam</p>
          <h2 className="acad-h3">The {path.name} exam</h2>
          <p>
            {path.exam && path.exam.question_count ? (
              <>
                {path.exam.question_count} questions across all{" "}
                {path.course_count} courses · {path.exam.minutes} minutes ·{" "}
                {path.exam.pass_mark} percent to pass · {path.exam.tries_allowed}{" "}
                tries, then a day's wait.{" "}
              </>
            ) : null}
            It opens when every course in the path has its certificate.
          </p>
        </div>

        {path.exam && path.exam.state === "open" ? (
          <Link
            className="acad-btn acad-btn--auto"
            to={routes.academyPathExam.replace(":slug", path.slug)}
          >
            Start the exam
            <ArrowIcon />
          </Link>
        ) : path.exam && path.exam.state === "passed" ? (
          <span className="acad-path__tag">Passed</span>
        ) : (
          <button type="button" className="acad-btn acad-btn--auto" disabled>
            {left > 0
              ? `Opens after ${left} more course${left === 1 ? "" : "s"}`
              : "Opens soon"}
          </button>
        )}
      </section>

      {/* ------------------------------------------- how certificates work */}
      <section className="acad-band">
        <div className="acad-band__head">
          <div>
            <p className="acad-band__eyebrow">Three kinds of proof</p>
            <h2 className="acad-h2">How certificates work</h2>
          </div>
        </div>
        <div className="acad-steps">
          <article className="acad-step">
            <p className="acad-band__eyebrow">Every lesson</p>
            <h3>Lesson check</h3>
            <p>
              A few questions after a lesson. Miss one and it takes you back to
              the exact moment in the video. Try as often as you like.
            </p>
          </article>
          <article className="acad-step">
            <p className="acad-band__eyebrow">Every course</p>
            <h3>Course exam</h3>
            <p>
              At the end of a course. Pass it and you get a certificate for that
              tool or skill.
            </p>
          </article>
          <article className="acad-step">
            <p className="acad-band__eyebrow">Every path</p>
            <h3>Path exam</h3>
            <p>
              At the end of a path, across all its courses. Pass it and you get
              the professional certificate.
            </p>
          </article>
        </div>
      </section>
    </AcadStage>
  );
}
