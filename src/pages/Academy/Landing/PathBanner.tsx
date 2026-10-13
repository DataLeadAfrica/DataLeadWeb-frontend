import { Link } from "react-router";

import "./PathBanner.css";
import type { CourseCard as Course, LearningPath } from "../../../lib/catalogue";
import CourseCover from "../ui/CourseCover";
import { ArrowIcon } from "../ui/Icons";
// plural from courseSeo, NOT from lib/learn. Both export it, but
// lib/learn is the learner area's data layer: importing one helper
// from it pulled the whole module into the landing page's bundle,
// four kilobytes of code for pages this visitor has not opened and
// may never sign in to see.
import { plural } from "../../../lib/courseSeo";
import { routes } from "../../routes";

// A learning path, as a banner with its first three covers fanned out
// beside it.
//
// WHY THE FIRST PATH GETS THIS AND THE REST DO NOT. A path is several
// courses in a deliberate order, which is the most valuable thing the
// Academy has and the hardest to notice in a list. One banner says
// "these go together" at a glance. Several banners in a row would just
// be a list again, with more scrolling, so any other paths keep the
// compact cards below.
//
// THE FAN IS THE COVERS WE ALREADY DRAW. getPaths returns only a slug,
// title, summary and cover code for each course in a path, which is
// enough for the letters but not for the area, so the covers are looked
// up by slug in the catalogue this page has already loaded. A course
// that is not there, because it was unpublished between the two
// answers, gets the neutral art. Nothing waits for it and nothing in
// the layout moves when it arrives.

type Props = { path: LearningPath; catalogue: Course[] };

export default function PathBanner({ path, catalogue }: Props) {
  const bySlug = new Map(catalogue.map((c) => [c.slug, c]));
  const fan = path.courses.slice(0, 3);
  const first = path.courses[0];

  return (
    <div className="acad-promo">
      <div className="acad-promo__words">
        <p className="acad-band__eyebrow">Go further</p>
        <h2 className="acad-h2">{path.name}</h2>
        {path.description ? <p className="acad-promo__sum">{path.description}</p> : null}

        <ol className="acad-promo__steps">
          {path.courses.map((c, i) => {
            const full = bySlug.get(c.slug);
            return (
              <li key={c.slug}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <CourseCover
                  variant="square"
                  course={{
                    slug: c.slug,
                    title: c.title,
                    cover_code: c.cover_code,
                    area: full?.area ?? null,
                    tool: full?.tool ?? null,
                  }}
                />
                <Link to={routes.academyCourse.replace(":slug", c.slug)}>
                  {c.title}
                  {c.summary ? <small>{c.summary}</small> : null}
                </Link>
              </li>
            );
          })}
        </ol>

        <p className="acad-promo__row">
          {first ? (
            <Link
              className="acad-btn acad-btn--auto"
              to={routes.academyCourse.replace(":slug", first.slug)}
            >
              Start with {first.title}
              <ArrowIcon />
            </Link>
          ) : null}
          <span className="acad-promo__count">{plural(path.courses.length, "course")}</span>
        </p>
      </div>

      {/* Decoration: every one of these courses is named in words in the
          list beside it, so a screen reader reading the fan as well
          would read the path twice. */}
      <div className="acad-fan" aria-hidden="true">
        {fan.map((c) => {
          const full = bySlug.get(c.slug);
          return (
            <span className="acad-fan__item" key={c.slug}>
              <CourseCover
                badge={false}
                course={{
                  slug: c.slug,
                  title: c.title,
                  cover_code: c.cover_code,
                  area: full?.area ?? null,
                  tool: full?.tool ?? null,
                }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
