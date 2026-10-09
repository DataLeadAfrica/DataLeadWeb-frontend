import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import "../academy.css";
import "../Learn/learn.css";
import "./page.css";
import Seo from "../../../components/Seo/component";
import AcadStage from "../ui/AcadStage";
import PassCard from "../ui/PassCard";
import ProgressRing from "../ui/ProgressRing";
import { ArrowIcon, SealIcon, TickIcon } from "../ui/Icons";
import { useAccess } from "../useAccess";
import { routes } from "../../routes";
import {
  getSession,
  greeting,
  roleLabel,
  signOut,
  type Session,
} from "../../../lib/academy";
import {
  clock,
  getMyCertificates,
  getMyCourses,
  getMyWeek,
  lessonPath,
  plural,
  type MyCertificate,
  type MyCourseRow,
  type WeekDay,
} from "../../../lib/learn";

// My learning. The full bento, as of Phase 4.
//
// THE BIGGEST TILE IS THE ONE THING TO DO NEXT. Everything else on this
// page is a glance: how much was watched this week, which courses
// exist, which certificates are held. Continue is the only tile
// somebody has to act on, so it is the only one that is large.
//
// EVERY TILE IS ABSENT RATHER THAN EMPTY. A brand new learner has no
// courses, no minutes and no certificates, and three empty boxes
// telling them so is a worse welcome than one designed card telling
// them where to start. So the whole grid changes shape rather than
// filling with nothing.
//
// The page is behind RequireAccount, so by the time it renders there is a
// session. It still reads it rather than assuming, because the guard and
// this page ask separately and a session can end between the two.

export default function AcademyMe() {
  const navigate = useNavigate();

  // The role and the bootcamp flag both come from the access sync, which
  // either ran here or was handed over by the page that signed the person
  // in. Nothing on this page decides for itself what the account can
  // reach: that is the server's answer, shown as it was given.
  const { role, bootcamp, notice, dismiss, ready } = useAccess();

  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);

  const [courses, setCourses] = useState<MyCourseRow[]>([]);
  const [certs, setCerts] = useState<MyCertificate[]>([]);
  const [week, setWeek] = useState<WeekDay[]>([]);
  const [trouble, setTrouble] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getSession().then((s) => {
      if (alive) setSession(s);
    });
    // Three separate calls rather than one, so a slow one does not hold
    // the others back. Each tile appears when its own answer arrives.
    getMyCourses().then((got) => {
      if (!alive) return;
      setTrouble(!got.ok);
      setCourses(got.courses);
      setLoaded(true);
    });
    getMyCertificates().then((c) => {
      if (alive) setCerts(c);
    });
    getMyWeek().then((w) => {
      if (alive) setWeek(w);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function onSignOut() {
    setBusy(true);
    await signOut();
    navigate(routes.academySignIn, { replace: true });
  }

  const name = session?.fullName ?? "";
  const firstName = name.split(" ")[0];

  // The one to carry on with: the most recently touched course that is
  // not finished. lms_my_courses already returns them most recent
  // first, so this is the first unfinished one rather than a sort.
  const carryOn =
    courses.find((c) => !c.certificate_number && c.started) ||
    courses.find((c) => !c.certificate_number) ||
    null;

  const weekSeconds = week.reduce((sum, d) => sum + (d.seconds || 0), 0);
  const weekMax = week.reduce((most, d) => Math.max(most, d.seconds || 0), 0);

  // A learner with nothing at all gets the welcome layout rather than
  // a grid of absent tiles.
  const fresh = loaded && courses.length === 0 && certs.length === 0;

  return (
    <AcadStage width="wide" focus>
      <Seo
        title="My learning | Data-Lead Academy"
        description="Your Data-Lead Academy courses."
        noindex
      />

      {notice ? (
        <div className="acad-notice">
          <TickIcon />
          <span>{notice}</span>
          <button type="button" onClick={dismiss}>
            Hide
          </button>
        </div>
      ) : null}

      <div className="acad-me__head">
        <div>
          <p className="acad-eyebrow">
            <i />
            My learning
          </p>
          <h1 className="acad-h1 acad-me__greet">
            {firstName ? `${greeting()}, ${firstName}` : "My learning"}
          </h1>
          <p className="acad-lead acad-me__sub">
            Everything you are working on lives here.
          </p>
        </div>

        <button
          type="button"
          className="acad-btn acad-btn--ghost acad-btn--auto"
          disabled={busy}
          onClick={onSignOut}
        >
          {busy ? "Signing out" : "Sign out"}
        </button>
      </div>

      <div className={"acad-bento" + (fresh ? " acad-bento--new" : "")}>
        {/* ------------------------------------------- continue

            The one thing to do next, and the only large tile. A brand
            new learner gets the welcome card in its place rather than
            an empty box saying they have not started anything. */}
        {!loaded ? (
          <div className="acad-tile acad-tile--continue acad-me__waiting" aria-hidden="true" />
        ) : carryOn ? (
          <article className="acad-tile acad-tile--continue">
            <ProgressRing
              percent={carryOn.percent}
              size={132}
              label="COURSE"
              title={`${carryOn.percent} percent of ${carryOn.title} is done`}
            />
            <div className="acad-tile__body">
              <p className="acad-tile__label">Continue</p>
              <h2 className="acad-h3">{carryOn.title}</h2>
              <p className="acad-tile__sub">
                {carryOn.lessons_done} of {plural(carryOn.lesson_count, "lesson")} done
                {carryOn.resume_lesson_title
                  ? ` \u00b7 ${carryOn.resume_lesson_title}`
                  : ""}
              </p>
              <Link
                className="acad-btn acad-btn--auto acad-tile__go"
                to={
                  carryOn.resume_lesson_id
                    ? lessonPath(carryOn.slug, carryOn.resume_lesson_id)
                    : routes.academyLearn.replace(":slug", carryOn.slug)
                }
              >
                {carryOn.lessons_done === 0 ? "Start" : "Carry on"}
                {carryOn.resume_second
                  ? ` at ${clock(carryOn.resume_second)}`
                  : ""}
                <ArrowIcon />
              </Link>
            </div>
          </article>
        ) : (
          <article className="acad-tile acad-tile--continue acad-tile--welcome">
            <div className="acad-tile__body">
              <p className="acad-tile__label">Welcome</p>
              <h2 className="acad-h2">
                {trouble ? "We could not load your courses" : "Pick your first course"}
              </h2>
              <p className="acad-tile__sub">
                {trouble
                  ? "Something went wrong on our side, not yours. Nothing you have done has been lost. Please try again in a moment."
                  : "Each course teaches one tool, in short video lessons with a few questions after each one. Your place is saved to the last ten seconds you watched."}
              </p>
              <Link
                className="acad-btn acad-btn--auto acad-tile__go"
                to={routes.academyCourses}
              >
                Browse courses
                <ArrowIcon />
              </Link>
            </div>
          </article>
        )}

        {/* ----------------------------------------------- the pass

            It waits for the sync rather than guessing. Showing the
            plain card first and swapping it for the bootcamp one a
            moment later would tell somebody their access had changed
            when all that happened was the page finished loading. */}
        {ready && session ? (
          <PassCard
            name={name}
            email={session.email}
            role={roleLabel(role)}
            bootcamp={bootcamp}
          />
        ) : (
          <div className="acad-me__waiting" aria-hidden="true" />
        )}

        {/* ------------------------------------------- this week

            Only once there is a week to show. Seven empty bars is a
            chart saying nothing, twice. */}
        {weekSeconds > 0 ? (
          <article className="acad-tile acad-tile--week">
            <p className="acad-tile__label">This week</p>
            <div className="acad-week__total">
              <b className="acad-mono">
                {weekSeconds >= 3600
                  ? `${Math.floor(weekSeconds / 3600)}h ${Math.round(
                      (weekSeconds % 3600) / 60,
                    )}m`
                  : `${Math.round(weekSeconds / 60)}m`}
              </b>
              <small>watched</small>
            </div>
            <div className="acad-week__bars" aria-label="Minutes watched each day">
              {week.map((d) => {
                const share = weekMax > 0 ? d.seconds / weekMax : 0;
                return (
                  <div key={d.day}>
                    <i
                      className={d.seconds === 0 ? "is-zero" : ""}
                      style={{ height: `${Math.max(4, Math.round(share * 76))}px` }}
                      title={`${d.minutes} minutes`}
                    />
                    <span>{dayLetter(d.day)}</span>
                  </div>
                );
              })}
            </div>
          </article>
        ) : null}

        {/* -------------------------------------------- your courses */}
        {courses.length > 0 ? (
          <article className="acad-tile acad-tile--courses">
            <p className="acad-tile__label">Your courses</p>
            <div className="acad-courses">
              {courses.map((c) => (
                <Link
                  key={c.course_id}
                  className="acad-course"
                  to={routes.academyLearn.replace(":slug", c.slug)}
                >
                  <span className="acad-course__glyph">{c.cover_code}</span>
                  <span className="acad-course__mid">
                    <b>{c.title}</b>
                    <small>
                      {plural(c.lesson_count, "lesson")}
                      {c.quiz_count > 0
                        ? ` \u00b7 ${plural(c.quiz_count, "module quiz", "module quizzes")}`
                        : ""}
                    </small>
                    <span className="acad-course__bar">
                      <i
                        style={{ width: `${c.percent}%` }}
                        className={c.certificate_number ? "is-done" : ""}
                      />
                    </span>
                  </span>
                  <span
                    className={
                      "acad-course__state" +
                      (c.certificate_number
                        ? " acad-course__state--won"
                        : c.started
                          ? " acad-course__state--live"
                          : "")
                    }
                  >
                    {c.certificate_number
                      ? "Certified"
                      : c.started
                        ? "In progress"
                        : "Not started"}
                  </span>
                </Link>
              ))}
            </div>
          </article>
        ) : null}

        {/* -------------------------------------------- certificates */}
        {certs.length > 0 ? (
          <article className="acad-tile acad-tile--certs">
            <p className="acad-tile__label">Certificates</p>
            <div className="acad-certs">
              {certs.map((c) => (
                <Link
                  key={c.certificate_number}
                  className="acad-cert"
                  to={`/certificate/${encodeURIComponent(c.certificate_number)}`}
                >
                  <span className="acad-cert__seal">
                    <SealIcon />
                  </span>
                  <span className="acad-cert__mid">
                    <b>{c.course_title}</b>
                    <small>
                      {c.certificate_number} &middot; issued{" "}
                      {new Date(c.issued_on).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </AcadStage>
  );
}

/** M, T, W... for the week chart. The date arrives as a plain date. */
function dayLetter(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
}
