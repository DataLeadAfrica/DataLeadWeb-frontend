import { Link } from "react-router";

import "./CourseCard.css";
import { asLength, asPrice, coverCode, type CourseCard as Course } from "../../../lib/catalogue";
import { ArrowIcon, PlayIcon } from "./Icons";
import { routes } from "../../routes";

// One course, as a card. Used on the landing page, on the catalogue and
// in Related courses, so all three say the same things in the same order.
//
// Everything on it answers a question somebody would otherwise have to
// open the course to find out: which tool, what level, how many lessons,
// how long, how much. A card that makes you click to compare is a card
// that gets compared with somebody else's.
//
// FREE is shown in green, as a tag, rather than being left for the price
// line to imply. A free first module is a real reason to start, and
// hiding it in small print helps nobody.

export default function CourseCardTile({ course }: { course: Course }) {
  const href = routes.academyCourse.replace(":slug", course.slug);
  const free = (course.price_kobo || 0) <= 0;

  return (
    <article className="acad-coursecard">
      <div className="acad-coursecard__top">
        <span className="acad-coursecard__glyph" aria-hidden="true">
          {coverCode(course)}
        </span>
        {course.tool ? <span className="acad-chip">{course.tool}</span> : null}
        {course.level ? <span className="acad-chip">{course.level}</span> : null}
      </div>

      <h3 className="acad-coursecard__title">
        <Link to={href}>{course.title}</Link>
      </h3>
      <p className="acad-coursecard__summary">{course.summary}</p>

      <p className="acad-coursecard__facts">
        <span>
          <PlayIcon />
          {course.lesson_count} lesson{course.lesson_count === 1 ? "" : "s"}
        </span>
        <span>{asLength(course.total_seconds)}</span>
      </p>

      <div className="acad-coursecard__foot">
        <span className={`acad-coursecard__price${free ? " is-free" : ""}`}>
          {asPrice(course.price_kobo)}
        </span>
        {!free && course.first_module_free ? (
          <span className="acad-tag">Module 1 free</span>
        ) : null}
        <Link className="acad-coursecard__go" to={href}>
          View
          <ArrowIcon />
        </Link>
      </div>
    </article>
  );
}
