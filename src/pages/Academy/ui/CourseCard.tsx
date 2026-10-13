import { Link } from "react-router";

import "./CourseCard.css";
import { asLength, asPrice, type CourseCard as Course } from "../../../lib/catalogue";
import CourseCover from "./CourseCover";
import { ArrowIcon, PlayIcon } from "./Icons";
import { routes } from "../../routes";

// One course, as a card. Used on the landing page, on the catalogue and
// in Related courses, so all three say the same things in the same order.
//
// THE PICTURE IS THE CHANGE. Before this, a card opened with a small
// square holding two letters, and the tool name sat next to it as a
// chip. A grid of those reads like a spreadsheet: the eye has nothing
// to land on, so every card has to be read rather than recognised. Now
// each card opens with its own designed cover, and the cover already
// carries the tool name and the free tag, so both come off the card
// body. See CourseCover.tsx for how the cover is drawn.
//
// What is left below the picture is the shortest set of answers to the
// questions somebody would otherwise have to open the course to find:
// what it is called, what it covers, how long it is, what it costs. A
// card that makes you click to compare is a card that gets compared
// with somebody else's.

export default function CourseCardTile({ course }: { course: Course }) {
  const href = routes.academyCourse.replace(":slug", course.slug);
  const free = (course.price_kobo || 0) <= 0;

  return (
    <article className="acad-coursecard">
      <CourseCover course={course} />

      <div className="acad-coursecard__body">
        <h3 className="acad-coursecard__title">
          <Link to={href}>{course.title}</Link>
        </h3>
        <p className="acad-coursecard__summary">{course.summary}</p>

        {/* One line of facts, in the order somebody asks them in: how
            hard, how much of it, how long. The tool is not here any
            more, because it is on the picture directly above. */}
        <p className="acad-coursecard__facts">
          {course.level ? <span>{course.level}</span> : null}
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
          {/* The Module 1 free tag is not here any more either. It is a
              badge on the cover, where it is seen before the price
              rather than after it. */}
          <Link className="acad-coursecard__go" to={href}>
            View
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </article>
  );
}
