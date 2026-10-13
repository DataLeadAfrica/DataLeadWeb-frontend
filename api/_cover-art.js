// The designed cover every course gets, drawn in code from its own
// details.
//
// THIS IS THE ONE COPY. Plain JavaScript with no imports, the same
// reason and the same pattern as api/_seo-rules.js: the React pages
// need it, api/og.js needs it to draw the share picture, and
// tests/cover-art.test.mjs needs to run it in plain Node. An edge
// function cannot import TypeScript, so the shape lives in
// _cover-art.d.ts beside this file.
//
// If the picture a person sees on the card and the picture that turns
// up in their WhatsApp group were drawn by two different pieces of
// code, they would drift apart, and the one place that would show is
// the one place nobody looks until a learner mentions it.
//
// =====================================================================
// WHAT THIS RETURNS, AND WHY IT IS SO RESTRICTED
// =====================================================================
//
// SHAPES ONLY. No <text>. Every word on a cover is real HTML laid over
// it: the tool name, the label and the badge. So the words are
// selectable, translatable and readable by a screen reader, the fonts
// are the ones the page already loaded, and a font that fails to load
// cannot turn a cover into a row of boxes.
//
// NO id, defs, gradient, pattern, filter or clipPath. Two reasons, and
// both have bitten real sites. An id is global to the document, so
// twenty covers on one page would each define the same gradient id and
// every one of them would quietly draw the twentieth. And the image
// renderer api/og.js uses supports a deliberately small subset of SVG:
// a filter or a clipPath comes back as a blank rectangle. Background
// colour is a CSS gradient on the HTML element instead, which is where
// it belongs.
//
// NOTHING FROM THE DATABASE GOES INSIDE THE SVG. Every number in the
// output is one this file generated. The slug is used only to seed the
// random numbers; the title, the tool and the summary never appear.
// That is what makes it safe to set the result as HTML.
//
// DETERMINISTIC. The same slug gives byte for byte the same picture on
// every phone, on the server and in the share picture. Never
// Math.random: a cover that changed on every render would flicker on
// the page and never match its own share picture.

/**
 * The background and the ink for each area.
 *
 * THERE ARE TWO COPIES OF THESE COLOURS AND THERE HAS TO BE. The
 * browser needs them as CSS custom properties, because the cover's
 * background is a CSS gradient on the HTML element rather than
 * something in the SVG, and CSS cannot read a JavaScript object. The
 * share picture needs them here, because api/og.js is given an object
 * and not a stylesheet.
 *
 * So they are written twice: here, and in
 * src/pages/Academy/ui/CourseCover.css. What keeps the two honest is
 * tests/cover-art.test.mjs, which reads that stylesheet and fails if a
 * single value disagrees with this table. Change one, and the test
 * tells you to change the other.
 */
export const AREA_PAINT = {
  an: { bg: "linear-gradient(155deg, #fff6ef 0%, #ffe3cd 100%)", ink: "#16151b" },
  vi: { bg: "linear-gradient(155deg, #ffffff 0%, #f1f3f7 100%)", ink: "#16151b" },
  dc: { bg: "linear-gradient(155deg, #f2f5f9 0%, #dfe6ef 100%)", ink: "#16151b" },
  pr: { bg: "linear-gradient(135deg, #ff9550 0%, #f56e0f 52%, #de5a00 100%)", ink: "#ffffff" },
  x: { bg: "linear-gradient(155deg, #fff6ef 0%, #f3eee9 100%)", ink: "#16151b" },
};

/** The area a course belongs to, as a short key for the art. */
const AREA_KEY = {
  Analysis: "an",
  Visualisation: "vi",
  "Data collection": "dc",
  Programming: "pr",
};

/**
 * Every area the art knows, with the friendly words the landing page
 * uses for its goal chips.
 *
 * An area that is not here is not an error. It gets the neutral art and
 * its own name, so adding "Qualitative methods" to the database next
 * year puts a working cover and a working chip on the site without
 * anybody touching this file.
 */
export const AREAS = [
  { area: "Analysis", key: "an", goal: "Analyse data" },
  { area: "Visualisation", key: "vi", goal: "Build dashboards" },
  { area: "Data collection", key: "dc", goal: "Collect clean data" },
  { area: "Programming", key: "pr", goal: "Start coding" },
];

/** The art key for an area, which is "x", the neutral one, for anything else. */
export function areaKey(area) {
  return AREA_KEY[String(area || "").trim()] || "x";
}

/** The friendly goal wording, or the area's own name if we have none. */
export function areaGoal(area) {
  const name = String(area || "").trim();
  const known = AREAS.find((a) => a.area === name);
  return known ? known.goal : name || "Other";
}

// =====================================================================
// THE SEEDED RANDOM NUMBERS
// =====================================================================

/**
 * mulberry32, seeded from a string.
 *
 * Small, fast, and good enough for scattering dots: this is decoration,
 * not cryptography. What matters is that it is the SAME everywhere, so
 * it is written out here rather than taken from anywhere that might
 * differ between Node and a browser.
 */
function seeded(text) {
  let a = 7;
  for (const ch of String(text || "cover")) {
    a = Math.imul(a ^ ch.charCodeAt(0), 2654435761);
  }
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One decimal place. Keeps every cover small and the output stable. */
function f1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * A whole number, for coordinates.
 *
 * The art is drawn in a 320 by 180 box and then scaled up to whatever
 * the cover is, so half a unit is about a sixth of a pixel on a 300
 * pixel card: not a difference anybody can see. It is two characters
 * on every number though, and a cover carries about forty of them,
 * inline in the HTML of every card on the page.
 * Opacities still use f1, because there the decimal is the value.
 */
function i0(n) {
  return Math.round(n);
}

// =====================================================================
// THE PIECES EVERY COVER SHARES
// =====================================================================

const INK = "#16151b";
const SIGNAL = "#f56e0f";

/**
 * The faint graph paper, the same grid the Academy's pages sit on.
 *
 * ONLY THE SHARE PICTURE USES THIS. On a page the grid is two CSS
 * gradients on .acad-cover, because it is a background and that is
 * where a background belongs: drawn here it was about 290 characters
 * of identical markup inside every cover, inline in the HTML, on a
 * landing page that carries nine of them. api/og.js has no stylesheet
 * to put it in, so it still gets it here.
 */
function grid(colour, opacity) {
  let d = "";
  for (let x = 20; x < 320; x += 20) d += `M${x} 0V180`;
  for (let y = 20; y < 180; y += 20) d += `M0 ${y}H320`;
  return `<path d="${d}" stroke="${colour}" stroke-opacity="${opacity}" stroke-width=".6" fill="none"/>`;
}

/**
 * The grid's colour, per area.
 *
 * The orange cover needs a white grid; the near white one needs a
 * fainter dark grid than the rest. These are the same values
 * CourseCover.css sets as --cv-grid, and tests/cover-art.test.mjs
 * fails if the two ever disagree. See AREA_PAINT for why there are
 * two copies.
 */
export const AREA_GRID = {
  an: "rgba(22, 21, 27, 0.06)",
  vi: "rgba(22, 21, 27, 0.05)",
  dc: "rgba(22, 21, 27, 0.06)",
  pr: "rgba(255, 255, 255, 0.12)",
  x: "rgba(22, 21, 27, 0.06)",
};

const GRID_INK = {
  an: [INK, ".06"],
  vi: [INK, ".05"],
  dc: [INK, ".06"],
  pr: ["#ffffff", ".12"],
  x: [INK, ".06"],
};

/** The grid, but only for the share picture. A page uses CSS. */
function gridFor(variant, key) {
  if (variant !== "og") return "";
  const [colour, opacity] = GRID_INK[key] || GRID_INK.x;
  return grid(colour, opacity);
}

/** Three rings and a dot, the Academy's quiet signature. */
function rings(cx, cy, colour, opacity) {
  return (
    [70, 48, 28]
      .map(
        (r, i) =>
          `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colour}" stroke-opacity="${f1(
            opacity * (i + 1),
          )}" stroke-width="1"/>`,
      )
      .join("") +
    `<circle cx="${cx}" cy="${cy}" r="4" fill="${colour}" fill-opacity="${f1(
      opacity * 5,
    )}"/>`
  );
}

// =====================================================================
// THE ART, ONE PER AREA
//
// Each one draws the WORK, not a symbol of it. A course about analysing
// survey data gets a scatter with a fitted line through it, because
// that is what the course produces. It is the difference between a
// picture and a clip art icon.
//
// All of them leave the left third quiet, because the tool name sits
// there in HTML and has to stay readable.
// =====================================================================

const ART = {
  /** Analysis: a scatter with a fitted line, on peach. */
  an(r, g) {
    let dots = "";
    const slope = -(0.32 + r() * 0.3);
    // Twenty, not thirty. A scatter reads as a scatter from about
    // fifteen points; the extra ten were three hundred characters per
    // cover of markup inside the HTML of every card on the page, for a
    // cloud nobody could tell apart from this one.
    for (let i = 0; i < 20; i++) {
      const x = 158 + r() * 148;
      const y = Math.max(18, Math.min(160, 150 + slope * (x - 158) + (r() - 0.5) * 48));
      dots += `<circle cx="${i0(x)}" cy="${i0(y)}" r="${i0(2.2 + r() * 1.4)}"/>`;
    }
    let lit = "";
    for (let i = 0; i < 3; i++) {
      const x = 180 + i * 44 + r() * 16;
      const y = 150 + slope * (x - 158) + (r() - 0.5) * 10;
      lit += `<circle cx="${i0(x)}" cy="${i0(y)}" r="4.6" fill="${SIGNAL}"/>`;
      if (i === 1) {
        lit +=
          `<circle cx="${f1(x)}" cy="${f1(y)}" r="11" fill="none" stroke="${SIGNAL}" stroke-opacity=".5"/>` +
          `<circle cx="${f1(x)}" cy="${f1(y)}" r="19" fill="none" stroke="${SIGNAL}" stroke-opacity=".22"/>`;
      }
    }
    return (
      g +
      rings(292, 28, SIGNAL, 0.07) +
      `<path d="M152 16V164H312" fill="none" stroke="${INK}" stroke-opacity=".28" stroke-width="1.2"/>` +
      `<g fill="${INK}" fill-opacity=".5">${dots}</g>` +
      `<path d="M150 ${i0(150 + slope * -8)}L314 ${i0(
        150 + slope * 156,
      )}" stroke="${SIGNAL}" stroke-width="2.4" stroke-linecap="round"/>` +
      lit
    );
  },

  /** Visualisation: bars with a trend line over them, on white. */
  vi(r, g) {
    let bars = "";
    const tops = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const h = Math.min(132, 34 + i * 10 + r() * 34);
      const x = 158 + i * 19;
      tops.push([x + 6, 158 - h]);
      bars += `<rect x="${x}" y="${i0(158 - h)}" width="12" height="${i0(
        h,
      )}" rx="3" fill="${i === n - 2 ? SIGNAL : INK}" fill-opacity="${
        i === n - 2 ? "1" : ".12"
      }"/>`;
    }
    const line = tops
      .map((p, i) => (i ? "L" : "M") + i0(p[0]) + " " + i0(p[1] - 10))
      .join("");
    const knots = tops
      .map(
        (p) =>
          `<circle cx="${i0(p[0])}" cy="${i0(
            p[1] - 10,
          )}" r="2.4" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`,
      )
      .join("");
    const ref = i0(158 - 60 - r() * 20);
    return (
      g +
      rings(40, 30, SIGNAL, 0.06) +
      `<path d="M150 ${ref}H314" stroke="${SIGNAL}" stroke-dasharray="3 4" stroke-opacity=".7"/>` +
      bars +
      `<path d="M150 158.5H314" stroke="${INK}" stroke-opacity=".35"/>` +
      `<path d="${line}" fill="none" stroke="${INK}" stroke-width="1.4"/>` +
      knots
    );
  },

  /** Data collection: a survey form on a card, on cool grey. */
  dc(r, g) {
    let rows = "";
    for (let i = 0; i < 5; i++) {
      const y = 60 + i * 21;
      const ticked = i === 4 ? false : r() < 0.62;
      rows +=
        `<rect x="183" y="${y}" width="11" height="11" rx="3" fill="${
          ticked ? SIGNAL : "#fff"
        }" stroke="${ticked ? SIGNAL : INK}" stroke-opacity="${ticked ? "1" : ".3"}"/>` +
        (ticked
          ? `<path d="M185.5 ${
              y + 5.8
            }l2.4 2.4 4.2-4.6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
          : "") +
        `<rect x="201" y="${y + 3}" width="${i0(
          40 + r() * 40,
        )}" height="5" rx="2.5" fill="${INK}" fill-opacity=".2"/>`;
    }
    return (
      g +
      rings(296, 150, SIGNAL, 0.07) +
      `<g transform="rotate(-7 232 96)">` +
      `<rect x="176" y="28" width="122" height="150" rx="14" fill="${INK}" fill-opacity=".07"/>` +
      `<rect x="168" y="20" width="122" height="150" rx="14" fill="#fff" stroke="${INK}" stroke-opacity=".12"/>` +
      `<path d="M168 34a14 14 0 0 1 14-14h94a14 14 0 0 1 14 14v8H168z" fill="${SIGNAL}"/>` +
      `<rect x="180" y="28" width="44" height="5" rx="2.5" fill="#fff" fill-opacity=".85"/>` +
      rows +
      `<rect x="183" y="${60 + 5 * 21}" width="92" height="14" rx="7" fill="${INK}"/>` +
      `</g>`
    );
  },

  /** Programming: lines of code, on the orange. */
  pr(r, g) {
    const indents = [0, 1, 2, 2, 1, 2, 3, 2, 0];
    let lines = "";
    let caret = "";
    indents.forEach((depth, i) => {
      let x = 168 + depth * 12;
      const y = 46 + i * 13;
      const tokens = 1 + Math.floor(r() * 3);
      for (let j = 0; j < tokens; j++) {
        const w = i0(10 + r() * 30);
        lines += `<rect x="${i0(
          x,
        )}" y="${y}" width="${w}" height="6" rx="3" fill="#fff" fill-opacity="${
          j === 0 ? ".95" : ".5"
        }"/>`;
        x += w + 5;
      }
      if (i === 6) {
        caret = `<rect class="acad-cover__caret" x="${i0(
          x + 1,
        )}" y="${y - 2}" width="5" height="10" rx="1" fill="#fff"/>`;
      }
    });
    return (
      g +
      rings(300, 24, "#ffffff", 0.06) +
      `<path d="M150 18V168" stroke="#fff" stroke-opacity=".3"/>` +
      lines +
      caret
    );
  },

  /**
   * Anything else, or nothing at all: the rings and a constellation.
   *
   * This one is deliberately abstract, because it is drawn for an area
   * nobody has written art for and it must not claim to be about
   * anything. It still has to vary, though: when staff add an area next
   * year and put five courses in it, five identical covers in a row read
   * as a broken page. So the ring centre moves a little and the points
   * are scattered from the slug, the same as every other cover.
   */
  x(r, g) {
    const cx = 232 + r() * 22;
    const cy = 82 + r() * 20;
    const pts = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + r() * 0.7;
      const d = 34 + r() * 44;
      pts.push([i0(cx + Math.cos(a) * d), i0(cy + Math.sin(a) * d * 0.72)]);
    }
    let web = "";
    for (let i = 1; i < pts.length; i++) {
      web += `M${pts[i - 1][0]} ${pts[i - 1][1]}L${pts[i][0]} ${pts[i][1]}`;
    }
    const dots = pts
      .map(
        (p, i) =>
          `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 2 ? "4.6" : i0(2 + r() * 1.6)}" fill="${
            i === 2 ? SIGNAL : INK
          }" fill-opacity="${i === 2 ? "1" : ".42"}"/>`,
      )
      .join("");
    return (
      g +
      rings(i0(cx), i0(cy), SIGNAL, 0.08) +
      `<path d="${web}" fill="none" stroke="${INK}" stroke-opacity=".2" stroke-width="1"/>` +
      dots
    );
  },
};

// =====================================================================
// THE ONE FUNCTION
// =====================================================================

/**
 * The cover art for a course, as an SVG string.
 *
 * variant:
 *   "card"    16:9, the whole picture. The default
 *   "square"  the right hand side only, for a thumbnail. The tool name
 *             does not fit in a square, so the left third, which the
 *             art deliberately leaves quiet, is cropped away
 *   "og"      the share picture, a little tighter top and bottom
 *
 * width and height are in pixels and are normally left out: on a page
 * the SVG is sized by CSS, and fixed numbers there would fight it.
 * api/og.js passes them, because the image renderer is handed the SVG
 * as a data URL with no stylesheet anywhere and will not draw one
 * whose size it cannot work out.
 *
 * They are the only part of the output not generated from the slug, so
 * they are forced through Math.round and dropped unless both are real
 * numbers. A caller cannot put anything else in the string this way.
 */
/** The optional width and height, forced to two whole numbers or left out. */
function sizeAttr(c) {
  const w = Math.round(Number(c.width));
  const h = Math.round(Number(c.height));
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
    ? ` width="${w}" height="${h}"`
    : "";
}

export function coverArt(course) {
  const c = course || {};
  const key = areaKey(c.area);
  const random = seeded(c.slug || c.title || "cover");
  const box =
    c.variant === "square"
      ? "140 0 180 180"
      : c.variant === "og"
        ? "0 -3 320 168"
        : "0 0 320 180";

  // A THUMBNAIL GETS THE RINGS AND NOTHING ELSE, and this is worth
  // explaining because it looks like a shortcut.
  //
  // A square cover is drawn at about forty pixels, with the art at
  // forty percent opacity behind two large letters. At that size the
  // area art is not small, it is invisible: a thirty dot scatter plot
  // resolves to a smudge. It was costing 2,250 characters per
  // thumbnail, inline in the HTML, and the landing page carries twelve
  // of them. That is 27 kilobytes of markup for something no eye can
  // resolve.
  //
  // The rings are the Academy's own motif, they read perfectly at
  // forty pixels, and they cost about 350 characters. The area is
  // still unmistakable, because the BACKGROUND COLOUR is the area's
  // and that is the part that survives being shrunk.
  if (c.variant === "square") {
    return (
      `<svg class="acad-cover__art"${sizeAttr(c)} viewBox="${box}" ` +
      `preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
      rings(230, 90, SIGNAL, 0.1) +
      `</svg>`
    );
  }

  return (
    `<svg class="acad-cover__art"${sizeAttr(c)} viewBox="${box}" ` +
    `preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
    ART[key](random, gridFor(c.variant, key)) +
    `</svg>`
  );
}

/**
 * The two letters on a thumbnail.
 *
 * cover_code when the database has one, otherwise the first two letters
 * of the title, because a blank square looks broken and a course
 * without a code is a course somebody has not finished setting up, not
 * a course nobody should be able to see.
 */
export function coverCode(course) {
  const c = course || {};
  const given = String(c.cover_code || "").trim();
  if (given) return given.slice(0, 2).toUpperCase();
  return String(c.title || "??")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * What goes in the big slot at the bottom left of a cover.
 *
 * The tool name, unless there is not one or it is too long to fit on
 * one line at a readable size, in which case the two letter code. The
 * cut off is twelve characters: "KoboToolbox" is eleven and fits,
 * "NVivo for qualitative research" is a title rather than a tool and
 * would have to be shrunk past readable.
 */
export function coverName(course) {
  const tool = String((course || {}).tool || "").trim();
  if (!tool || tool.length > 12) return coverCode(course);
  return tool;
}

/**
 * The type size for the name, in container query units.
 *
 * Stepped by length rather than computed, so the sizes are ones
 * somebody chose by looking at them. cqw means it scales with the
 * cover, so the same number works on a 300 pixel card and a 1200 pixel
 * share picture.
 */
export function coverNameSize(name) {
  const n = String(name || "").length;
  if (n <= 4) return 15;
  if (n <= 5) return 14;
  if (n <= 6) return 12.5;
  if (n <= 7) return 11;
  if (n <= 8) return 9.8;
  if (n <= 9) return 8.8;
  if (n <= 10) return 8;
  return 7.3;
}
