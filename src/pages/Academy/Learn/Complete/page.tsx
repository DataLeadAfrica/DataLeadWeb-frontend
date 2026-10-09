import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import "../../academy.css";
import "../learn.css";
import "./page.css";
import Seo from "../../../../components/Seo/component";
import AcadStage from "../../ui/AcadStage";
import EmptyState from "../../ui/EmptyState";
import CourseCardTile from "../../ui/CourseCard";
import Confetti from "../../ui/Confetti";
import { ArrowIcon, TickIcon, WarnIcon } from "../../ui/Icons";
import { routes } from "../../../routes";
import { SITE_ORIGIN } from "../../../../lib/site";
import { getCatalogue, type CourseCard } from "../../../../lib/catalogue";
import {
  claimCertificate,
  getMyCourse,
  plural,
  profileName,
  type MyCourse,
} from "../../../../lib/learn";

// /lms/learn/:slug/complete. The moment the course is finished.
//
// WHY IT IS A PAGE AND NOT A BANNER. Finishing a course is the thing
// the whole Academy is for, and it is the one moment somebody will
// screenshot and send to somebody else. A toast at the top of a lesson
// page is not that.
//
// IT CLAIMS THE CERTIFICATE ITSELF rather than relying on the page that
// sent somebody here. lms_claim_course_certificate is safe to call
// twice by design: it looks for an existing certificate first and hands
// the same number back. So this page simply asks, every time it loads,
// and the server decides. That means a learner who closes the tab at
// exactly the wrong moment, or who reaches this address by typing it,
// still ends up with their certificate.
//
// ONE SHORT BURST OF CONFETTI, and none at all for somebody who has
// asked for less movement. It celebrates and then gets out of the way.

export default function AcademyComplete() {
  const params = useParams();
  const slug = params.slug || "";

  const [course, setCourse] = useState<MyCourse | "missing" | null>(null);
  const [number, setNumber] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [name, setName] = useState("");
  const [related, setRelated] = useState<CourseCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);

    getMyCourse(slug).then(async (c) => {
      if (!alive) return;
      setCourse(c);
      if (c === null || c === "missing") {
        setLoaded(true);
        return;
      }
      if (c.certificate_number) {
        setNumber(c.certificate_number);
        setLoaded(true);
        return;
      }
      // No certificate on the record yet, so ask for it. Safe to call
      // twice, and it answers with the reason when the course is not
      // actually finished.
      const got = await claimCertificate(c.course_id);
      if (!alive) return;
      if (got && got.certificate_number) setNumber(got.certificate_number);
      else if (got) setWhy(got.message);
      setLoaded(true);
    });

    // The name the CERTIFICATE carries, not the one the greeting uses.
    // See profileName: the greeting falls back to the email address,
    // which on a certificate would read "This certifies that learner".
    profileName().then((n) => {
      if (alive) setName(n);
    });

    return () => {
      alive = false;
    };
  }, [slug]);

  // Related courses, fetched after the certificate so the moment is not
  // waiting on a catalogue.
  useEffect(() => {
    if (!course || course === "missing") return;
    let alive = true;
    getCatalogue().then((got) => {
      if (!alive || !got.ok) return;
      const others = got.courses.filter((c) => c.slug !== course.slug);
      const sameTool = others.filter((c) => c.tool === course.tool);
      const rest = others.filter((c) => c.tool !== course.tool);
      setRelated([...sameTool, ...rest].slice(0, 3));
    });
    return () => {
      alive = false;
    };
  }, [course]);

  if (!loaded) {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Course complete | Data-Lead Academy" noindex />
        <div className="acad-skeleton acad-done__waiting" aria-hidden="true" />
      </AcadStage>
    );
  }

  if (course === null) {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Course complete | Data-Lead Academy" noindex />
        <EmptyState label="Course complete" title="We could not load this just now">
          Your work is saved and your certificate is safe. Please try again in a
          moment.
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

  if (course === "missing") {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Course complete | Data-Lead Academy" noindex />
        <EmptyState label="Course complete" title="This course is not open to you">
          If you think that is wrong, send us a message and we will sort it out.
        </EmptyState>
        <p className="acad-actions">
          <Link className="acad-btn acad-btn--auto" to={routes.academyMe}>
            Back to my learning
            <ArrowIcon />
          </Link>
        </p>
      </AcadStage>
    );
  }

  // Not finished after all: somebody typed the address, or a lesson was
  // added to the course after they finished it. Said plainly, with the
  // way back, rather than with confetti over a half done course.
  if (!number) {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Course complete | Data-Lead Academy" noindex />
        <EmptyState label="Almost there" title="Not quite finished yet">
          {why ||
            "There is still something left in this course. Your certificate is issued the moment it is all done."}
        </EmptyState>
        <p className="acad-actions">
          <Link
            className="acad-btn acad-btn--auto"
            to={routes.academyLearn.replace(":slug", encodeURIComponent(slug))}
          >
            Back to the course
            <ArrowIcon />
          </Link>
        </p>
      </AcadStage>
    );
  }

  const certUrl = `${SITE_ORIGIN}/certificate/${encodeURIComponent(number)}`;
  const issued = course.certificate_issued_on
    ? new Date(course.certificate_issued_on)
    : new Date();
  const issuedWords = issued.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AcadStage width="wide" focus>
      <Seo title={`You finished ${course.title} | Data-Lead Academy`} noindex />
      <Confetti />

      <div className="acad-done">
        <p className="acad-eyebrow">
          <i />
          Course complete
        </p>
        <h1 className="acad-h1 acad-done__h1">
          {name ? `You did it, ${name.split(" ")[0]}.` : "You did it."}
        </h1>
        <p className="acad-lead acad-done__lead">
          Every lesson watched
          {course.quiz_count > 0 ? (
            <>
              {" and "}
              {course.quiz_count === 1
                ? "the module quiz passed"
                : `all ${course.quiz_count} module quizzes passed`}
            </>
          ) : null}
          . Your certificate is ready, with a number anyone can check.
        </p>

        {/* The certificate itself. A real card, not a line of text: this
            is the thing somebody screenshots. */}
        <div className="acad-bigcert">
          <div className="acad-bigcert__top">
            <small>CERTIFICATE OF COMPLETION</small>
            <span className="acad-bigcert__seal">
              <TickIcon />
            </span>
          </div>
          <div>
            <div className="acad-bigcert__what">This certifies that</div>
            <div
              className={
                "acad-bigcert__who" + (name ? "" : " acad-bigcert__who--none")
              }
            >
              {name || "Add your name"}
            </div>
            <div className="acad-bigcert__what">
              completed <b>{course.title}</b>, a self paced course of{" "}
              {plural(course.lesson_count, "lesson")}
              {course.quiz_count > 0
                ? ` and ${plural(course.quiz_count, "module quiz", "module quizzes")}`
                : ""}
              .
            </div>
          </div>
          <div className="acad-bigcert__foot">
            <span>
              Data-Lead Academy
              <br />
              {issuedWords}
            </span>
            <span className="acad-bigcert__no">
              Certificate no.
              <br />
              <b>{number}</b>
            </span>
          </div>
        </div>

        <div className="acad-done__share">
          <Link className="acad-btn" to={`/certificate/${encodeURIComponent(number)}`}>
            View and download
            <ArrowIcon />
          </Link>
          <a
            className="acad-btn acad-btn--ghost"
            href={linkedInUrl(course.title, issued, number, certUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Add to LinkedIn
          </a>
          <a
            className="acad-btn acad-btn--ghost"
            href={whatsAppUrl(course.title, certUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on WhatsApp
          </a>
        </div>

        <p className="acad-done__proof">
          <TickIcon />
          Anyone can check it at dataleadafrica.com/verify
        </p>

        {!name ? (
          <p className="acad-note">
            <WarnIcon />
            <span>
              Your certificate carries the name on your account. Add your full
              name on <Link to={routes.academyMe}>my learning</Link> and it will
              appear here.
            </span>
          </p>
        ) : null}
      </div>

      {related.length > 0 ? (
        <section className="acad-band acad-done__next">
          <div className="acad-band__head">
            <div>
              <p className="acad-band__eyebrow">What next</p>
              <h2 className="acad-h2">Keep the momentum</h2>
            </div>
          </div>
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

/**
 * LinkedIn's own "add a certification" address, filled in.
 *
 * Their form reads these exact parameter names. Anything it does not
 * recognise is ignored rather than breaking, which is why the month and
 * year are sent as separate numbers: LinkedIn has never accepted a date
 * string here.
 */
function linkedInUrl(
  course: string,
  issued: Date,
  number: string,
  url: string,
): string {
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: course,
    organizationName: "Data-Lead Africa",
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certUrl: url,
    certId: number,
  });
  return `https://www.linkedin.com/profile/add?${q.toString()}`;
}

/** A WhatsApp message with the link in it, which is how this gets shared. */
function whatsAppUrl(course: string, url: string): string {
  const text = `I have just finished ${course} at Data-Lead Academy. Here is my certificate: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
