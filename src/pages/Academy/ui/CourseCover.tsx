import { useState } from "react";

import "../../../css/dla-mark.css";
import "./CourseCover.css";
import {
  areaKey,
  coverArt,
  coverCode,
  coverName,
  coverNameSize,
  coverNameWraps,
  type CoverCourse,
} from "../../../../api/_cover-art.js";

// A course's picture.
//
// WHY EVERY COURSE HAS ONE. A catalogue of text rows reads like a
// spreadsheet. Pictures are what make a course list feel like
// something to browse rather than something to search. We do not use
// photographs of people and we are not buying stock pictures, so every
// course gets a cover DRAWN FROM ITS OWN DETAILS, in code. A new
// course has its picture the moment it is published and nobody has to
// make one.
//
// HOW IT IS PUT TOGETHER, and the division matters:
//
//   The ART is an SVG of shapes, from api/_cover-art.js. No words in
//   it at all.
//
//   The WORDS are real HTML laid over the top: the label, the tool
//   name, the badge. So they are selectable, translatable, readable by
//   a screen reader, and they use the fonts the page already has. A
//   font that fails to load cannot turn a cover into a row of boxes.
//
//   The BACKGROUND is a CSS gradient on this element, keyed off the
//   area. Not in the SVG, because a gradient in an SVG needs an id,
//   and twenty covers on one page would all define the same one.
//
// SETTING THE ART AS HTML IS SAFE, and this is the reason: every
// number in that string is one api/_cover-art.js generated itself. The
// slug is used only to seed the random numbers. The title, the tool
// and the summary never go inside the SVG, so there is nothing from
// the database in there to escape. See the note at the top of that
// file.

type Props = {
  course: {
    slug?: string;
    title?: string;
    tool?: string | null;
    area?: string | null;
    cover_code?: string | null;
    price_kobo?: number | null;
    first_module_free?: boolean | null;
  };
  /** card is 16:9, square is a thumbnail, og is the share picture. */
  variant?: "card" | "square" | "og";
  /** Off on the course page and in the path fan, where it would repeat. */
  badge?: boolean;
  /** The course title, drawn into the picture. Only the share picture does this. */
  withTitle?: boolean;
  /**
   * A real picture, once staff can upload one. PHASE 6, NOT NOW:
   * nothing passes this yet. It is here so the day somebody does, the
   * only change is the thing that passes it.
   *
   * If it fails to load, the designed cover is drawn instead. A broken
   * image icon where a course picture should be is worse than the
   * cover we can always draw.
   */
  imageUrl?: string | null;
};

export default function CourseCover({
  course,
  variant = "card",
  badge = true,
  withTitle = false,
  imageUrl = null,
}: Props) {
  const [imageBroken, setImageBroken] = useState(false);

  const key = areaKey(course.area);
  const art = coverArt({ ...(course as CoverCourse), variant });
  const name = coverName(course as CoverCourse);
  const code = coverCode(course as CoverCourse);

  const free = (course.price_kobo || 0) <= 0;
  const firstFree = !free && Boolean(course.first_module_free);

  const classes =
    `acad-cover acad-cover--${variant} acad-cv-${key}` +
    (variant === "og" ? " acad-cover--og" : "");

  // A cover is decoration. On a card the title is directly underneath
  // it, so a screen reader announcing both would read the course name
  // twice and the tool name from a picture that carries no information
  // the words do not.
  if (variant === "square") {
    return (
      <span className={classes} aria-hidden="true">
        <Art art={art} imageUrl={imageUrl} broken={imageBroken} onBroken={setImageBroken} />
        <b className="acad-cover__code">{code}</b>
      </span>
    );
  }

  return (
    <span className={classes} aria-hidden="true">
      <Art art={art} imageUrl={imageUrl} broken={imageBroken} onBroken={setImageBroken} />
      <span className="acad-cover__label">
        {/* The orange cover needs the mark on a white pill, because the
            mark was not drawn to sit on orange. */}
        <i className={key === "pr" ? "dla-mark dla-mark--pill" : "dla-mark"} />
        Data-Lead Academy
      </span>
      {/* A name with a space in it and more than nine characters goes
          on two lines, sized from its longest word. "Looker Studio"
          and "Research methods" used to come out as a two letter code,
          which tells a reader nothing. */}
      <b
        className={
          "acad-cover__name" + (coverNameWraps(name) ? " acad-cover__name--two" : "")
        }
        style={{ fontSize: `${coverNameSize(name)}cqw` }}
      >
        {name}
      </b>
      {withTitle && course.title ? (
        <span className="acad-cover__title">{course.title}</span>
      ) : null}
      {badge && free ? (
        <span className="acad-cover__badge acad-cover__badge--free">Free</span>
      ) : badge && firstFree ? (
        <span className="acad-cover__badge">Module 1 free</span>
      ) : null}
    </span>
  );
}

/**
 * The picture itself: a staff photograph if there is one and it loads,
 * the drawn art otherwise.
 */
function Art({
  art,
  imageUrl,
  broken,
  onBroken,
}: {
  art: string;
  imageUrl: string | null;
  broken: boolean;
  onBroken: (b: boolean) => void;
}) {
  if (imageUrl && !broken) {
    return (
      <img
        className="acad-cover__photo"
        src={imageUrl}
        // width and height so the box is the right shape before the
        // picture arrives, and nothing on the page jumps when it does.
        width={320}
        height={180}
        loading="lazy"
        decoding="async"
        alt=""
        onError={() => onBroken(true)}
      />
    );
  }
  // Safe: see the note at the top of this file.
  return <span className="acad-cover__wrap" dangerouslySetInnerHTML={{ __html: art }} />;
}
