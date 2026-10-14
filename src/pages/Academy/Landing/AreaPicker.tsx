import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import "./AreaPicker.css";
import CourseCover from "../ui/CourseCover";
import { ArrowIcon, GoalIcon } from "../ui/Icons";
import { asLength, asPrice, type LandingArea } from "../../../lib/catalogue";
import { routes } from "../../routes";

// The hero's picker: choose an area, then a tool, and the course opens
// directly under the row the tool is in.
//
// WHAT IT REPLACED, and why. The old rack listed the tools that had a
// published course and cycled through them by itself. Two things were
// wrong with that. It could only ever show what we already had, so a
// visitor could not see that the Academy covers Databases at all until
// there was a Databases course; and the cycling moved the thing
// somebody was reading.
//
// Now every tool of every area is a key, whether or not a course exists
// for it yet, and a key with nothing behind it says "Coming soon". That
// is the honest shape of the catalogue: here is what we teach, and here
// is what is ready.
//
// THE AREA TABS WRAP ONTO AS MANY LINES AS THEY NEED. Never a row that
// scrolls sideways: a sideways row on a phone hides half the areas
// behind a gesture nobody is told about, and the hidden half is always
// the end of the alphabet.
//
// THE DETAIL OPENS UNDER ITS OWN ROW, not at the bottom of the list.
// With three keys to a row, a panel at the bottom is a long way from
// the key that opened it, and on a phone it is off the screen. It is
// placed after the last key of the row the chosen key is in, with a
// small tip pointing back up at it, so the connection is visible rather
// than remembered. That needs the number of columns, which is a
// rendered fact rather than a knowable one, so it is measured.
//
// NOTHING MOVES BY ITSELF. No cycling, no carousel. A person reading a
// course summary is not interrupted.

type Props = {
  areas: LandingArea[];
  /** Shown while the areas are still being fetched. */
  waiting?: boolean;
};

export default function AreaPicker({ areas, waiting = false }: Props) {
  const [areaSlug, setAreaSlug] = useState("");
  const [openTool, setOpenTool] = useState("");
  const [columns, setColumns] = useState(1);
  const keysRef = useRef<HTMLDivElement | null>(null);

  // The first area with something in it, so the hero never opens on an
  // empty grid. Recomputed when the areas arrive rather than held in
  // state, so there is no moment where the chosen area does not exist.
  const area =
    areas.find((a) => a.slug === areaSlug) ||
    areas.find((a) => a.tools.length > 0) ||
    areas[0] ||
    null;

  // How many keys fit on a row. Read from the rendered grid, because it
  // is set by CSS at three widths and nothing here should have to know
  // which. Watched rather than measured once: a browser window being
  // dragged narrower changes it without a reload.
  useEffect(() => {
    const el = keysRef.current;
    if (!el) return;
    const read = () => {
      const cols = getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length;
      setColumns(cols > 0 ? cols : 1);
    };
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, [area?.slug, areas.length]);

  if (waiting) {
    return <div className="acad-hero__waiting" aria-hidden="true" />;
  }
  if (!area) return null;

  const tools = area.tools;
  const openIndex = tools.findIndex((t) => t.name === openTool);
  // The last key of the row the open key is in. The panel goes after
  // that one, so it spans the row rather than splitting it.
  const afterIndex =
    openIndex < 0
      ? -1
      : Math.min(tools.length - 1, Math.floor(openIndex / columns) * columns + columns - 1);

  const open = openIndex >= 0 ? tools[openIndex] : null;

  return (
    <div className="acad-pick" aria-label="Find a course by area">
      <div className="acad-pick__top">
        <span>Pick an area, then a course</span>
        <span className="acad-pick__eg">Example courses</span>
      </div>

      <div className="acad-pick__areas" role="tablist" aria-label="Areas">
        {areas.map((a) => (
          <button
            key={a.slug}
            type="button"
            role="tab"
            aria-selected={a.slug === area.slug}
            className={`acad-atab${a.slug === area.slug ? " is-on" : ""}`}
            onClick={() => {
              setAreaSlug(a.slug);
              setOpenTool("");
            }}
          >
            <GoalIcon area={a.icon_key} />
            {a.name}
          </button>
        ))}
      </div>

      <div className="acad-pick__keys" ref={keysRef}>
        {/* The keys and the open detail are FLAT children of the grid,
            not a key wrapped in a cell. The detail spans the whole row
            (grid-column: 1 / -1), which it can only do if it is a grid
            item itself. Wrapped in a cell it would sit inside one
            column and squeeze the key above it. */}
        {tools.map((t, i) => (
          <Fragment key={t.name}>
            <button
              type="button"
              className={`acad-pick__key${t.name === openTool ? " is-on" : ""}`}
              aria-expanded={t.name === openTool}
              onClick={() => setOpenTool(t.name === openTool ? "" : t.name)}
            >
              {t.name}
              <small>
                {t.course ? (t.course.kind === "skill" ? "Skill" : "Tool") : "Coming soon"}
              </small>
            </button>

            {i === afterIndex && open ? (
              <div
                className="acad-pick__detail"
                role="region"
                aria-label={open.course ? open.course.title : open.name}
              >
                {/* The tip points back at the key that opened this, so
                    the connection is on screen rather than remembered.
                    Its position is the key's place in its own row. */}
                <span
                  className="acad-pick__tip"
                  style={{ left: `${((openIndex % columns) + 0.5) / columns * 100}%` }}
                  aria-hidden="true"
                />
                {open.course ? (
                  <>
                    <div className="acad-pick__row">
                      <CourseCover
                        course={{
                          slug: open.course.slug,
                          title: open.course.title,
                          tool: open.name,
                          area: area.name,
                          cover_code: open.course.cover_code,
                        }}
                        variant="square"
                        badge={false}
                      />
                      <div className="acad-pick__words">
                        <span className="acad-pick__area">{area.name}</span>
                        <b>{open.course.title}</b>
                        <small>
                          {open.course.lesson_count} lesson
                          {open.course.lesson_count === 1 ? "" : "s"}
                          {" · "}
                          {asLength(open.course.total_seconds)}
                          {open.course.level ? ` · ${open.course.level}` : ""}
                        </small>
                      </div>
                      <span
                        className={`acad-pick__price${
                          (open.course.price_kobo || 0) <= 0 ? " is-free" : ""
                        }`}
                      >
                        {asPrice(open.course.price_kobo)}
                      </span>
                    </div>
                    <Link
                      className="acad-btn acad-pick__see"
                      to={routes.academyCourse.replace(":slug", open.course.slug)}
                    >
                      See course
                      <ArrowIcon />
                    </Link>
                  </>
                ) : (
                  // A tool we teach that has no course yet. Said plainly
                  // rather than left out: the list of tools is what the
                  // Academy is about, and a gap in it is information.
                  <p className="acad-pick__soon">
                    <b>{open.name}</b>
                    <span>
                      Coming soon. There is no {open.name} course yet, and this is where it
                      will be.
                    </span>
                  </p>
                )}
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
