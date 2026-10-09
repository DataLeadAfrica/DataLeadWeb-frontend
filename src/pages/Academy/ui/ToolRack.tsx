import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import "./ToolRack.css";
import {
  asLength,
  asPrice,
  coverCode,
  type CourseCard,
} from "../../../lib/catalogue";
import { routes } from "../../routes";

// The hero of the landing page: one key per tool that has a published
// course, and the course appears underneath when a key is pressed.
//
// WHY THIS RATHER THAN A PICTURE. The catalogue is the most interesting
// thing the Academy has, so it is the hero. It is also text, which
// arrives with the page and costs nothing to load, where a hero image is
// the heaviest thing on a page and the usual reason a phone sees nothing
// for two seconds.
//
// THE KEYS ARE NEVER A HARD CODED LIST. They are the tools that actually
// have a published course. A key for a tool with nothing behind it is a
// promise we have not kept, and a tool added next month appears here on
// its own.
//
// It cycles slowly on its own, so somebody who does nothing still sees
// more than one. It stops the moment anybody touches it, when the tab is
// hidden, and when the reader has asked for less movement.

const CYCLE_MS = 3200;

type Props = { courses: CourseCard[] };

export default function ToolRack({ courses }: Props) {
  // One course per tool: whichever was published most recently, because
  // that is the one worth showing.
  const byTool = new Map<string, CourseCard>();
  for (const c of courses) {
    const tool = (c.tool || "").trim();
    if (!tool) continue;
    const seen = byTool.get(tool);
    if (!seen) {
      byTool.set(tool, c);
      continue;
    }
    const a = c.published_at ? Date.parse(c.published_at) : 0;
    const b = seen.published_at ? Date.parse(seen.published_at) : 0;
    if (a > b) byTool.set(tool, c);
  }
  const tools = [...byTool.keys()].sort((a, b) => a.localeCompare(b));

  const [picked, setPicked] = useState(0);
  const [cycling, setCycling] = useState(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!cycling || tools.length < 2) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    function tick() {
      if (document.visibilityState === "hidden") return;
      setPicked((p) => (p + 1) % tools.length);
    }
    timer.current = window.setInterval(tick, CYCLE_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [cycling, tools.length]);

  if (tools.length === 0) return null;

  const current = byTool.get(tools[Math.min(picked, tools.length - 1)]);

  return (
    <div className="acad-rack">
      <div className="acad-rack__top">
        <p className="acad-rack__label">Pick a tool</p>
      </div>

      <div className="acad-rack__keys" role="tablist" aria-label="Courses by tool">
        {tools.map((tool, i) => (
          <button
            key={tool}
            type="button"
            role="tab"
            aria-selected={i === picked}
            className={
              `acad-rack__key${i === picked ? " is-on" : ""}` +
              // A long tool name gets smaller type rather than spilling
              // out of its key. "KoboToolbox" is eleven characters in a
              // key about eight wide, and it used to sit over the key
              // beside it. Two steps are enough for every tool name we
              // are ever likely to have; past that the name wraps.
              (tool.length > 12
                ? " acad-rack__key--tiny"
                : tool.length > 8
                  ? " acad-rack__key--long"
                  : "")
            }
            onClick={() => {
              setPicked(i);
              // Somebody has taken over. Stop moving things under them.
              setCycling(false);
            }}
          >
            <span>{tool}</span>
          </button>
        ))}
      </div>

      {current ? (
        <Link
          className="acad-rack__course"
          to={routes.academyCourse.replace(":slug", current.slug)}
        >
          <span className="acad-rack__glyph" aria-hidden="true">
            {coverCode(current)}
          </span>
          <span className="acad-rack__words">
            <b>{current.title}</b>
            <small>
              {current.lesson_count} lesson{current.lesson_count === 1 ? "" : "s"}
              {" · "}
              {asLength(current.total_seconds)}
              {current.level ? ` · ${current.level}` : ""}
            </small>
          </span>
          <span className="acad-rack__price">{asPrice(current.price_kobo)}</span>
        </Link>
      ) : null}
    </div>
  );
}
