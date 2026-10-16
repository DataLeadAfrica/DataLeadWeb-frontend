import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import "../academy.css";
import "../Learn/learn.css";
import "../../../css/dla-mark.css";
import "./page.css";
import Seo from "../../../components/Seo/component";
import AcadStage from "../ui/AcadStage";
import CourseCover from "../ui/CourseCover";
import PassCard from "../ui/PassCard";
import ProgressRing from "../ui/ProgressRing";
import { ArrowIcon, SealIcon, TickIcon } from "../ui/Icons";
import { useAccess } from "../useAccess";
import { routes } from "../../routes";
import { getCatalogue, type CourseCard } from "../../../lib/catalogue";
import {
  getSession,
  greeting,
  roleLabel,
  setMyName,
  signOut,
  type Session,
} from "../../../lib/academy";
import {
  clock,
  getMyCertificates,
  getRecommendations,
  type Recommendation,
  getMyCourses,
  getMyWeek,
  lessonPath,
  plural,
  type MyCertificate,
  type MyCourseRow,
  type WeekDay,
} from "../../../lib/learn";
import Popup from "../ui/Popup";

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
  const [picks, setPicks] = useState<Recommendation[]>([]);
  const [week, setWeek] = useState<WeekDay[]>([]);
  // The public catalogue, for ONE purpose: the picture on each of your
  // courses. lms_my_courses does not return the area or the tool, and
  // this is a design change, so it does not get to change the database
  // to ask for them. The catalogue has both, keyed by slug.
  //
  // Nothing on this page waits for it. Until it arrives, and if it
  // never arrives, every cover draws the neutral art with the right two
  // letters on it, which is the same size, so nothing on the page
  // moves when the real art appears.
  const [catalogue, setCatalogue] = useState<Map<string, CourseCard>>(new Map());
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
    // Up to three courses to take next, each with its reason. Fetched
    // on its own: it is the least important thing on the page and must
    // never hold the rest of it up.
    getRecommendations().then((r) => {
      if (alive) setPicks(r);
    });
    getMyCertificates().then((c) => {
      if (alive) setCerts(c);
    });
    getMyWeek().then((w) => {
      if (alive) setWeek(w);
    });
    getCatalogue().then((got) => {
      if (!alive) return;
      setCatalogue(new Map(got.courses.map((c) => [c.slug, c])));
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

  // The saved name is held here as well as on the session, so the page
  // shows the new one the moment it is saved rather than waiting for the
  // next sign in. Seeded from the session once it arrives.
  const [savedName, setSavedName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameTrouble, setNameTrouble] = useState("");
  const [editingName, setEditingName] = useState(false);

  const name = savedName ?? session?.fullName ?? "";
  const firstName = name.split(" ")[0];

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setNameTrouble("");
    setNameBusy(true);
    const r = await setMyName(nameDraft);
    setNameBusy(false);
    if (!r.ok) {
      setNameTrouble(r.message);
      return;
    }
    setSavedName(r.name);
    setEditingName(false);
  }

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

        {/* ------------------------------------------------- your name

            Shown when there is no name saved, and openable when there
            is. With nothing saved the greeting above says "My learning"
            and the account card has an empty line where a name goes, so
            this is the one thing on the page that needs doing.

            It used to need nothing, because the session invented a name
            out of the email address: somebody signed up as
            a.samuel@example.com was greeted as "a.samuel" and told that
            was their name. A made up name shown as a real one is worse
            than no name, because there is nothing to tell the person
            that anything is wrong. */}
        {ready && session ? (
          <article className="acad-tile acad-me__name">
            {name && !editingName ? (
              <>
                <p className="acad-tile__label">Your name</p>
                <p className="acad-me__namenow">{name}</p>
                <button
                  type="button"
                  className="acad-btn acad-btn--ghost acad-btn--auto"
                  onClick={() => {
                    setNameDraft(name);
                    setNameTrouble("");
                    setEditingName(true);
                  }}
                >
                  Change it
                </button>
              </>
            ) : (
              <form onSubmit={saveName}>
                <label className="acad-tile__label" htmlFor="acad-me-name">
                  {name ? "Your name" : "Add your name"}
                </label>
                <p className="acad-me__namewhy">
                  {name
                    ? "This is the name on your certificates and the name staff see."
                    : "Your certificates are made out to this name, so it is worth getting right."}
                </p>
                <div className="acad-me__namerow">
                  <input
                    id="acad-me-name"
                    className="acad-me__nameinput"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Your full name"
                    aria-describedby={nameTrouble ? "acad-me-nametrouble" : undefined}
                  />
                  <button type="submit" className="acad-btn acad-btn--auto" disabled={nameBusy}>
                    {nameBusy ? "Saving" : "Save"}
                  </button>
                  {name ? (
                    <button
                      type="button"
                      className="acad-btn acad-btn--ghost acad-btn--auto"
                      onClick={() => {
                        setEditingName(false);
                        setNameTrouble("");
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
                {/* The server's own words, not a rewrite of them. It
                    knows why it refused and this page does not. */}
                {nameTrouble ? (
                  <p className="acad-me__nametrouble" id="acad-me-nametrouble" role="alert">
                    {nameTrouble}
                  </p>
                ) : null}
              </form>
            )}
          </article>
        ) : null}

        {/* --------------------------------------------- the control room

            A facilitator or an administrator signing in lands here, and
            before this there was no way into the control room except
            typing /lms/studio into the address bar.

            The role comes from the access sync, which has already run.
            It is NOT asked for separately: that was tried once and
            removed, because the two answers could disagree for a moment
            and the page would show one thing and then swap to the other.

            This is a convenience, not a permission. Every page and every
            function behind it checks the role again in the database, so
            a learner who somehow got this button would be refused at the
            door. */}
        {ready && (role === "facilitator" || role === "admin") ? (
          <Link className="acad-tile acad-me__studio" to={routes.studio}>
            <span className="acad-tile__label">Staff</span>
            <b>Control room</b>
            <small>
              {role === "admin"
                ? "Courses, learners, certificates, settings and the site's health."
                : "The courses you built, and how they are doing."}
            </small>
            <ArrowIcon />
          </Link>
        ) : null}

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
                  {/* The course's own cover, square. Looked up by slug:
                      a course that has since been unpublished is not in
                      the catalogue, and gets the neutral art rather
                      than nothing. */}
                  <CourseCover
                    variant="square"
                    course={{
                      slug: c.slug,
                      title: c.title,
                      cover_code: c.cover_code,
                      area: catalogue.get(c.slug)?.area ?? null,
                      tool: catalogue.get(c.slug)?.tool ?? null,
                    }}
                  />
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
                  {/* The seal with the mark on it, so a certificate row
                      carries the same mark as everything else that
                      comes from Data-Lead. Decoration: the row says
                      the course and the number in words. */}
                  <span className="acad-cert__seal">
                    <SealIcon />
                    <i className="dla-mark" aria-hidden="true" />
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

      {/* ------------------------------------------- what to learn next
          RULE BASED, AND THE PAGE SAYS SO. Each card carries the reason
          the database gave for it: next in a path, people who finished
          one often take another, it matches a goal they told us, or it
          is free and a good first course. The line underneath is not
          decoration: a list of courses with no workings on show is an
          advert, and this one is not for sale. */}
      {picks.length > 0 ? (
        <section className="acad-band acad-next">
          <div className="acad-band__head">
            <div>
              <p className="acad-band__eyebrow">Recommended for you</p>
              <h2 className="acad-h2">What to learn next</h2>
            </div>
          </div>

          <div className="acad-next__grid">
            {picks.map((p) => (
              <Link
                key={p.slug}
                className="acad-next__card"
                to={routes.academyCourse.replace(":slug", p.slug)}
              >
                <CourseCover
                  course={{
                    slug: p.slug,
                    title: p.title,
                    tool: p.tool,
                    area: p.area,
                    cover_code: p.cover_code,
                  }}
                  variant="square"
                  badge={false}
                />
                <span className="acad-next__words">
                  {p.area ? <span className="acad-next__area">{p.area}</span> : null}
                  <b>{p.title}</b>
                  <small>{p.reason}</small>
                </span>
              </Link>
            ))}
          </div>

          <p className="acad-next__why">
            Picked from what you have finished, the paths you are on and the goal
            you gave us. Never from what anybody paid to show you.
          </p>
        </section>
      ) : null}

      {/* The one popup for this page, if there is one. A lesson, a
          check and an exam are not on the list, in the database as
          well as here. */}
      <Popup place="me" />
    </AcadStage>
  );
}

/** M, T, W... for the week chart. The date arrives as a plain date. */
function dayLetter(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
}
