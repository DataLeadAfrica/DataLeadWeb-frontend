import { Link } from "react-router";

import "./QuickPicks.css";
import { asLength, asPrice, type CourseCard as Course } from "../../../lib/catalogue";
import CourseCover from "../ui/CourseCover";
import { ArrowIcon } from "../ui/Icons";
import { routes } from "../../routes";

// Three short lists, for the three reasons somebody picks a course when
// they do not yet know what they want.
//
// THERE IS NO "POPULAR" COLUMN, and that is deliberate rather than an
// omission. We do not count enrolments on the public site, so "popular"
// would be a word we made up, on the page a stranger trusts least. The
// three columns here are each a fact anybody can check from the card
// itself: what it costs, when it was published, how long it is.
//
// A COLUMN WITH ONE COURSE IN IT IS NOT A LIST, it is a course with a
// heading over it, so a column hides below two. And the whole section
// hides below four courses, because with three the section would be the
// same three courses as the rail directly above it, written out again.

const MAX = 3;
// An hour and a half: the brief's "under 90 minutes", in seconds.
const SHORT_SECONDS = 90 * 60;

type Column = {
  title: string;
  note: string;
  courses: Course[];
  /** Where this column's own link goes, and what it says. */
  to: string;
  all: string;
};

export default function QuickPicks({ courses }: { courses: Course[] }) {
  // getCatalogue returns newest first, so "newest" is the order it
  // arrived in and the others are sorted from a copy. Never sort the
  // array we were handed: it belongs to the page above.
  const columns: Column[] = [
    {
      title: "Free to start",
      note: "No payment",
      // Where the column's own link goes. "See free courses" opens the
      // catalogue with the Free to start toggle already on, which is
      // the same question this column is answering.
      to: `${routes.academyCourses}?free=1`,
      all: "See free courses",
      // Wholly free courses first, then the ones whose first module is
      // free. Both are a way to start without paying, so both belong
      // here, but without the sort this column tends to come out as
      // the same three courses as Newest, and two identical columns
      // are worse than one.
      courses: courses
        .filter((c) => (c.price_kobo || 0) <= 0 || c.first_module_free)
        .slice()
        .sort(
          (a, b) =>
            Number((b.price_kobo || 0) <= 0) - Number((a.price_kobo || 0) <= 0),
        )
        .slice(0, MAX),
    },
    {
      title: "Newest",
      note: "Just published",
      to: routes.academyCourses,
      all: "See all courses",
      courses: courses.slice(0, MAX),
    },
    {
      title: "Under 90 minutes",
      note: "One sitting",
      to: `${routes.academyCourses}?short=1`,
      all: "See short courses",
      courses: [...courses]
        .filter((c) => (c.total_seconds || 0) > 0 && c.total_seconds <= SHORT_SECONDS)
        .sort((a, b) => (a.total_seconds || 0) - (b.total_seconds || 0))
        .slice(0, MAX),
    },
  ].filter((col) => col.courses.length >= 2);

  if (courses.length < 4 || columns.length === 0) return null;

  return (
    <section className="acad-band">
      <div className="acad-band__head">
        <div>
          <p className="acad-band__eyebrow">Not sure where to start</p>
          <h2 className="acad-h2">Quick picks</h2>
        </div>
      </div>

      <div className="acad-picks">
        {columns.map((col) => (
          <article key={col.title} className="acad-pick">
            <h3>
              {col.title}
              <small>{col.note}</small>
            </h3>
            <ol>
              {col.courses.map((c) => {
                const free = (c.price_kobo || 0) <= 0;
                return (
                  <li key={c.id}>
                    <Link to={routes.academyCourse.replace(":slug", c.slug)}>
                      <CourseCover course={c} variant="square" />
                      <span className="acad-pick__mid">
                        <b>{c.title}</b>
                        <small>
                          {c.level ? `${c.level} · ` : ""}
                          {asLength(c.total_seconds)}
                        </small>
                      </span>
                      <em className={free ? "is-free" : ""}>
                        {free
                          ? "Free"
                          : c.first_module_free
                            ? "Module 1 free"
                            : asPrice(c.price_kobo)}
                      </em>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <Link className="acad-link acad-pick__all" to={col.to}>
              {col.all}
              <ArrowIcon />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
