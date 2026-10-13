import { useCallback, useEffect, useRef, useState } from "react";

import "./GoalRail.css";
import { areaGoal, areaKey } from "../../../../api/_cover-art.js";
import type { CourseCard as Course } from "../../../lib/catalogue";
import CourseCardTile from "../ui/CourseCard";
import { ArrowIcon, GoalIcon } from "../ui/Icons";

// "What do you want to do?" followed by every course, as a rail you can
// push sideways.
//
// WHY A QUESTION AND NOT A LIST OF AREAS. Somebody arriving does not
// think "I want the Visualisation area". They think "I want to build a
// dashboard". So the chips are written as the thing they want to do,
// and the area is the implementation detail behind them.
//
// THE CHIPS COME FROM THE DATA, counts and all. Nothing here is a list
// somebody has to remember to update: add a course in a new area and a
// chip for it appears, with the right number on it. An area with no
// published course has no chip, because a filter that leads to an empty
// rail is a dead end.
//
// IT DOES NOT CHANGE THE ADDRESS. Pressing a chip is a way of looking
// at this page, not a different page: somebody who presses three chips
// and then presses Back expects to leave the Academy, not to walk back
// through their own filtering. The catalogue at /lms/courses is the
// page with real, linkable filters.
//
// EVERY COURSE IS IN THE MARKUP. The rail holds the whole catalogue,
// not the first few with the rest fetched as you scroll. Find on page
// works, a screen reader can walk the lot, and there is no second
// request that can fail halfway.

type Props = { courses: Course[]; loaded: boolean };

export default function GoalRail({ courses, loaded }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [goal, setGoal] = useState("");
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  // One chip per area that actually has a published course, in the
  // order the areas first appear in the catalogue, which is newest
  // first. Built with a Map so the count and the order come from one
  // pass rather than from a filter per area.
  const counts = new Map<string, number>();
  for (const c of courses) {
    const a = (c.area || "").trim();
    if (a) counts.set(a, (counts.get(a) || 0) + 1);
  }
  const chips = [
    { area: "", label: "All courses", key: "x", n: courses.length },
    ...[...counts.entries()].map(([area, n]) => ({
      area,
      label: areaGoal(area),
      key: areaKey(area),
      n,
    })),
  ];

  const shown = goal ? courses.filter((c) => (c.area || "").trim() === goal) : courses;

  // Where the rail is, so the arrows can switch off at the ends and the
  // dots can show which part of the list you are looking at. Read from
  // the element rather than tracked separately, because the rail can
  // also be moved by a finger, a trackpad, a keyboard or a browser
  // restoring a scroll position, and only the element knows about all
  // of those.
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft > max - 8);

    const first = el.firstElementChild as HTMLElement | null;
    const per = Math.max(1, Math.round(el.clientWidth / (first?.offsetWidth || 1)));
    const count = Math.max(1, Math.ceil(el.children.length / per));
    setPages(count);
    setPage(max > 0 ? Math.round((el.scrollLeft / max) * (count - 1)) : 0);
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    // ResizeObserver rather than a window resize listener: the rail
    // also changes width when something else on the page does, and a
    // phone rotating does not always fire resize before layout.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, shown.length]);

  function push(by: number) {
    const el = track.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: by * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }

  if (loaded && courses.length === 0) return null;

  return (
    <section className="acad-band">
      <div className="acad-band__head">
        <div>
          <p className="acad-band__eyebrow">Start here</p>
          <h2 className="acad-h2">What do you want to do?</h2>
        </div>
      </div>

      {loaded ? (
        <div className="acad-goals" role="group" aria-label="Show courses for a goal">
          {chips.map((c) => (
            <button
              key={c.area || "all"}
              type="button"
              className="acad-goal"
              // aria-pressed rather than a selected class on its own, so
              // a screen reader says which chip is on.
              aria-pressed={goal === c.area}
              onClick={() => {
                setGoal(c.area);
                // Back to the first card, or the rail stays scrolled
                // into a part of a list that is now shorter.
                if (track.current) track.current.scrollLeft = 0;
              }}
            >
              <GoalIcon area={c.key} />
              {/* The space is written out, because without it the chip
                  reads to a screen reader as "Analyse data2". */}
              {c.label}{" "}
              <b>{c.n}</b>
            </button>
          ))}
        </div>
      ) : null}

      <div className="acad-crail">
        {!loaded ? (
          <div className="acad-crail__track" aria-hidden="true">
            <div className="acad-skeleton" />
            <div className="acad-skeleton" />
            <div className="acad-skeleton" />
          </div>
        ) : (
          <>
            <div
              className="acad-crail__track"
              ref={track}
              onScroll={measure}
              // Focusable, because a rail that can only be moved with a
              // finger or a mouse cannot be used from a keyboard at
              // all. With this, the arrow keys scroll it.
              tabIndex={0}
              role="group"
              aria-label={goal ? `Courses: ${areaGoal(goal)}` : "All courses"}
            >
              {shown.map((c) => (
                <CourseCardTile key={c.id} course={c} />
              ))}
            </div>
            <button
              type="button"
              className="acad-crail__btn acad-crail__btn--prev"
              aria-label="Previous courses"
              disabled={atStart}
              onClick={() => push(-1)}
            >
              <ArrowIcon />
            </button>
            <button
              type="button"
              className="acad-crail__btn acad-crail__btn--next"
              aria-label="More courses"
              disabled={atEnd}
              onClick={() => push(1)}
            >
              <ArrowIcon />
            </button>
          </>
        )}
      </div>

      {/* The dots say how much more there is, which the rail alone does
          not on a phone where the arrows are hidden. Decoration only:
          they are not buttons, and the rail is the thing you move. */}
      {loaded && pages > 1 ? (
        <p className="acad-crail__dots" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <i key={i} className={i === page ? "is-on" : ""} />
          ))}
        </p>
      ) : null}
    </section>
  );
}
