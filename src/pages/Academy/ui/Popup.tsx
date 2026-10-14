import { useEffect, useState } from "react";
import { Link } from "react-router";

import "./Popup.css";
import CourseCover from "./CourseCover";
import { ArrowIcon } from "./Icons";
import { getLivePopup, popupShown, type LivePopup } from "../../../lib/catalogue";
import { routes } from "../../routes";

// The one popup, if there is one for this place.
//
// WHERE IT MAY APPEAR, and this is a rule rather than a habit: the
// landing page, the catalogue, a course page and My learning. NEVER a
// lesson, a check or an exam. Somebody watching a lesson is doing the
// thing we asked them to do, and somebody sitting an exam has a clock
// running. The database refuses those places too, so this is said in
// two places on purpose.
//
// ONE AT A TIME. lms_live_popup returns at most one row, so there is no
// queue and no stacking, and which one it is was decided by somebody in
// the control room rather than by whichever request came back first.
//
// NO "DO NOT SHOW AGAIN" LINK. How often a popup appears is set on the
// popup, by the person who made it: once per person, once a day, or
// every visit. A dismiss link is a promise the next campaign will break,
// and it is the thing that teaches people to close a box without
// reading it.
//
// IT WAITS. A box over the page before the page has finished arriving is
// a box over nothing, and it is the single most annoying thing a site
// does. Three seconds, and only if the tab is still in front.

type Props = {
  /** Which page is asking. The database refuses anything else. */
  place: "landing" | "courses" | "course" | "me";
};

const WAIT_MS = 3000;

export default function Popup({ place }: Props) {
  const [popup, setPopup] = useState<LivePopup | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer = 0;

    getLivePopup(place).then((got) => {
      if (!alive || !got) return;
      timer = window.setTimeout(() => {
        if (!alive || document.hidden) return;
        setPopup(got);
        setShown(true);
        // Written down the moment it is really on screen, not when it
        // was fetched: "once per person" has to mean once per person who
        // SAW it, or somebody who opened a tab and closed it has used
        // up their one.
        void popupShown(got.id);
      }, WAIT_MS);
    });

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [place]);

  if (!popup || !shown) return null;

  const to = popup.course_slug
    ? routes.academyCourse.replace(":slug", popup.course_slug)
    : popup.path_slug
      ? routes.academyPath.replace(":slug", popup.path_slug)
      : popup.url || routes.academyCourses;

  const outside = /^https?:/i.test(to);

  return (
    <div className="acad-popup" role="dialog" aria-modal="false" aria-labelledby="acad-popup-h">
      <button
        type="button"
        className="acad-popup__x"
        aria-label="Close"
        onClick={() => setShown(false)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {popup.picture === "cover" && popup.course_slug ? (
        <CourseCover
          course={{ slug: popup.course_slug, title: popup.heading }}
          variant="card"
          badge={false}
        />
      ) : popup.picture === "upload" && popup.picture_url ? (
        <img className="acad-popup__pic" src={popup.picture_url} alt="" />
      ) : null}

      <div className="acad-popup__words">
        <h2 id="acad-popup-h">{popup.heading}</h2>
        <p>{popup.message}</p>
        {outside ? (
          <a className="acad-btn" href={to} onClick={() => setShown(false)}>
            {popup.button_text}
            <ArrowIcon />
          </a>
        ) : (
          <Link className="acad-btn" to={to} onClick={() => setShown(false)}>
            {popup.button_text}
            <ArrowIcon />
          </Link>
        )}
      </div>
    </div>
  );
}
