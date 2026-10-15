import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import "../academy.css";
import "./page.css";
import Seo from "../../../components/Seo/component";
import Breadcrumb from "../ui/Breadcrumb";
import AcadStage from "../ui/AcadStage";
import CourseCardTile from "../ui/CourseCard";
import EmptyState from "../ui/EmptyState";
import { ArrowIcon } from "../ui/Icons";
import { routes } from "../../routes";
import { ACADEMY_PUBLIC, SITE_ORIGIN } from "../../../lib/site";
import { useSearchParams } from "react-router";

import { areaIconKey } from "../../../../api/_cover-art.js";
import { GoalIcon } from "../ui/Icons";
import {
  areasOf,
  getLanding,
  getCatalogue,
  matches,
  type CourseCard,
  type LandingArea,
} from "../../../lib/catalogue";
import Popup from "../ui/Popup";

// /lms/courses. Every published course, with a search box, filters and
// a sort.
//
// THE ADDRESS NEVER CHANGES. Typing in the search box or pressing a
// filter changes the list on the page and nothing else: no query
// string, no history entry, no new address. That is deliberate. Every
// combination of filters would otherwise be an address a search engine
// could find, and it would find twenty thin pages that each say almost
// the same thing, instead of one strong page that says all of it. The
// edge function's canonical drops any query string for the same reason.
//
// The cost is that a filtered view cannot be shared as a link. For a
// catalogue of a dozen courses that is a fair trade, and if it ever
// stops being one, the answer is real pages per area with their own
// words, not query strings.

const TITLE = "All courses | Data-Lead Academy";
const DESCRIPTION =
  "Every self paced Data-Lead Academy course by tool, level, length and price. Free courses and free first modules included. Certificates you can verify.";

export default function AcademyCourses() {
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Separate from "no courses". An empty list because the database could
  // not be reached must not be shown as "the first courses are on their
  // way", which sends somebody away believing there is nothing here.
  const [trouble, setTrouble] = useState(false);
  const [query, setQuery] = useState("");
  const [areaList, setAreaList] = useState<LandingArea[]>([]);

  // THE FILTERS COME IN THE ADDRESS, and only on the way in.
  //
  // "See free courses" and "See short courses" on the landing page open
  // this page with that toggle already on, and the Explore by area strip
  // opens it filtered to an area. Any other way in starts with nothing
  // on, which is what the brief asks for: somebody who typed
  // /lms/courses wants the catalogue, not whatever the last person
  // looked at.
  //
  // The address is read ONCE, as the starting state. Pressing a filter
  // afterwards does not change the address: a page per combination of
  // filters is a page per combination for a search engine to find, and
  // the canonical already says this page is one page.
  const [params] = useSearchParams();
  const [area, setArea] = useState(() => params.get("area") || "All");
  const [freeOnly, setFreeOnly] = useState(() => params.get("free") === "1");
  const [shortOnly, setShortOnly] = useState(() => params.get("short") === "1");

  useEffect(() => {
    let alive = true;
    getCatalogue().then((got) => {
      if (!alive) return;
      setTrouble(!got.ok);
      setCourses(got.courses);
      setLoaded(true);
    });
    // The areas, with their icons and their order, from the database.
    // Worked out from the catalogue the page already has would give the
    // areas that happen to have a course in them, in whatever order the
    // courses came back, and no icons.
    getLanding().then((got) => {
      if (alive) setAreaList(got.landing.areas);
    });
    return () => {
      alive = false;
    };
  }, []);

  const all = useMemo(() => courses || [], [courses]);

  // The areas to offer. From the database when it answered, and from
  // the catalogue itself otherwise, so a database without file 16 still
  // gets filters rather than none.
  const areas = useMemo(() => {
    if (areaList.length > 0) {
      const have = new Set(all.map((c) => (c.area || "").trim()));
      return areaList.filter((a) => have.has(a.name)).map((a) => ({
        name: a.name,
        icon: a.icon_key,
      }));
    }
    return areasOf(all).map((name) => ({ name, icon: areaIconKey(name) }));
  }, [areaList, all]);

  /** Free to start: free outright, or with the first module free. */
  const startsFree = (c: CourseCard) =>
    (c.price_kobo || 0) <= 0 || Boolean(c.first_module_free);

  /** Under 90 minutes of video. */
  const isShort = (c: CourseCard) =>
    (c.total_seconds || 0) > 0 && (c.total_seconds || 0) <= 5400;

  const shown = useMemo(
    () =>
      all.filter(
        (c) =>
          (area === "All" || c.area === area) &&
          (!freeOnly || startsFree(c)) &&
          (!shortOnly || isShort(c)) &&
          matches(c, query),
      ),
    [all, area, query, freeOnly, shortOnly],
  );

  return (
    <AcadStage width="wide">
      <Seo
        title={TITLE}
        description={DESCRIPTION}
        canonicalPath={routes.academyCourses}
        // The launch switch. See the note on the landing page.
        noindex={!ACADEMY_PUBLIC}
        robots="noindex, follow"
        // Two blocks, the same two the edge function writes: the list of
        // courses, and the trail that matches the breadcrumb a person
        // reads at the top of the page. The edge's copies are removed
        // before these are added, so the finished page has one of each.
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Data-Lead Academy courses",
            numberOfItems: all.length,
            itemListElement: all.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${SITE_ORIGIN}/lms/courses/${c.slug}`,
              name: c.title,
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Academy",
                item: `${SITE_ORIGIN}/lms`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Courses",
                item: `${SITE_ORIGIN}/lms/courses`,
              },
            ],
          },
        ]}
      />

      <Breadcrumb
        items={[
          { label: "Academy", to: routes.academy },
          { label: "Courses" },
        ]}
      />

      <div className="acad-courses__head">
        <div>
          <h1 className="acad-h1 acad-courses__h1">Self paced data courses</h1>
          <p className="acad-lead">
            Every course teaches one tool, in short video lessons with a check
            after each one.
          </p>
        </div>
        {loaded && all.length > 0 ? (
          <p className="acad-courses__count">
            <b>{shown.length}</b>
            <span>
              {shown.length === 1 ? "course" : "courses"}
              {shown.length !== all.length ? ` of ${all.length}` : ""}
            </span>
          </p>
        ) : null}
      </div>

      {loaded && all.length > 0 ? (
        <div className="acad-toolbar">
          <label className="acad-toolbar__search">
            <span className="acad-sr">Search courses or tools</span>
            <input
              type="search"
              value={query}
              placeholder="Search courses or tools"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          {areas.length > 1 ? (
            <div className="acad-toolbar__areas" role="group" aria-label="Filter by area">
              <button
                type="button"
                className={`acad-toolbar__area${area === "All" ? " is-on" : ""}`}
                aria-pressed={area === "All"}
                onClick={() => setArea("All")}
              >
                All
              </button>
              {areas.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  className={`acad-toolbar__area${a.name === area ? " is-on" : ""}`}
                  aria-pressed={a.name === area}
                  onClick={() => setArea(a.name)}
                >
                  {/* The area's own small picture, the same one the
                      landing page's strip uses, so a filter and the
                      place it was pressed from are plainly the same
                      thing. The name is always beside it: the picture
                      is never the only thing saying which area this
                      is. */}
                  <GoalIcon area={a.icon} className="acad-toolbar__aico" />
                  {a.name}
                </button>
              ))}
            </div>
          ) : null}

          {/* TWO TOGGLES, AND NO SORT.
              A sort dropdown is a question nobody arrives with: the
              order of a catalogue of twenty courses is not what is
              stopping somebody choosing. These two are the questions
              people actually arrive with, and both of them come off the
              course itself rather than out of a preference. */}
          <div className="acad-toolbar__toggles" role="group" aria-label="Narrow the list">
            <button
              type="button"
              className={`acad-toggle${freeOnly ? " is-on" : ""}`}
              aria-pressed={freeOnly}
              onClick={() => setFreeOnly((v) => !v)}
            >
              <i className="acad-toggle__dot" aria-hidden="true" />
              Free to start
            </button>
            <button
              type="button"
              className={`acad-toggle${shortOnly ? " is-on" : ""}`}
              aria-pressed={shortOnly}
              onClick={() => setShortOnly((v) => !v)}
            >
              <i className="acad-toggle__dot" aria-hidden="true" />
              Under 90 minutes
            </button>
          </div>
        </div>
      ) : null}

      {/* aria-live, so somebody using a screen reader hears the list
          change when they type. Without it the filtering is silent. */}
      <div aria-live="polite">
        {!loaded ? (
          <div className="acad-grid3" aria-hidden="true">
            <div className="acad-skeleton" />
            <div className="acad-skeleton" />
            <div className="acad-skeleton" />
            <div className="acad-skeleton" />
            <div className="acad-skeleton" />
            <div className="acad-skeleton" />
          </div>
        ) : shown.length > 0 ? (
          <div className="acad-grid3">
            {shown.map((c) => (
              <CourseCardTile key={c.id} course={c} />
            ))}
          </div>
        ) : all.length > 0 ? (
          <p className="acad-empty-line">
            Nothing matches that.{" "}
            <button
              type="button"
              className="acad-link"
              onClick={() => {
                setQuery("");
                setArea("All");
              }}
            >
              Clear the search and the filters
            </button>
            .
          </p>
        ) : trouble ? (
          <div className="acad-courses__empty">
            <EmptyState label="Courses" title="We could not load the courses">
              Something went wrong on our side, not yours. Please try again in
              a moment.
            </EmptyState>
            <p className="acad-courses__emptygo">
              <button
                type="button"
                className="acad-btn acad-btn--auto"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          <div className="acad-courses__empty">
            <EmptyState label="Courses" title="The first courses are on their way">
              We are recording them now. Create an account today and it will be
              waiting when they open.
            </EmptyState>
            <p className="acad-courses__emptygo">
              <Link className="acad-btn acad-btn--auto" to={routes.academySignUp}>
                Create a free account
                <ArrowIcon />
              </Link>
            </p>
          </div>
        )}
      </div>
      {/* The one popup for this page, if there is one. A lesson, a
          check and an exam are not on the list, in the database as
          well as here. */}
      <Popup place="courses" />
    </AcadStage>
  );
}
