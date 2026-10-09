import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import "../academy.css";
import "./page.css";
import Seo from "../../../components/Seo/component";
import Breadcrumb from "../ui/Breadcrumb";
import AcadStage from "../ui/AcadStage";
import BuyCard, { type BuyState } from "./BuyCard";
import CourseCardTile from "../ui/CourseCard";
import CourseMap from "./CourseMap";
import Curriculum from "./Curriculum";
import Faq from "../ui/Faq";
import { ArrowIcon, SealIcon, WarnIcon } from "../ui/Icons";
import { routes } from "../../routes";
import { SITE_ORIGIN } from "../../../lib/site";
import { getSession } from "../../../lib/academy";
import { courseDescription, courseTitle } from "../../../lib/courseSeo";
import {
  asLength,
  hasCourseAccess,
  getCatalogue,
  getCourse,
  type CourseCard,
  type FullCourse,
} from "../../../lib/catalogue";

// /lms/courses/:slug. One course, everything about it.
//
// THE ORDER OF THE PAGE is the order of the questions somebody actually
// asks: what is it, how long, how much, what will I be able to do, is it
// for me, what is inside, what do I get at the end, and then the things
// they only ask if they are still unsure.
//
// THE TITLE AND DESCRIPTION ARE WRITTEN TWICE, here and in
// api/academy-meta.js, from the same two rules: seo_title and
// seo_description if somebody wrote them, otherwise the templates. They
// must agree, or the tag changes under a crawler that runs JavaScript.
// tests/seo-agreement.test.mjs checks they do.

export default function AcademyCourse() {
  const { slug = "" } = useParams();

  const [course, setCourse] = useState<FullCourse | "missing" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [related, setRelated] = useState<CourseCard[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  // null while we have not asked or could not ask. Never treated as
  // "no": see the state block further down.
  const [access, setAccess] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    getCourse(slug).then((c) => {
      if (!alive) return;
      setCourse(c);
      setLoaded(true);
    });
    getSession().then((s) => {
      if (alive) setSignedIn(s.signedIn);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  // The access check needs the course id and a signed in person, so it
  // waits for both. A paid course is the only case where the answer
  // changes what the card says, and asking for a free course would be
  // asking a question whose answer we would ignore.
  useEffect(() => {
    if (!course || course === "missing") return;
    if (!signedIn || (course.price_kobo || 0) <= 0) {
      setAccess(null);
      return;
    }
    let alive = true;
    hasCourseAccess(course.id).then((yes) => {
      if (alive) setAccess(yes);
    });
    return () => {
      alive = false;
    };
  }, [course, signedIn]);

  // Related courses: the same tool first, then the same area. Fetched
  // after the course itself so the page above the fold does not wait.
  useEffect(() => {
    if (!course || course === "missing") return;
    let alive = true;
    getCatalogue().then((got) => {
      if (!alive || !got.ok) return;
      const others = got.courses.filter((c) => c.slug !== course.slug);
      const sameTool = others.filter((c) => c.tool === course.tool);
      const sameArea = others.filter(
        (c) => c.tool !== course.tool && c.area === course.area,
      );
      setRelated([...sameTool, ...sameArea].slice(0, 3));
    });
    return () => {
      alive = false;
    };
  }, [course]);

  // ------------------------------------------------------ not loaded
  if (!loaded) {
    return (
      <AcadStage width="wide">
        <Seo title="Course | Data-Lead Academy" noindex />
        <div className="acad-course__waiting" aria-hidden="true">
          <div className="acad-skeleton acad-course__waitmain" />
          <div className="acad-skeleton acad-course__waitside" />
        </div>
      </AcadStage>
    );
  }

  // ------------------------------------------------- could not ask
  // Different from "there is no such course". Telling somebody a course
  // does not exist when the truth is that we could not reach the
  // database sends them away for good.
  if (course === null) {
    return (
      <AcadStage width="wide">
        <Seo title="Course | Data-Lead Academy" noindex />
        <p className="acad-msg acad-msg--bad acad-course__sorry">
          <WarnIcon />
          <span>
            We could not load this course just now. Please check your connection
            and try again.
          </span>
        </p>
        <p>
          <Link className="acad-link" to={routes.academyCourses}>
            All courses
          </Link>
        </p>
      </AcadStage>
    );
  }

  // --------------------------------------------------- no such course
  // The edge function answers a real 404 for this address, so a search
  // engine never files it. This is what a person sees.
  if (course === "missing") {
    return (
      <AcadStage width="wide">
        <Seo
          title="Course not found | Data-Lead Academy"
          description="This course is not available. Browse the Data-Lead Academy catalogue to see what is open."
          noindex
        />
        <h1 className="acad-h1">Course not found</h1>
        <p className="acad-lead">
          This course is not available. It may not be open yet, or the address
          may be wrong.
        </p>
        <p className="acad-course__sorrygo">
          <Link className="acad-btn acad-btn--auto" to={routes.academyCourses}>
            See every course
            <ArrowIcon />
          </Link>
        </p>
      </AcadStage>
    );
  }

  // ------------------------------------------------------- the course
  const free = (course.price_kobo || 0) <= 0;

  // Paystack is not live, so a paid course cannot be bought on the site
  // yet. This is the one line to change when it is.
  const PAYMENTS_OPEN = false;

  // WHO ALREADY HAS THIS COURSE.
  //
  // Two different rules, and both of them belong to the server:
  //
  //   a free course is open to anybody signed in, which is what
  //   lms_lesson_is_open says in the database
  //
  //   a paid course needs an entitlement, which is what
  //   lms_has_course_access answers. The page never works this out for
  //   itself from a price or an email address
  //
  // access is null until that answer arrives, and null is not "no". A
  // signed in person on a paid course sees the waiting state in the
  // meantime, which offers them nothing wrong, rather than being told
  // to create the account they already have and then watching the
  // button change under them.
  const owned = signedIn && (free || access === true);

  const state: BuyState = owned
    ? "owned"
    : free
      ? "free"
      : PAYMENTS_OPEN
        ? "open"
        : signedIn
          ? "waiting"
          : "closed";

  const title = courseTitle(course);
  const description = courseDescription(course);
  const url = `${SITE_ORIGIN}/lms/courses/${course.slug}`;

  return (
    <AcadStage width="wide" buyBar>
      <Seo
        title={title}
        description={description}
        canonicalPath={`/lms/courses/${course.slug}`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Course",
            name: course.title,
            description,
            url,
            provider: {
              "@type": "Organization",
              name: "Data-Lead Academy",
              url: `${SITE_ORIGIN}/lms`,
            },
            inLanguage: "en",
            educationalLevel: course.level,
            offers: {
              "@type": "Offer",
              price: String(Math.round((course.price_kobo || 0) / 100)),
              priceCurrency: "NGN",
              category: free ? "Free" : "Paid",
              url,
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Academy", item: `${SITE_ORIGIN}/lms` },
              { "@type": "ListItem", position: 2, name: "Courses", item: `${SITE_ORIGIN}/lms/courses` },
              { "@type": "ListItem", position: 3, name: course.title, item: url },
            ],
          },
        ]}
      />

      <Breadcrumb
        items={[
          { label: "Academy", to: routes.academy },
          { label: "Courses", to: routes.academyCourses },
          { label: course.title },
        ]}
      />

      <div className="acad-course">
        <div className="acad-course__main">
          <p className="acad-course__chips">
            {course.tool ? <span className="acad-chip">{course.tool}</span> : null}
            {course.level ? <span className="acad-chip">{course.level}</span> : null}
            {course.area ? <span className="acad-chip">{course.area}</span> : null}
            <span className="acad-chip">Certificate</span>
          </p>

          <h1 className="acad-h1 acad-course__h1">{course.title}</h1>
          <p className="acad-lead">{course.summary}</p>

          <div className="acad-facts">
            <div>
              <b>{course.lesson_count}</b>
              <small>Video lessons</small>
            </div>
            <div>
              <b>{asLength(course.total_seconds)}</b>
              <small>Of video</small>
            </div>
            <div>
              <b>{course.quiz_count}</b>
              <small>Module {course.quiz_count === 1 ? "quiz" : "quizzes"}</small>
            </div>
            <div>
              <b>Yes</b>
              <small>Certificate</small>
            </div>
          </div>

          <CourseMap modules={course.modules} total={course.total_seconds} />

          {course.outcomes && course.outcomes.length > 0 ? (
            <section className="acad-band">
              <p className="acad-band__eyebrow">What you will be able to do</p>
              <h2 className="acad-h2">By the last lesson</h2>
              <ol className="acad-outcomes">
                {course.outcomes.map((o, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {o}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {(course.audience && course.audience.length > 0) ||
          (course.prerequisites && course.prerequisites.length > 0) ? (
            <section className="acad-band acad-twoup">
              {course.audience && course.audience.length > 0 ? (
                <div className="acad-panel">
                  <h2 className="acad-h3">Who it is for</h2>
                  <ul>
                    {course.audience.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {course.prerequisites && course.prerequisites.length > 0 ? (
                <div className="acad-panel">
                  <h2 className="acad-h3">Before you start</h2>
                  <ul>
                    {course.prerequisites.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="acad-band">
            <div className="acad-band__head">
              <div>
                <p className="acad-band__eyebrow">Curriculum</p>
                <h2 className="acad-h2">What is inside</h2>
              </div>
              <p className="acad-course__totals">
                {course.module_count} modules{" · "}
                {course.lesson_count} lessons
                {course.quiz_count > 0 ? ` · ${course.quiz_count} quizzes` : ""}
              </p>
            </div>
            <Curriculum modules={course.modules} />
          </section>

          <section className="acad-band">
            <div className="acad-certband">
              <div>
                <p className="acad-band__eyebrow">Your certificate</p>
                <h2 className="acad-h2">Proof you can share</h2>
                <p className="acad-lead acad-certband__lead">
                  Pass every module quiz and your certificate is issued
                  automatically, with a number anyone can look up on our verify
                  page.
                </p>
              </div>
              <span className="acad-certband__seal" aria-hidden="true">
                <SealIcon />
              </span>
            </div>
          </section>

          {course.faq && course.faq.length > 0 ? (
            <section className="acad-band">
              <p className="acad-band__eyebrow">FAQ</p>
              <h2 className="acad-h2">About this course</h2>
              <Faq items={course.faq} />
            </section>
          ) : null}
        </div>

        <div className="acad-course__side">
          <BuyCard course={course} state={state} />
        </div>
      </div>

      {related.length > 0 ? (
        <section className="acad-band">
          <p className="acad-band__eyebrow">Keep going</p>
          <h2 className="acad-h2">Related courses</h2>
          <div className="acad-grid3">
            {related.map((c) => (
              <CourseCardTile key={c.id} course={c} />
            ))}
          </div>
        </section>
      ) : null}
    </AcadStage>
  );
}
