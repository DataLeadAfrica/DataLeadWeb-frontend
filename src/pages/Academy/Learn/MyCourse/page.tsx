import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import "../../academy.css";
import "../learn.css";
import "./page.css";
import Seo from "../../../../components/Seo/component";
import AcadStage from "../../ui/AcadStage";
import Breadcrumb from "../../ui/Breadcrumb";
import ProgressRing from "../../ui/ProgressRing";
import EmptyState from "../../ui/EmptyState";
import { ArrowIcon, LockIcon, SealIcon, TickIcon } from "../../ui/Icons";
import { routes } from "../../../routes";
import {
  clock,
  getMyCourse,
  getMyWeek,
  lessonPath,
  plural,
  quizPath,
  whenItOpens,
  type LearnLesson,
  type LearnModule,
  type MyCourse,
  type WeekDay,
} from "../../../../lib/learn";

// /lms/learn/:slug. The course somebody is actually working through.
//
// ONE CALL BUILDS ALL OF IT. lms_my_course returns the ring, the resume
// target, every module with every lesson and its state, each module
// quiz's status and the certificate. Built from the tables directly
// this page would be a dozen round trips, and on a phone on a Nigerian
// mobile connection a dozen round trips is the difference between a
// page and a wait.
//
// It is also how this page and the player agree about the outline: they
// draw the same thing, so they read it from the same place.
//
// NOINDEX. Everything here is one learner's own record.

type Props = { slug?: string };

function lessonState(l: LearnLesson): "done" | "now" | "locked" {
  if (l.completed) return "done";
  return l.unlocked ? "now" : "locked";
}

export default function AcademyMyCourse({ slug: given }: Props) {
  const params = useParams();
  const slug = given || params.slug || "";

  const [course, setCourse] = useState<MyCourse | "missing" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [week, setWeek] = useState<WeekDay[]>([]);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    getMyCourse(slug).then((c) => {
      if (!alive) return;
      setCourse(c);
      setLoaded(true);
    });
    getMyWeek().then((w) => {
      if (alive) setWeek(w);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  // ------------------------------------------------------- not loaded
  if (!loaded) {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Your course | Data-Lead Academy" noindex />
        <div className="acad-grid3" aria-hidden="true">
          <div className="acad-skeleton" />
          <div className="acad-skeleton" />
          <div className="acad-skeleton" />
        </div>
      </AcadStage>
    );
  }

  // ----------------------------------------------- we could not ask
  // Not the same as "you do not have this course". Saying that to
  // somebody who paid, because the database did not answer, is the
  // worst wrong thing this page could say.
  if (course === null) {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Your course | Data-Lead Academy" noindex />
        <EmptyState label="Your course" title="We could not load this just now">
          Something went wrong on our side, not yours. Your progress is safe.
          Please try again in a moment.
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

  // ------------------------------------------- no access, said calmly
  // An entitlement that has ended part way through lands here. It is
  // not an error and it is not the learner's fault, so it does not read
  // like either.
  if (course === "missing") {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Your course | Data-Lead Academy" noindex />
        <EmptyState label="Your course" title="This course is not open to you">
          Either it is not published yet, or your access to it has ended. If you
          think that is wrong, send us a message and we will sort it out. Nothing
          you have done has been lost.
        </EmptyState>
        <p className="acad-actions">
          <Link className="acad-btn acad-btn--auto" to={routes.academyMe}>
            Back to my learning
            <ArrowIcon />
          </Link>
          <Link
            className="acad-btn acad-btn--ghost acad-btn--auto"
            to={routes.academyCourses}
          >
            Browse courses
          </Link>
        </p>
      </AcadStage>
    );
  }

  const done = course.lessons_done + course.quizzes_passed;
  const total = course.lesson_count + course.quiz_count;
  const finished = total > 0 && done >= total;
  const weekSeconds = week.reduce((sum, d) => sum + (d.seconds || 0), 0);

  return (
    <AcadStage width="wide" focus>
      <Seo
        title={`${course.title} | Data-Lead Academy`}
        description="Your progress through this course."
        noindex
      />

      <Breadcrumb
        items={[
          { label: "My learning", to: routes.academyMe },
          { label: course.title },
        ]}
      />

      {/* ------------------------------------------------------- the top */}
      <section className="acad-ctop">
        <ProgressRing
          percent={course.percent}
          title={`${course.percent} percent of this course is done`}
        />
        <div className="acad-ctop__mid">
          {course.tool ? <span className="acad-chip">{course.tool}</span> : null}
          <h1 className="acad-h1 acad-ctop__h1">{course.title}</h1>
          <p className="acad-ctop__count">
            {course.lessons_done} of {plural(course.lesson_count, "lesson")} done
            {course.quiz_count > 0 ? (
              <>
                {" · "}
                {course.quizzes_passed} of{" "}
                {plural(course.quiz_count, "module quiz", "module quizzes")} passed
              </>
            ) : null}
          </p>
        </div>

        {/* ONE BUTTON TO CARRY ON. It goes to the exact lesson and the
            exact second. Nobody should have to hunt for where they
            stopped, and the second is why lms_record_watch had to be
            changed to store the latest position rather than the
            furthest. */}
        <div className="acad-ctop__go">
          {finished && course.certificate_number ? (
            <Link
              className="acad-btn acad-btn--auto"
              to={`/lms/learn/${encodeURIComponent(course.slug)}/complete`}
            >
              See your certificate
              <ArrowIcon />
            </Link>
          ) : course.resume_lesson_id ? (
            <>
              <Link
                className="acad-btn acad-btn--auto"
                to={lessonPath(course.slug, course.resume_lesson_id)}
              >
                {course.lessons_done === 0 ? "Start the course" : "Carry on"}
                {course.resume_second ? ` at ${clock(course.resume_second)}` : ""}
                <ArrowIcon />
              </Link>
              <small className="acad-ctop__next">
                {course.resume_lesson_title}
              </small>
            </>
          ) : null}
        </div>
      </section>

      <div className="acad-learn">
        {/* ---------------------------------------------- the modules */}
        <div>
          {course.modules.length === 0 ? (
            <EmptyState label="Lessons" title="Nothing in this course yet">
              The lessons are being recorded. Your access is already set up, so
              it will be here waiting.
            </EmptyState>
          ) : (
            course.modules.map((m) => (
              <ModuleCard key={m.position} slug={course.slug} module={m} />
            ))
          )}
        </div>

        {/* ------------------------------------------------ the side */}
        <aside className="acad-learn__side">
          <section className="acad-certcard">
            <h2 className="acad-h3">Your certificate</h2>
            {course.certificate_number ? (
              <>
                <p className="acad-certcard__lead">
                  Issued. The number is{" "}
                  <b className="acad-mono">{course.certificate_number}</b>.
                </p>
                <Link
                  className="acad-btn acad-btn--auto acad-certcard__go"
                  to={`/certificate/${encodeURIComponent(course.certificate_number)}`}
                >
                  View and download
                  <ArrowIcon />
                </Link>
              </>
            ) : (
              <>
                <p className="acad-certcard__lead">
                  Issued the moment these are done.
                </p>
                <ul className="acad-checklist">
                  <li className="acad-checklist--done">
                    <span className="acad-dot">
                      <TickIcon />
                    </span>
                    Start the course
                  </li>
                  <li
                    className={
                      course.lessons_done >= course.lesson_count &&
                      course.lesson_count > 0
                        ? "acad-checklist--done"
                        : ""
                    }
                  >
                    <span className="acad-dot">
                      {course.lessons_done >= course.lesson_count &&
                      course.lesson_count > 0 ? (
                        <TickIcon />
                      ) : null}
                    </span>
                    Finish all {plural(course.lesson_count, "lesson")}
                    <b className="acad-mono acad-checklist__n">
                      {course.lessons_done}/{course.lesson_count}
                    </b>
                  </li>
                  {course.quiz_count > 0 ? (
                    <li
                      className={
                        course.quizzes_passed >= course.quiz_count
                          ? "acad-checklist--done"
                          : ""
                      }
                    >
                      <span className="acad-dot">
                        {course.quizzes_passed >= course.quiz_count ? (
                          <TickIcon />
                        ) : null}
                      </span>
                      Pass{" "}
                      {course.quiz_count === 1
                        ? "the module quiz"
                        : `all ${course.quiz_count} module quizzes`}
                      <b className="acad-mono acad-checklist__n">
                        {course.quizzes_passed}/{course.quiz_count}
                      </b>
                    </li>
                  ) : null}
                </ul>
              </>
            )}
          </section>

          {/* THE WATCH TAPE, one cell per ten minutes of the week. The
              minutes come from lms_watch_days rather than from the
              slices, because finishing a lesson deletes its slices and
              this chart would empty itself as somebody worked. */}
          <section className="acad-weektape">
            <div className="acad-weektape__top">
              <b>This week</b>
              <span className="acad-mono">
                {weekSeconds >= 3600
                  ? `${Math.floor(weekSeconds / 3600)}h ${Math.round(
                      (weekSeconds % 3600) / 60,
                    )}m`
                  : `${Math.round(weekSeconds / 60)}m`}
              </span>
            </div>
            <WeekTape seconds={weekSeconds} />
            <p className="acad-weektape__foot">Each cell is 10 minutes watched</p>
          </section>
        </aside>
      </div>
    </AcadStage>
  );
}

// --------------------------------------------------------------- pieces

/** One module: its lessons, then its quiz row if it has one. */
function ModuleCard({ slug, module: m }: { slug: string; module: LearnModule }) {
  const share =
    m.lesson_count > 0 ? Math.round((100 * m.lessons_done) / m.lesson_count) : 0;

  return (
    <article className="acad-modcard">
      <div className="acad-modcard__head">
        <h2 className="acad-h3">
          Module {m.position} &middot; {m.title}
        </h2>
        <small className="acad-mono">
          {m.lessons_done} of {plural(m.lesson_count, "lesson")}
          {m.seconds > 0 ? ` · ${Math.round(m.seconds / 60)}m` : ""}
        </small>
      </div>

      <div className="acad-modbar" aria-hidden="true">
        <i style={{ width: `${share}%` }} />
      </div>

      <ol className="acad-rows">
        {m.lessons.map((l) => (
          <LessonRow key={l.id} slug={slug} lesson={l} />
        ))}
      </ol>

      {m.quiz ? <QuizRow slug={slug} quiz={m.quiz} /> : null}
    </article>
  );
}

function LessonRow({ slug, lesson: l }: { slug: string; lesson: LearnLesson }) {
  const state = lessonState(l);
  const cls = `acad-row acad-row--${state}`;

  const inside = (
    <>
      <span className="acad-dot">
        {state === "done" ? <TickIcon /> : state === "locked" ? <LockIcon /> : null}
      </span>
      <span className="acad-row__name">{l.title}</span>
      {l.completed && l.has_check ? (
        <span className="acad-badge acad-badge--ok">CHECK PASSED</span>
      ) : state === "now" && l.coverage > 0 ? (
        <small>{Math.floor(l.coverage)}% watched</small>
      ) : (
        <small>{clock(l.seconds)}</small>
      )}
    </>
  );

  // A locked lesson is not a link. Making it one and then refusing on
  // the next page wastes somebody's data to tell them no.
  if (state === "locked") {
    return (
      <li className={cls} aria-disabled="true">
        {inside}
      </li>
    );
  }
  return (
    <li>
      <Link className={cls} to={lessonPath(slug, l.id)}>
        {inside}
      </Link>
    </li>
  );
}

/**
 * The module quiz row, which has more states than a lesson does.
 *
 * Every one of them comes from the database. The page does not work out
 * whether a quiz can be started: lms_quiz_status does, and this draws
 * the answer. That is the whole reason that function was added.
 */
function QuizRow({ slug, quiz: q }: { slug: string; quiz: LearnModuleQuizLike }) {
  const shut = Boolean(q.next_opens_at);

  return (
    <div className={"acad-quizrow" + (q.passed ? " acad-quizrow--done" : "")}>
      <span className="acad-dot">
        {q.passed ? <TickIcon /> : shut ? <LockIcon /> : <SealIcon />}
      </span>
      <span className="acad-quizrow__mid">
        <b>{q.title}</b>
        <small>
          {q.passed ? (
            <>
              Passed
              {q.best_percent !== null ? ` with ${Math.round(q.best_percent)}%` : ""}
            </>
          ) : shut ? (
            <>Opens again at {whenItOpens(q.next_opens_at)}</>
          ) : (
            <>
              {plural(q.question_count, "question")} &middot; pass mark{" "}
              {q.pass_mark}%
              {q.tries_used > 0
                ? ` · ${q.tries_used} of ${q.tries_allowed} tries used`
                : ` · ${plural(q.tries_allowed, "try", "tries")}`}
            </>
          )}
        </small>
      </span>
      {q.passed ? (
        <Link className="acad-btn acad-btn--ghost acad-quizrow__go" to={quizPath(slug, q.id)}>
          Review
        </Link>
      ) : shut ? (
        <span className="acad-badge">WAITING</span>
      ) : (
        <Link className="acad-btn acad-btn--ghost acad-quizrow__go" to={quizPath(slug, q.id)}>
          Open
        </Link>
      )}
    </div>
  );
}

type LearnModuleQuizLike = {
  id: string;
  title: string;
  pass_mark: number;
  question_count: number;
  tries_allowed: number;
  tries_used: number;
  passed: boolean;
  best_percent: number | null;
  next_opens_at: string | null;
};

/**
 * The week as cells, one per ten minutes, the same shape as the lesson
 * tape so the two read as the same idea.
 *
 * Capped, because a very long week would draw cells thinner than the
 * gaps between them and the tape would stop reading as anything. The
 * number above it is always the real total.
 */
function WeekTape({ seconds }: { seconds: number }) {
  const MAX = 42;
  const lit = Math.min(MAX, Math.floor(seconds / 600));
  const cells = Array.from({ length: MAX }, (_, i) => i < lit);
  return (
    <div className="acad-weektape__cells" aria-hidden="true">
      {cells.map((on, i) => (
        <i key={i} className={on ? "is-on" : ""} />
      ))}
    </div>
  );
}
