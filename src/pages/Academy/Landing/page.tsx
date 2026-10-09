import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import "../academy.css";
import "./page.css";
import Seo from "../../../components/Seo/component";
import AcadStage from "../ui/AcadStage";
import CourseCardTile from "../ui/CourseCard";
import Faq from "../ui/Faq";
import ToolRack from "../ui/ToolRack";
import { ArrowIcon, PlayIcon, SealIcon, TickIcon } from "../ui/Icons";
import { routes } from "../../routes";
import {
  coverCode,
  getCatalogue,
  getPaths,
  getSettings,
  toolsOf,
  type CourseCard,
  type LearningPath,
} from "../../../lib/catalogue";
import { SITE_ORIGIN } from "../../../lib/site";
import { landingWords, plural } from "../../../lib/courseSeo";

// /lms. The page somebody lands on from a search result or a WhatsApp
// link, and the first thing they ever see of the Academy.
//
// EVERY WORD HERE HAS TO BE TRUE OF WHAT IS ACTUALLY IN THE DATABASE.
// There are no invented course names and no invented numbers. The tool
// rack, the course cards and the tool pills are all built from the
// published catalogue, so a tool with nothing behind it cannot appear.
//
// THE TITLE AND DESCRIPTION ARE NOT WRITTEN HERE. They come from
// api/_seo-rules.js, which api/academy-meta.js imports too. The edge
// function's copy of the tags is what a crawler reads; this page sets
// them again when React boots. If the two differed, the tag would change
// under a crawler that does run JavaScript, which is worse than having
// no tag at all, and nobody would catch it by looking at the page. One
// file both sides import cannot disagree with itself.
//
// THE HEADLINE AND THE SUBHEAD are different: they come from
// lms_settings, so the Phase 6 control room can change them without a
// deployment. landingWords does the reading, on both sides, and falls
// back to the words in LANDING when there is no row or Supabase could
// not be reached. The <title> and the <meta description> deliberately
// never come from the database. The reason is written at landingWords.

const STEPS = [
  {
    n: "01",
    icon: <PlayIcon />,
    title: "Watch",
    body: "Short video lessons you can pause and pick up again. The first time through, you watch it all.",
  },
  {
    n: "02",
    icon: <TickIcon />,
    title: "Check",
    body: "A quick question after each lesson and a short quiz after each module, so you know it stuck.",
  },
  {
    n: "03",
    icon: <SealIcon />,
    title: "Certify",
    body: "Finish the course and your certificate is issued with a number employers can look up.",
  },
];

const QUESTIONS = [
  {
    question: "Can I learn on my phone?",
    answer:
      "Yes. Every page works on a phone, and your place is saved every few seconds, so you can start on your phone and carry on from a laptop.",
  },
  {
    question: "Do I get a certificate?",
    answer:
      "Yes, once you have watched every lesson and passed every module quiz. It carries a number anyone can check on our verify page, so it is worth something to an employer.",
  },
  {
    question: "Can I skip ahead in a video?",
    answer:
      "Not the first time through. A lesson opens the next one once you have watched it, which is what makes the certificate mean anything. After that you can jump about as much as you like.",
  },
  {
    question: "How long do I have access?",
    answer:
      "A course you have bought stays yours. There is no monthly fee and nothing expires.",
  },
];

/**
 * The last word of the headline, in the signal colour.
 *
 * The concept emphasises one word. Which word cannot be written in,
 * because the headline now comes from the database, so the rule is the
 * last word, whatever the headline says. A one word headline is left
 * alone rather than turned entirely orange.
 */
function headlineParts(headline: string): { lead: string; last: string } {
  const words = headline.trim().split(/\s+/);
  if (words.length < 2) return { lead: "", last: headline.trim() };
  return { lead: words.slice(0, -1).join(" "), last: words[words.length - 1] };
}

export default function AcademyLanding() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [number, setNumber] = useState("");
  const [words, setWords] = useState(() => landingWords(null));
  const [paths, setPaths] = useState<LearningPath[]>([]);

  useEffect(() => {
    let alive = true;
    getCatalogue().then((got) => {
      if (!alive) return;
      setCourses(got.courses);
      setLoaded(true);
    });
    // The words and the paths are fetched separately rather than with
    // the catalogue, so a slow one of the three does not hold the
    // others back. Each has a fallback that is what the page shows
    // today, so a failure is invisible.
    getSettings().then((s) => {
      if (alive && s) setWords(landingWords(s));
    });
    getPaths().then((p) => {
      if (alive) setPaths(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const list = courses || [];
  const tools = toolsOf(list);
  // The three most recently published. The catalogue function already
  // returns them newest first.
  const latest = list.slice(0, 3);
  const head = headlineParts(words.headline);

  return (
    <AcadStage width="wide">
      <Seo
        title={words.title}
        description={words.description}
        canonicalPath={routes.academy}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: "Data-Lead Academy",
          url: `${SITE_ORIGIN}${routes.academy}`,
          parentOrganization: {
            "@type": "Organization",
            name: "Data-Lead Africa",
            url: SITE_ORIGIN,
          },
          description: words.description,
        }}
      />

      {/* ------------------------------------------------------- hero */}
      <section className="acad-hero">
        <div>
          <p className="acad-eyebrow">
            <i />
            Data-Lead Academy
          </p>
          <h1 className="acad-h1">
            {head.lead ? `${head.lead} ` : ""}
            <em>{head.last}</em>
          </h1>
          <p className="acad-lead">{words.subhead}</p>
          {words.announce ? (
            <p className="acad-announce">
              <i aria-hidden="true" />
              {words.announce}
            </p>
          ) : null}

          <div className="acad-hero__buttons">
            <Link className="acad-btn acad-btn--auto" to={routes.academyCourses}>
              Browse courses
              <ArrowIcon />
            </Link>
            <Link
              className="acad-btn acad-btn--ghost acad-btn--auto"
              to={routes.academySignUp}
            >
              Create a free account
            </Link>
          </div>

          <p className="acad-hero__proof">
            <TickIcon />
            Every certificate checks out at dataleadafrica.com/verify
          </p>
        </div>

        {/* The rack needs four tools to look like a rack. Below that it
            is pills, which look deliberate at any number. */}
        <div className="acad-hero__rack">
          {!loaded ? (
            <div className="acad-hero__waiting" aria-hidden="true" />
          ) : tools.length >= 4 ? (
            <ToolRack courses={list} />
          ) : null}
        </div>
      </section>

      {loaded && tools.length > 0 && tools.length < 4 ? (
        <p className="acad-pills">
          <span className="acad-pills__label">Tools you will learn</span>
          {tools.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </p>
      ) : null}

      {/* ------------------------------------------------ how it works */}
      <section className="acad-band">
        <p className="acad-band__eyebrow">How it works</p>
        <h2 className="acad-h2">Three steps, every lesson</h2>
        <div className="acad-steps">
          {STEPS.map((s) => (
            <article key={s.n} className="acad-step">
              <div className="acad-step__top">
                <span className="acad-step__n">{s.n}</span>
                <span className="acad-step__icon" aria-hidden="true">
                  {s.icon}
                </span>
              </div>
              <h3 className="acad-h3">{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------------------------------- latest courses */}
      {/* "Latest", not "Popular". We do not measure how popular a course
          is, so calling three courses popular would be a number we made
          up on the page a stranger trusts least. */}
      <section className="acad-band">
        <div className="acad-band__head">
          <div>
            <p className="acad-band__eyebrow">Start here</p>
            <h2 className="acad-h2">Latest courses</h2>
          </div>
          {latest.length > 0 ? (
            <Link className="acad-link acad-band__more" to={routes.academyCourses}>
              See all courses
              <ArrowIcon />
            </Link>
          ) : null}
        </div>

        {!loaded ? (
          <div className="acad-grid3" aria-hidden="true">
            <div className="acad-skeleton" />
            <div className="acad-skeleton" />
            <div className="acad-skeleton" />
          </div>
        ) : latest.length > 0 ? (
          <div className="acad-grid3">
            {latest.map((c) => (
              <CourseCardTile key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <p className="acad-empty-line">
            The first courses are on their way. Create an account now and it will
            be waiting when they open.
          </p>
        )}
      </section>

      {/* -------------------------------------------- learning paths */}
      {/* Hidden entirely when there are none, which is the normal state
          until somebody builds one. A heading over an empty box reads
          like something is broken. getPaths also drops any course in a
          path that has since been unpublished, so a path cannot show a
          link to a page that is not there, and drops a path left with
          no courses at all. */}
      {paths.length > 0 ? (
        <section className="acad-band">
          <div className="acad-band__head">
            <div>
              <p className="acad-band__eyebrow">Go further</p>
              <h2 className="acad-h2">Learning paths</h2>
            </div>
          </div>
          <p className="acad-lead acad-paths__lead">
            Several courses in the order that makes sense, so you are not
            guessing what to learn next.
          </p>
          <div className="acad-paths">
            {paths.map((p) => (
              <article key={p.id} className="acad-path">
                <h3 className="acad-h3">{p.name}</h3>
                {p.description ? (
                  <p className="acad-path__sum">{p.description}</p>
                ) : null}
                <p className="acad-path__count">
                  {plural(p.courses.length, "course")}
                </p>
                <ol className="acad-path__list">
                  {p.courses.map((c, i) => (
                    <li key={c.slug}>
                      <span className="acad-path__n" aria-hidden="true">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Link
                        className="acad-path__link"
                        to={routes.academyCourse.replace(":slug", c.slug)}
                      >
                        <span className="acad-path__cover" aria-hidden="true">
                          {coverCode(c)}
                        </span>
                        <span>
                          <strong>{c.title}</strong>
                          {c.summary ? <em>{c.summary}</em> : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------ check a certificate */}
      <section className="acad-band">
        <div className="acad-verifybox">
          <div>
            <p className="acad-band__eyebrow">Proof, not just a PDF</p>
            <h2 className="acad-h2">Check any certificate</h2>
            <p className="acad-lead acad-verifybox__lead">
              Every Data-Lead Africa certificate has its own number. Type one in
              to see who earned it and when.
            </p>
            <form
              className="acad-verifybox__form"
              onSubmit={(e) => {
                e.preventDefault();
                const n = number.trim();
                if (n) {
                  navigate(
                    routes.verifyCertificate.replace(
                      ":number",
                      encodeURIComponent(n),
                    ),
                  );
                }
              }}
            >
              <label className="acad-verifybox__label" htmlFor="acad-verify-no">
                Certificate number
              </label>
              <div className="acad-verifybox__row">
                <input
                  id="acad-verify-no"
                  className="acad-verifybox__input"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="DLA-2026-..."
                  autoComplete="off"
                />
                <button type="submit" className="acad-btn acad-btn--auto">
                  Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- FAQ */}
      <section className="acad-band">
        <p className="acad-band__eyebrow">FAQ</p>
        <h2 className="acad-h2">Questions, answered</h2>
        <Faq items={QUESTIONS} />
      </section>

      {/* -------------------------------------------------- closing band */}
      <section className="acad-closing">
        <div>
          <h2 className="acad-closing__title">Start with one tool this week.</h2>
          <p>Short lessons, real data, a certificate you can prove.</p>
        </div>
        <Link className="acad-btn acad-btn--auto" to={routes.academyCourses}>
          Browse courses
          <ArrowIcon />
        </Link>
      </section>
    </AcadStage>
  );
}
