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
import { SITE_ORIGIN } from "../../../lib/site";
import {
  areasOf,
  getCatalogue,
  matches,
  sortCourses,
  type CourseCard,
  type SortOrder,
} from "../../../lib/catalogue";

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
  const [area, setArea] = useState("All");
  const [order, setOrder] = useState<SortOrder>("newest");

  useEffect(() => {
    let alive = true;
    getCatalogue().then((got) => {
      if (!alive) return;
      setTrouble(!got.ok);
      setCourses(got.courses);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const all = useMemo(() => courses || [], [courses]);
  const areas = useMemo(() => areasOf(all), [all]);

  const shown = useMemo(() => {
    const picked = all.filter(
      (c) => (area === "All" || c.area === area) && matches(c, query),
    );
    return sortCourses(picked, order);
  }, [all, area, query, order]);

  return (
    <AcadStage width="wide">
      <Seo
        title={TITLE}
        description={DESCRIPTION}
        canonicalPath={routes.academyCourses}
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
              {["All", ...areas].map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`acad-toolbar__area${a === area ? " is-on" : ""}`}
                  aria-pressed={a === area}
                  onClick={() => setArea(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          ) : null}

          <label className="acad-toolbar__sort">
            <span className="acad-sr">Sort courses</span>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as SortOrder)}
            >
              <option value="newest">Newest first</option>
              <option value="shortest">Shortest first</option>
              <option value="title">A to Z</option>
            </select>
          </label>
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
    </AcadStage>
  );
}
