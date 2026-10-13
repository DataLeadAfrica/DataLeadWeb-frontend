import { useEffect, useState } from "react";
import { Link } from "react-router";

import "./component.css";
import { getCatalogue } from "../../lib/catalogue";
import { ACADEMY_PUBLIC } from "../../lib/site";
import { routes } from "../../pages/routes";

// A small band on the bootcamps page pointing at the Academy.
//
// WHY IT IS HERE. /courses is one of the strongest pages on the site: it
// has the most links to it and the most visitors. A link from it to
// /lms/courses is worth more to the Academy in search than anything the
// Academy can do to itself, and it is also plainly useful to somebody
// reading about a twelve week bootcamp who would rather learn one tool
// at a time.
//
// IT HIDES ITSELF WHEN THERE IS NOTHING TO SHOW. A link to an empty
// catalogue is worse than no link: the visitor bounces, and the page
// they land on has nothing on it for a search engine either. It appears
// the moment the first course is published, and not before.
//
// AND IT HIDES ITSELF UNTIL LAUNCH DAY. While ACADEMY_PUBLIC is false
// this band never shows, whatever the catalogue holds. /courses is the
// busiest page on the site, and on 9 October it was showing this band
// pointing at a test course, which anybody could sign up for and earn a
// real certificate from. The switch is checked before the catalogue is
// even asked for, so there is no moment where it appears and then goes.

export default function AcademyBand() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!ACADEMY_PUBLIC) return;
    let alive = true;
    getCatalogue().then((got) => {
      // Only a successful answer may set the count. If we could not ask,
      // the band stays hidden rather than claiming a number.
      if (alive && got.ok) setCount(got.courses.length);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The switch first, and on its own line: a reader should not have to
  // work out which of two conditions hid the band.
  if (!ACADEMY_PUBLIC) return null;
  if (count === 0) return null;

  return (
    <section className="acadband">
      <div className="acadband__in">
        <div>
          <p className="acadband__eyebrow">Data-Lead Academy</p>
          <h2 className="acadband__title">
            Would you rather learn one tool at a time?
          </h2>
          <p className="acadband__lead">
            {count} self paced course{count === 1 ? "" : "s"} in the tools our
            bootcamps teach, in short video lessons you can take at your own
            speed, with the same certificate at the end.
          </p>
        </div>
        <Link className="acadband__go" to={routes.academyCourses}>
          Browse Academy courses
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
