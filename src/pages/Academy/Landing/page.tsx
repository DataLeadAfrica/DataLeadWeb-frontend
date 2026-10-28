import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import "../academy.css";
import "../../../css/dla-mark.css";
import "./page.css";
import Seo from "../../../components/Seo/component";
import AcadStage from "../ui/AcadStage";
import Faq from "../ui/Faq";
import GoalRail from "./GoalRail";
import PathBanner from "./PathBanner";
import QuickPicks from "./QuickPicks";
import AreaPicker from "./AreaPicker";
import AreaStrip from "./AreaStrip";
import { ArrowIcon, ChartIcon, PlayIcon, SealIcon, TickIcon } from "../ui/Icons";
import { routes } from "../../routes";
import {
  getCatalogue,
  getLanding,
  getSettings,
  type CourseCard,
  type LandingArea,
  type LandingPath,
} from "../../../lib/catalogue";
import { getSession } from "../../../lib/academy";
import { ACADEMY_PUBLIC, SITE_ORIGIN } from "../../../lib/site";
import { landingWords } from "../../../lib/courseSeo";
import Popup from "../ui/Popup";

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
    // Module quizzes became history in step 7 of file 16. There is one
    // exam, at the end of the course.
    body: "A quick check after each lesson, and one exam at the end of the course, so you know it stuck.",
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
  // The featured path, from lms_public_landing rather than from a read
  // of its own. One answer, so the banner and the rest of the page
  // cannot describe different paths.
  const [landingPath, setLandingPath] = useState<LandingPath | null>(null);
  // The seven areas with their tools, for the hero picker and the
  // Explore by area strip. One call, and an empty answer simply means
  // the hero keeps its waiting block: before file 16 has been run there
  // are no areas, and a preview of this branch should look like the
  // page before this round rather than like a broken page.
  const [areas, setAreas] = useState<LandingArea[]>([]);
  const [areasIn, setAreasIn] = useState(false);

  useEffect(() => {
    let alive = true;
    getCatalogue().then((got) => {
      if (!alive) return;
      setCourses(got.courses);
      setLoaded(true);
    });
    // The words and the landing block are fetched separately rather
    // than with the catalogue, so a slow one of the three does not hold
    // the others back. Each has a fallback that is what the page shows
    // today, so a failure is invisible.
    getSettings().then((s) => {
      if (alive && s) setWords(landingWords(s));
    });
    getLanding().then((got) => {
      if (!alive) return;
      setAreas(got.landing.areas);
      setLandingPath(got.landing.path);
      setAreasIn(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // SIGNED OUT UNTIL WE KNOW OTHERWISE. Reading the session is a local
  // lookup of a few milliseconds, and most people arriving here are not
  // signed in, so starting from the signed out buttons means the row is
  // never empty and almost never changes. Starting from "unknown" and
  // rendering nothing would leave a hole in the hero while it settled.
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    getSession().then((s) => {
      if (alive) setSignedIn(s.signedIn);
    });
    return () => {
      alive = false;
    };
  }, []);

  const list = courses || [];
  const head = headlineParts(words.headline);

  return (
    <AcadStage width="wide">
      <Seo
        title={words.title}
        description={words.description}
        canonicalPath={routes.academy}
        // THE LAUNCH SWITCH. The edge function already wrote noindex
        // into the HTML; this sets it again once React starts, because
        // React replaces the head tags and a page that is noindex in
        // the HTML and indexable half a second later is worse than one
        // that was never marked at all. The canonical is untouched.
        noindex={!ACADEMY_PUBLIC}
        robots="noindex, follow"
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
          {/* The mark replaces the pulsing dot that used to be here.
              A span rather than an i, so the dot's own rule in
              academy.css does not also paint on it. It is decoration:
              the words next to it already say Data-Lead Academy. */}
          <p className="acad-eyebrow">
            <span className="dla-mark" aria-hidden="true" />
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
            {/* THERE WAS NO WAY TO SIGN IN FROM THIS PAGE. Somebody
                who already had an account had to know to type
                /lms/sign-in, because the only links to it were from the
                sign up page, the password reset page, and the redirects
                that fire when you try to open something private. For a
                returning learner this was the first page they saw and it
                offered them nothing but a second account. */}
            {signedIn ? (
              <Link
                className="acad-btn acad-btn--ghost acad-btn--auto"
                to={routes.academyMe}
              >
                Continue learning
              </Link>
            ) : (
              <>
                <Link
                  className="acad-btn acad-btn--ghost acad-btn--auto"
                  to={routes.academySignUp}
                >
                  Create a free account
                </Link>
                <Link
                  className="acad-btn acad-btn--ghost acad-btn--auto"
                  to={routes.academySignIn}
                >
                  Sign in
                </Link>
              </>
            )}
          </div>

          <p className="acad-hero__proof">
            <TickIcon />
            Every certificate checks out at dataleadafrica.com/verify
          </p>
        </div>

        {/* The rack needs four tools to look like a rack. Below that it
            is pills, which look deliberate at any number. */}
        <div className="acad-hero__rack">
          {/* The map of the continent, behind the tool rack.
              DECORATION, AND IT SAYS NOTHING. No city names, no
              numbers, no claim about where anybody is learning. It is
              a shape people recognise, nothing more, so there is no
              fact on it that could become untrue. Hidden from screen
              readers for the same reason: there is nothing to read.
              It sits INSIDE the rack's column rather than being
              positioned across the hero. That is what keeps it off
              the headline at every width: it cannot reach the words
              because it is not in their half of the page. */}
          <div className="acad-hero__bg" aria-hidden="true">
            <img
              className="acad-hero__map"
              src="/academy/africa-dots.svg"
              width={574}
              height={597}
              alt=""
              decoding="async"
              fetchPriority="low"
            />
          </div>

          {/* THE CARD, AND WHY IT IS ITS OWN BOX.
              On a wide screen this is narrower than the column it sits
              in and pushed to the right of it, which is what frees the
              band of space on its left for Nigeria and the glow on
              Abuja to show in. Before this they were both behind the
              frosted rack and all that came through was a faint orange
              smudge, which is not the part of the picture Big Sam
              chose it for.
              The map stays outside this box, pinned to the column, so
              narrowing the card widens the clear band rather than
              moving the map with it. The four tiles are inside it,
              because they are tucked around the card's corners and
              have to travel with it. */}
          <div className="acad-hero__card">
            {/* Four small tiles tucked around the corners of the rack,
                so the rack looks placed on the page rather than
                dropped on it. Decoration: each one repeats something
                the words already say, and the last two are gone on a
                phone where there is no room.
                Play, tick, chart, certificate, which is the concept's
                set and its order. */}
            <span className="acad-sticker acad-sticker--1" aria-hidden="true">
              <PlayIcon />
            </span>
            <span className="acad-sticker acad-sticker--2 is-ok" aria-hidden="true">
              <TickIcon />
            </span>
            <span className="acad-sticker acad-sticker--3" aria-hidden="true">
              <ChartIcon />
            </span>
            <span className="acad-sticker acad-sticker--4" aria-hidden="true">
              <SealIcon />
            </span>

            {/* THE PICKER REPLACED THE RACK. The rack listed only the
                tools that had a published course and cycled through
                them by itself; this lists every tool of every area,
                says "Coming soon" where there is no course yet, and
                moves only when somebody presses something. */}
            <AreaPicker areas={areas} waiting={!areasIn} />
          </div>
        </div>

        {/* Under the hero and ABOVE the map, which is the whole point:
            a row of links drawn over a picture reads as part of the
            picture. */}
        <AreaStrip areas={areas} />
      </section>

      {/* The "Tools you will learn" pills were here. They were the
          fallback for a catalogue with fewer than four tools in it,
          because the old rack needed four to look like a rack. The
          picker does not: it lists every tool of every area whether or
          not a course exists for it, so a new Academy with one course
          still shows what it is going to cover. */}

      {/* ------------------------------------------------ how it works */}
      <section className="acad-band">
        <p className="acad-band__eyebrow">How it works</p>
        {/* Not "every lesson": the certificate comes once, at the end of
            the course, so a heading promising all three every lesson
            describes something the Academy does not do. */}
        <h2 className="acad-h2">Watch, check, certify</h2>
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

      {/* ----------------------------------- what do you want to do? */}
      {/* This replaces "Latest courses", which showed three cards and a
          link. The rail shows every course, newest first, and the chips
          above it are the goals somebody actually arrives with. There is
          still no "Popular" anywhere: we do not measure how popular a
          course is, so the word would be one we made up on the page a
          stranger trusts least. */}
      <GoalRail courses={list} loaded={loaded} />

      {/* The one case the rail hides itself for: no courses at all. */}
      {loaded && list.length === 0 ? (
        <section className="acad-band">
          <div className="acad-band__head">
            <div>
              <p className="acad-band__eyebrow">Start here</p>
              <h2 className="acad-h2">Courses</h2>
            </div>
          </div>
          <p className="acad-empty-line">
            The first courses are on their way. Create an account now and it will
            be waiting when they open.
          </p>
        </section>
      ) : null}

      {/* ------------------------------------------------ quick picks */}
      {/* Hides itself entirely below four courses, when it would just be
          the rail above written out again. */}
      {loaded ? <QuickPicks courses={list} /> : null}

      {/* -------------------------------------------- learning path */}
      {/* THE PATH COMES FROM lms_public_landing, the same call as the
          areas, so the page makes one request for its data and the
          banner cannot disagree with the rest of the page. It used to
          come from a second read, getPaths, which returned every
          published path with its courses embedded.

          WHAT THAT COSTS, SO IT IS WRITTEN DOWN RATHER THAN DISCOVERED:
          lms_public_landing returns ONE path, the featured one, so the
          compact cards that used to list any OTHER paths are gone with
          it. Nothing visible changes today, because there is one path.
          If a second one is ever built and should show here, the fix is
          in the database rather than in this file: have
          lms_public_landing return the rest alongside the featured one.

          Hidden entirely when there is no path, which is the normal
          state until somebody builds one. A heading over an empty box
          reads like something is broken. */}
      {landingPath ? (
        <section className="acad-band">
          <PathBanner path={landingPath} />
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
          <h2 className="acad-closing__title">Start with one skill this week.</h2>
          <p>Short lessons, real data, a certificate you can prove.</p>
        </div>
        <Link className="acad-btn acad-btn--auto" to={routes.academyCourses}>
          Browse courses
          <ArrowIcon />
        </Link>
      </section>
      {/* The one popup for this page, if there is one. A lesson, a
          check and an exam are not on the list, in the database as
          well as here. */}
      <Popup place="landing" />
    </AcadStage>
  );
}
