// Every course's drawn cover.
//
//   npm test
//
// WHY THIS TEST EXISTS. The cover art is the one thing in the Academy
// that is generated rather than written, and it runs in two different
// places: in the browser, on every card, and in Node, inside
// api/og.js, to make the picture that shows up in a WhatsApp group.
// Four things can go wrong, and three of them are silent:
//
//   1. The two places disagree. A card shows one picture and the share
//      picture shows another, and nobody notices until somebody shares
//      a course and it does not look like the course.
//
//   2. An "id" gets into the SVG. An id is global to the whole page, so
//      twenty covers each defining the same gradient id would all draw
//      the LAST one. That is why the colours are CSS custom properties
//      instead, and this test is what keeps them that way.
//
//   3. A NaN gets into a coordinate. The shape silently vanishes.
//      No error, no warning, just a cover with a piece missing.
//
//   4. It gets fat. The art is inline in the HTML of every card, so a
//      cover that grows by a kilobyte grows the catalogue by twenty.
//
// It needs no browser and no dependency: the art lives in
// api/_cover-art.js as plain JavaScript precisely so it can be run
// here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AREA_GRID,
  AREA_PAINT,
  AREAS,
  areaGoal,
  areaKey,
  coverArt,
  coverCode,
  coverName,
  coverNameSize,
  coverNameWraps,
} from "../api/_cover-art.js";

// Every area the database has today, plus two it does not: an area
// nobody has written art for, and no area at all. Both of those are
// normal, not errors. Staff can add an area whenever they like and the
// site has to keep working.
const COURSES = [
  { slug: "excel-foundations", title: "Excel foundations", tool: "Excel", area: "Analysis" },
  { slug: "power-bi-dashboards", title: "Power BI dashboards", tool: "Power BI", area: "Visualisation" },
  { slug: "kobo-field-surveys", title: "Field surveys with Kobo", tool: "KoboToolbox", area: "Data collection" },
  { slug: "python-for-data", title: "Python for data", tool: "Python", area: "Programming" },
  { slug: "mystery-course", title: "Mystery course", tool: "Mystery", area: "Qualitative methods" },
  { slug: "no-area-at-all", title: "No area at all", tool: null, area: null },
];

const VARIANTS = ["card", "square", "og"];

// Every cover, in every size. One list, so each test below can say what
// it wants about all of them at once and no combination gets missed.
const EVERY = [];
for (const course of COURSES) {
  for (const variant of VARIANTS) {
    EVERY.push({ name: `${course.slug} as ${variant}`, course, variant, svg: coverArt({ ...course, variant }) });
  }
}

// ---------------------------------------------------------------------
// The four things that can go wrong
// ---------------------------------------------------------------------

test("every area, and an unknown one, and none, all draw something", () => {
  for (const { name, svg } of EVERY) {
    assert.ok(svg.startsWith("<svg"), `${name}: did not return an SVG`);
    assert.ok(svg.endsWith("</svg>"), `${name}: the SVG was not closed`);
    // A bare <svg></svg> would pass both of the above and draw nothing
    // at all, which is exactly the failure a new area would cause.
    assert.ok(
      /<(path|circle|rect|line|polyline|polygon|g)\b/.test(svg),
      `${name}: the SVG has no shapes in it, so the cover is empty`,
    );
  }
});

test("no cover defines an id, because an id on a page of covers collides", () => {
  for (const { name, svg } of EVERY) {
    assert.ok(
      !/\bid\s*=/.test(svg),
      `${name}: this cover defines an id. Twenty covers on the catalogue would ` +
        `all use whichever one the browser saw last, so every card would draw ` +
        `the same thing. Colours belong in CourseCover.css as custom properties.`,
    );
    // url(#...) is the other half of the same mistake: a reference to an
    // id, which would point at some other cover's definition.
    assert.ok(
      !svg.includes("url(#"),
      `${name}: this cover points at an id with url(#...), which on a page of ` +
        `covers resolves to a different cover's definition.`,
    );
  }
});

test("no NaN, no undefined and no null in any coordinate", () => {
  for (const { name, svg } of EVERY) {
    for (const bad of ["NaN", "undefined", "null", "Infinity"]) {
      assert.ok(
        !svg.includes(bad),
        `${name}: the string "${bad}" is in the SVG. A browser drops the shape ` +
          `silently, so the cover loses a piece with no error anywhere.`,
      );
    }
  }
});

test("every cover is under 3000 characters", () => {
  for (const { name, svg } of EVERY) {
    assert.ok(
      svg.length < 3000,
      `${name}: ${svg.length} characters. The art is inline in the HTML of ` +
        `every card, so twenty of these are on the catalogue at once.`,
    );
  }
});

// ---------------------------------------------------------------------
// The same slug must give the same string, here and in the browser
// ---------------------------------------------------------------------

test("the same slug gives exactly the same string every time", () => {
  for (const course of COURSES) {
    for (const variant of VARIANTS) {
      const once = coverArt({ ...course, variant });
      const twice = coverArt({ ...course, variant });
      assert.equal(once, twice, `${course.slug} as ${variant} drew differently the second time`);
    }
  }
});

test("the string does not depend on the order the covers are drawn in", () => {
  // The real catch. If the random numbers came from one generator shared
  // between covers instead of one seeded per slug, each cover would
  // depend on how many were drawn before it. The catalogue draws them in
  // one order and api/og.js draws a single cover on its own, so the share
  // picture would never match the card. Drawing the list backwards is
  // what proves the seed is per slug.
  const forwards = COURSES.map((c) => coverArt({ ...c, variant: "card" }));
  const backwards = [...COURSES].reverse().map((c) => coverArt({ ...c, variant: "card" }));
  backwards.reverse();
  assert.deepEqual(backwards, forwards, "a cover changed depending on what was drawn before it");

  // And one on its own, the way api/og.js draws it.
  const alone = coverArt({ ...COURSES[3], variant: "card" });
  assert.equal(alone, forwards[3], "a cover drawn on its own differs from the same cover in a list");
});

test("two different courses get two different pictures", () => {
  const seen = new Map();
  for (const course of COURSES) {
    const svg = coverArt({ ...course, variant: "card" });
    const other = seen.get(svg);
    assert.equal(
      other,
      undefined,
      `${course.slug} and ${other} drew the identical picture, so the seed is not ` +
        `reaching the art`,
    );
    seen.set(svg, course.slug);
  }
});

test("a course with no slug still gets a cover rather than throwing", () => {
  // A course part way through being set up, and the catalogue still has
  // to render. Falls back to the title, then to a fixed seed.
  const byTitle = coverArt({ title: "Half finished", area: "Analysis" });
  assert.ok(byTitle.startsWith("<svg"), "a course with no slug drew nothing");
  const byNothing = coverArt({});
  assert.ok(byNothing.startsWith("<svg"), "an empty course drew nothing");
  assert.equal(coverArt({}), coverArt({}), "the empty fallback is not stable");
});

// ---------------------------------------------------------------------
// Nothing from the database goes inside the SVG
// ---------------------------------------------------------------------

test("the title, tool and slug never appear inside the SVG", () => {
  // This is the whole reason CourseCover.tsx may set the art as HTML.
  // The slug seeds the numbers and nothing else; the words are real HTML
  // laid over the top. If a title ever reached the SVG string, a title
  // typed by staff could carry markup into the page, and this test is
  // the thing standing in the way.
  const nasty = {
    slug: "</svg><script>alert(1)</script>",
    title: "<img onerror=alert(1) src=x>",
    tool: "</svg>oops",
    area: "Analysis",
  };
  for (const variant of VARIANTS) {
    const svg = coverArt({ ...nasty, variant });
    assert.ok(!svg.includes("<script"), `${variant}: a script tag reached the SVG`);
    assert.ok(!svg.includes("onerror"), `${variant}: an attribute from the database reached the SVG`);
    assert.ok(!svg.includes("oops"), `${variant}: the tool name reached the SVG`);
    assert.ok(!svg.includes("alert"), `${variant}: text from the database reached the SVG`);
    // Exactly one closing tag, the one at the end. More than one means
    // something escaped out of the element.
    assert.equal(svg.split("</svg>").length - 1, 1, `${variant}: the SVG was closed more than once`);
  }
});

test("there are no words in the art at all", () => {
  // The words are HTML over the top, not in the picture. That is what
  // makes them selectable, translatable and readable by a screen reader,
  // and it is why a font that fails to load cannot turn a cover into a
  // row of boxes. <text> in here would quietly undo all of it.
  for (const { name, svg } of EVERY) {
    assert.ok(!svg.includes("<text"), `${name}: the art draws words itself`);
    assert.ok(!svg.includes("<tspan"), `${name}: the art draws words itself`);
    assert.ok(!svg.includes("font-"), `${name}: the art sets a font, so it must be drawing words`);
  }
});

// ---------------------------------------------------------------------
// The words beside the picture
// ---------------------------------------------------------------------

test("a long tool name becomes the two letter code instead of overflowing", () => {
  // THE RULE CHANGED in academy-6a: a name with a space in it may be
  // longer than one line, because it can go on two. A name with no
  // space still cannot, because there is nowhere to break it.
  //
  // Three words is a sentence rather than a tool, so it still gets the
  // code. "Advanced Excel 365" is the sort of thing staff type into the
  // tool field.
  const long = { slug: "x", title: "Spreadsheet skills", tool: "Advanced Excel 365", area: "Analysis" };
  assert.equal(long.tool.length, 18, "the test is no longer using an 18 character name");
  assert.equal(coverName(long), "SP", "a three word tool name was not swapped for the code");

  // One word: eleven fits, thirteen does not. The cut off is a
  // judgement about what fits, so it is pinned here rather than left to
  // drift.
  assert.equal(coverName({ tool: "KoboToolbox", title: "Kobo" }), "KoboToolbox", "11 characters should fit");
  assert.equal(coverName({ tool: "Thirteenchars", title: "Too long" }), "TO", "13 characters in one word should not fit");

  // Two words: the two Dr Ayoola named, both of which used to come out
  // as a meaningless pair of letters.
  assert.equal(coverName({ tool: "Looker Studio", title: "Dashboards" }), "Looker Studio");
  assert.equal(coverName({ tool: "Research methods", title: "Methods" }), "Research methods");

  // And the limits on a wrapping name: two words, eighteen characters,
  // and no word longer than eleven.
  assert.equal(coverName({ tool: "Microsoft Power Automate", title: "Automation" }), "AU",
    "three words should still get the code");
  assert.equal(coverName({ tool: "Extraordinarily wide", title: "Wide thing" }), "WI",
    "a twenty character name should still get the code");
  assert.equal(coverName({ tool: "Supercalifragilistic x", title: "Long word" }), "LO",
    "a word that cannot fit on a line should get the code even with a space after it");
});

test("a two word name goes on two lines, sized from its longest word", () => {
  // Sized from the whole name, "Looker Studio" would be thirteen
  // characters and get 7.3, which is SMALLER than the two letter code
  // it replaced. It is sized from "Looker" instead, then 80 percent of
  // that because two lines need the room one line did not.
  assert.equal(coverNameWraps("Looker Studio"), true);
  assert.equal(coverNameWraps("Research methods"), true);

  // Eight characters with a space stays on one line: "Power BI" looks
  // right as it is.
  assert.equal(coverNameWraps("Power BI"), false);
  assert.equal(coverNameWraps("KoboToolbox"), false, "no space, so nowhere to wrap");
  assert.equal(coverNameWraps(""), false);
  assert.equal(coverNameWraps(null), false);

  assert.equal(coverNameSize("Looker Studio"), 10, "not sized from the longest word");
  assert.ok(
    coverNameSize("Looker Studio") > coverNameSize("KoboToolbox"),
    "a wrapping name came out smaller than the long single word it is shorter than",
  );
  // 80 percent of the one line size for the longest word.
  assert.equal(coverNameSize("Research methods"), Math.round(9.8 * 0.8 * 10) / 10);
});

test("five letter names are a little smaller than four", () => {
  // Dr Ayoola's note: STATA and NVivo sat a touch proud of the corner.
  assert.ok(coverNameSize("STATA") < coverNameSize("Kobo"), "five is not smaller than four");
  assert.equal(coverNameSize("STATA"), 13);
  assert.equal(coverNameSize("NVivo"), 13);
  assert.equal(coverNameSize("Kobo"), 15);
});

test("the art leaves a clear band for the two pieces of writing", () => {
  // The eyebrow sits top left and the tool name bottom left, both as
  // real HTML over the picture. The art is pushed out of their way
  // rather than running underneath them.
  for (const variant of ["card", "og"]) {
    const art = coverArt({ slug: "s", title: "T", area: "Analysis", variant });
    assert.match(art, /<g transform="translate\(46 16\) scale\(\.86\)">/,
      `the ${variant} cover draws its art without the clear zone`);
    assert.ok(art.endsWith("</g></svg>"), `the ${variant} cover does not close the clear zone group`);
  }
  // Not the thumbnail: it is rings only, with no art to move, and the
  // two letters are centred rather than in a corner.
  const square = coverArt({ slug: "s", title: "T", area: "Analysis", variant: "square" });
  assert.ok(!/translate\(46 16\)/.test(square), "a thumbnail does not need a clear zone");
});

test("the name is always sized to fit the slot", () => {
  // The type size is stepped by length, so the longest name that is
  // allowed through must still get a smaller size than the shortest one.
  assert.ok(
    coverNameSize("KoboToolbox") < coverNameSize("R"),
    "a long name is not being set smaller than a short one",
  );
  for (const n of ["R", "SQL", "Excel", "Power BI", "KoboToolbox", ""]) {
    const size = coverNameSize(n);
    assert.ok(Number.isFinite(size) && size > 0, `"${n}" got no usable type size`);
    assert.ok(size <= 15, `"${n}" got ${size}cqw, which is wider than the cover`);
  }
});

test("a thumbnail always has two letters on it", () => {
  for (const course of COURSES) {
    const code = coverCode(course);
    assert.equal(code.length, 2, `${course.slug} got "${code}", which is not two letters`);
    assert.equal(code, code.toUpperCase(), `${course.slug} got a lower case code`);
  }
  // The database code wins when there is one, and a course nobody has
  // finished setting up still gets something rather than an empty square.
  assert.equal(coverCode({ cover_code: "px", title: "Python for data" }), "PX");
  assert.equal(coverCode({ title: "Python for data" }), "PY");
  assert.equal(coverCode({}), "??");
});

// ---------------------------------------------------------------------
// The areas list, which the landing page's goal chips also use
// ---------------------------------------------------------------------

test("every area in the list has its own art key", () => {
  const keys = new Set();
  for (const a of AREAS) {
    assert.equal(areaKey(a.area), a.key, `${a.area} does not map to its own key`);
    assert.ok(!keys.has(a.key), `two areas share the key ${a.key}, so they would draw the same cover`);
    keys.add(a.key);
    assert.notEqual(a.key, "x", `${a.area} is in the list but falls through to the neutral art`);
  }
});

test("an area nobody has written art for falls through quietly", () => {
  assert.equal(areaKey("Qualitative methods"), "x");
  assert.equal(areaKey(null), "x");
  assert.equal(areaKey(""), "x");
  assert.equal(areaKey("  "), "x");
  // An area name typed with a stray space is the same area.
  assert.equal(areaKey(" Analysis "), "an", "a space around the area name lost the art");
});

test("the goal wording falls back to the area's own name", () => {
  assert.equal(areaGoal("Analysis"), "Analyse data");
  // A new area the database grows next year: the chip reads as the area
  // itself rather than disappearing or saying "undefined".
  assert.equal(areaGoal("Qualitative methods"), "Qualitative methods");
  assert.equal(areaGoal(null), "Other");
  assert.equal(areaGoal(""), "Other");
});

// ---------------------------------------------------------------------
// The sizes
// ---------------------------------------------------------------------

test("each size asks for its own part of the picture", () => {
  const boxOf = (svg) => (svg.match(/viewBox="([^"]+)"/) || [])[1];
  const course = COURSES[0];
  const card = boxOf(coverArt({ ...course, variant: "card" }));
  const square = boxOf(coverArt({ ...course, variant: "square" }));
  const og = boxOf(coverArt({ ...course, variant: "og" }));

  assert.ok(card && square && og, "a size came out with no viewBox, so it would not scale");
  assert.notEqual(square, card, "the thumbnail shows the same area as the card, so it is squashed");
  assert.notEqual(og, card, "the share picture shows the same area as the card");

  // The thumbnail crops the left third away, because that is the part
  // the art deliberately leaves quiet for the tool name, and a square
  // thumbnail has no room for a tool name.
  const [sx, , sw] = square.split(/\s+/).map(Number);
  assert.ok(sx > 0, "the thumbnail does not crop the quiet left third away");
  assert.ok(sw <= 180, "the thumbnail is not square, so the art inside it is stretched");

  // An unknown size is the card, not nothing.
  assert.equal(boxOf(coverArt({ ...course, variant: "something-new" })), card);
  assert.equal(boxOf(coverArt({ ...course })), card);
});

// ---------------------------------------------------------------------
// The colours, which exist in two places because they have to
// ---------------------------------------------------------------------

test("the stylesheet's colours and the share picture's colours agree", async () => {
  // The cover's background is a CSS gradient on the HTML element, not
  // something inside the SVG, so the browser reads it from
  // CourseCover.css and api/og.js reads it from AREA_PAINT. CSS cannot
  // read a JavaScript object, so there are two copies. This is the
  // thing that stops them drifting: change one and this fails, naming
  // the area and both values.
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(
    new URL("../src/pages/Academy/ui/CourseCover.css", import.meta.url),
    "utf8",
  );

  for (const [key, paint] of Object.entries(AREA_PAINT)) {
    // The block for one area class, up to its closing brace.
    const block = css.match(new RegExp(`\\.acad-cv-${key}\\s*\\{([^}]*)\\}`));
    assert.ok(block, `CourseCover.css has no .acad-cv-${key} rule, so that area has no colours`);

    const bg = (block[1].match(/--cv-bg:\s*([^;]+);/) || [])[1];
    const ink = (block[1].match(/--cv-ink:\s*([^;]+);/) || [])[1];
    const grid = (block[1].match(/--cv-grid:\s*([^;]+);/) || [])[1];
    assert.ok(bg, `.acad-cv-${key} sets no --cv-bg`);
    assert.ok(ink, `.acad-cv-${key} sets no --cv-ink`);
    assert.ok(grid, `.acad-cv-${key} sets no --cv-grid`);

    assert.equal(
      grid.trim(),
      AREA_GRID[key],
      `the ${key} graph paper differs between CourseCover.css and AREA_GRID in ` +
        `api/_cover-art.js. The page draws the grid in CSS and the share picture ` +
        `draws it in the SVG, so the two have to be told the same colour.`,
    );

    assert.equal(
      bg.trim(),
      paint.bg,
      `the ${key} background differs between CourseCover.css and AREA_PAINT in ` +
        `api/_cover-art.js, so the card and the share picture are different colours`,
    );
    assert.equal(
      ink.trim(),
      paint.ink,
      `the ${key} ink differs between CourseCover.css and AREA_PAINT in ` +
        `api/_cover-art.js, so the card and the share picture have different text`,
    );
  }

  // And the other direction: a class in the stylesheet with no entry
  // here would draw on a card and be missing from the share picture.
  for (const m of css.matchAll(/\.acad-cv-([a-z]+)\s*\{/g)) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(AREA_PAINT, m[1]),
      `CourseCover.css styles .acad-cv-${m[1]} but AREA_PAINT has no ${m[1]}, so the ` +
        `share picture for that area would be drawn with the wrong colours`,
    );
  }
});

test("every area key that can be returned has paint for it", () => {
  for (const a of AREAS) {
    assert.ok(AREA_PAINT[a.key], `${a.area} maps to "${a.key}", which has no colours`);
  }
  assert.ok(AREA_PAINT[areaKey("Something brand new")], "the neutral fallback has no colours");
  assert.ok(AREA_PAINT[areaKey(null)], "no area at all has no colours");
});

test("every class the art puts in the SVG is styled in the stylesheet", () => {
  // The Phase 3 trap, in its newest form. The art hands the browser
  // class names as a string, so nothing in the build checks them: a
  // class renamed in the stylesheet and not here does not break, it
  // just silently stops doing anything. Here the caret on a
  // Programming cover would simply stop blinking, and nothing anywhere
  // would say so.
  const css = readFileSync(
    new URL("../src/pages/Academy/ui/CourseCover.css", import.meta.url),
    "utf8",
  );
  const used = new Set();
  for (const { svg } of EVERY) {
    for (const m of svg.matchAll(/class="([^"]+)"/g)) {
      for (const name of m[1].split(/\s+/)) if (name) used.add(name);
    }
  }
  assert.ok(used.size > 0, "the art sets no classes at all, so this test is checking nothing");
  for (const name of used) {
    assert.ok(
      css.includes(`.${name}`),
      `the art uses the class "${name}" but CourseCover.css does not style it, so ` +
        `whatever that class was for has silently stopped happening`,
    );
  }
});

test("the pixel size is only ever two numbers, and is left out otherwise", () => {
  // api/og.js is the only caller that passes a size, and it is the one
  // number in the output that does not come from this file. So it is
  // forced through Math.round and dropped unless both are real.
  const base = { slug: "excel-foundations", area: "Analysis", variant: "og" };
  // Matched on the opening <svg ...> tag only: "stroke-width" appears
  // all over the shapes inside.
  const openTag = (svg) => svg.slice(0, svg.indexOf(">") + 1);
  assert.ok(
    !/\swidth=/.test(openTag(coverArt(base))),
    "a cover with no size given still set one",
  );

  const sized = coverArt({ ...base, width: 1200, height: 630 });
  assert.ok(sized.includes('width="1200"'), "the width was not used");
  assert.ok(sized.includes('height="630"'), "the height was not used");

  // Anything that is not a usable pair of numbers is dropped, not
  // passed through.
  for (const bad of [
    { width: "1200\" onload=\"alert(1)", height: 630 },
    { width: 1200, height: 0 },
    { width: -5, height: 630 },
    { width: 1200 },
    { width: NaN, height: 630 },
    { width: Infinity, height: 630 },
  ]) {
    const svg = coverArt({ ...base, ...bad });
    assert.ok(!svg.includes("onload"), `${JSON.stringify(bad)}: text got into the SVG`);
    assert.ok(!svg.includes("NaN"), `${JSON.stringify(bad)}: a NaN got into the SVG`);
    assert.ok(!svg.includes("Infinity"), `${JSON.stringify(bad)}: an Infinity got into the SVG`);
    assert.ok(
      !/\swidth="(-|0")/.test(openTag(svg)),
      `${JSON.stringify(bad)}: an unusable width got into the SVG`,
    );
  }

  // A fraction becomes a whole number rather than a long decimal.
  assert.ok(coverArt({ ...base, width: 1200.4, height: 630.6 }).includes('width="1200" height="631"'));

  // And the size does not change the drawing, only the box it is in.
  const strip = (s) => s.replace(/ width="\d+" height="\d+"/, "");
  assert.equal(strip(sized), coverArt(base), "giving a size changed the picture itself");
});

// ---------------------------------------------------------------------
// The chip icons, which are a different map from the cover art
// ---------------------------------------------------------------------

test("every area the database seeds has a chip icon, and the two maps agree", async () => {
  const { areaIconKey } = await import("../api/_cover-art.js");
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(new URL("../database/lms/16_restructure.sql", import.meta.url), "utf8");

  // The seven rows step 1 seeds: ('slug', 'Name', position, 'key').
  const seeded = [...sql.matchAll(/^\s*\('[a-z-]+',\s*'([^']+)',\s*\d+,\s*'(\w+)'\),?$/gm)]
    .map(([, name, key]) => ({ name, key }));
  assert.equal(seeded.length, 7, `expected the seven seeded areas, found ${seeded.length}`);

  for (const { name, key } of seeded) {
    assert.equal(areaIconKey(name), key,
      `the database gives "${name}" the icon ${key}, the page gives it ${areaIconKey(name)}. `
        + "The landing picker reads the key from lms_areas; the goal chips and the catalogue "
        + "filter build it from the course's area name, so the mapping is written twice and "
        + "these two must say the same thing.");
  }

  // And every one of those keys has a drawing, or the chip falls back
  // to the four pane grid that round 3 was about.
  const icons = readFileSync(new URL("../src/pages/Academy/ui/Icons.tsx", import.meta.url), "utf8");
  const body = icons.slice(icons.indexOf("export function GoalIcon"));
  for (const { name, key } of seeded) {
    assert.match(body, new RegExp(`^\\s{4}${key}: `, "m"),
      `"${name}" has no drawing for key ${key}, so its chip is the four pane fallback`);
  }
});

test("the chip map and the ART map are allowed to differ, and nothing reads the wrong one", async () => {
  const { areaKey, areaIconKey } = await import("../api/_cover-art.js");
  const { readFileSync } = await import("node:fs");

  // areaKey decides what is PAINTED, and every key it can return needs
  // an entry in ART and AREA_PAINT. Adding an area to it to fix a chip
  // is how the covers break.
  const art = readFileSync(new URL("../api/_cover-art.js", import.meta.url), "utf8");
  const painted = /^const AREA_KEY = \{([\s\S]*?)^\};/m.exec(art)[1];
  for (const [, key] of painted.matchAll(/:\s*"(\w+)"/g)) {
    assert.match(art, new RegExp(`^\\s{2}${key}: \\{ bg:`, "m"),
      `AREA_KEY can return "${key}" but AREA_PAINT has no entry for it, so a cover would paint nothing`);
  }

  // Databases is the case that proves the split: a chip icon, no art.
  assert.equal(areaIconKey("Databases"), "db");
  assert.equal(areaKey("Databases"), "x", "Databases now claims cover art that does not exist");

  // The goal chips and the catalogue filter must read the icon map.
  const rail = readFileSync(new URL("../src/pages/Academy/Landing/GoalRail.tsx", import.meta.url), "utf8");
  const cat = readFileSync(new URL("../src/pages/Academy/Courses/page.tsx", import.meta.url), "utf8");
  assert.match(rail, /areaIconKey\(area\)/, "the goal chips still take their icon from the art map");
  assert.match(cat, /areaIconKey\(name\)/, "the catalogue filter still takes its icon from the art map");
});
