// The title and description a course page shows have to be identical in
// two places: the HTML the edge function writes before any JavaScript
// runs, and the tags the React page sets once it boots. If they differ,
// the title changes under a crawler that does run JavaScript, somewhere
// between the HTML arriving and React starting, and nobody would ever
// catch it by looking at the page.
//
// They are identical by construction: both sides import api/_seo-rules.js.
// So this file does two jobs.
//
//   1. It checks that neither side has quietly reimplemented the rules.
//      That is the way this could break, and it would break silently.
//   2. It checks the rules themselves against the awkward inputs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  clip,
  asLength,
  courseTitle,
  courseDescription,
  MAX_TITLE,
  MAX_DESCRIPTION,
  landingWords,
  LANDING,
  SITE_ORIGIN,
} from "../api/_seo-rules.js";

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

// ============================ 1. nobody has written a second copy

test("the React side imports the rules rather than repeating them", () => {
  const ts = read("../src/lib/courseSeo.ts");
  assert.match(ts, /from "\.\.\/\.\.\/api\/_seo-rules\.js"/);

  // The two giveaways that somebody has written the rules out again.
  assert.doesNotMatch(ts, /lastIndexOf\(" "\)/, "clip looks reimplemented");
  assert.doesNotMatch(ts, /Learn \$\{/, "the title template looks reimplemented");
  assert.doesNotMatch(ts, /at your own pace/, "the description template looks reimplemented");
});

test("the edge side imports them too", () => {
  const js = read("../api/_academy-data.js");
  assert.match(js, /from "\.\/_seo-rules\.js"/);
  assert.doesNotMatch(js, /lastIndexOf\(" "\)/, "clip looks reimplemented");
  assert.doesNotMatch(js, /Learn \$\{/, "the title template looks reimplemented");
});

test("the numbers are written down once", () => {
  assert.equal(MAX_TITLE, 60);
  assert.equal(MAX_DESCRIPTION, 155);
  const page = read("../src/pages/Academy/Course/page.tsx");
  assert.doesNotMatch(page, /MAX_TITLE = 60|MAX_DESCRIPTION = 155/);
});

// ============================ 2. the rules, on the awkward inputs

const COURSES = [
  {
    what: "an ordinary course",
    title: "STATA for survey data",
    summary: "Clean, label and analyse survey exports, then build the tables your report needs.",
    lesson_count: 12,
    total_seconds: 5760,
    seo_title: null,
    seo_description: null,
    expectTitle: "Learn STATA for survey data Online | Data-Lead Academy",
  },
  {
    what: "a hand written title and description",
    title: "STATA for survey data",
    summary: "Ignored, because seo_description is set.",
    lesson_count: 12,
    total_seconds: 5760,
    seo_title: "Learn STATA for Survey Data Online | Data-Lead Academy",
    seo_description: "12 video lessons, 1h 36m, at your own pace. First module free.",
    expectTitle: "Learn STATA for Survey Data Online | Data-Lead Academy",
    expectDescription: "12 video lessons, 1h 36m, at your own pace. First module free.",
  },
  {
    what: "a title longer than the limit",
    title:
      "An extraordinarily long course name that nobody would ever actually type but which must not break anything",
    summary: "Short.",
    lesson_count: 3,
    total_seconds: 900,
    seo_title: null,
    seo_description: null,
  },
  {
    what: "one lesson, so the word is singular",
    title: "A one lesson course",
    summary: "Just the one.",
    lesson_count: 1,
    total_seconds: 380,
    seo_title: null,
    seo_description: null,
    expectDescription: "1 video lesson, 6m, at your own pace. Just the one.",
  },
  {
    what: "no lessons, no time and no summary",
    title: "An empty course",
    summary: "",
    lesson_count: 0,
    total_seconds: 0,
    seo_title: null,
    seo_description: null,
    expectDescription: "0 video lessons, 0m, at your own pace.",
  },
  {
    what: "a summary long enough to be cut",
    title: "A wordy course",
    summary:
      "This summary goes on at considerable length about everything the course covers and keeps going well past the point where any search engine would stop showing it to anybody at all.",
    lesson_count: 9,
    total_seconds: 3900,
    seo_title: null,
    seo_description: null,
  },
  {
    what: "a hand written title that is itself too long",
    title: "Whatever",
    summary: "Whatever.",
    lesson_count: 2,
    total_seconds: 600,
    seo_title:
      "A hand written search engine title that somebody made far too long to fit in a result",
    seo_description: null,
  },
];

for (const c of COURSES) {
  test(`inside what a search engine shows: ${c.what}`, () => {
    const t = courseTitle(c);
    const d = courseDescription(c);
    assert.ok(t.length <= MAX_TITLE, `title was ${t.length}: ${t}`);
    assert.ok(d.length <= MAX_DESCRIPTION, `description was ${d.length}: ${d}`);
    // Nothing ends mid word or on a stray comma.
    assert.doesNotMatch(t, /[\s,;:-]$/);
    assert.doesNotMatch(d, /[\s,;:-]$/);
    assert.doesNotMatch(t, /undefined|null|NaN/);
    assert.doesNotMatch(d, /undefined|null|NaN/);
  });

  if (c.expectTitle) {
    test(`the title reads as expected: ${c.what}`, () => {
      assert.equal(courseTitle(c), c.expectTitle);
    });
  }
  if (c.expectDescription) {
    test(`the description reads as expected: ${c.what}`, () => {
      assert.equal(courseDescription(c), c.expectDescription);
    });
  }
}

test("a hand written one wins over the template", () => {
  const c = { ...COURSES[0], seo_title: "Mine", seo_description: "Also mine." };
  assert.equal(courseTitle(c), "Mine");
  assert.equal(courseDescription(c), "Also mine.");
});

test("a blank hand written one does not win", () => {
  const c = { ...COURSES[0], seo_title: "   ", seo_description: "" };
  assert.equal(courseTitle(c), "Learn STATA for survey data Online | Data-Lead Academy");
  assert.match(courseDescription(c), /^12 video lessons/);
});

test("clip on the awkward inputs", () => {
  assert.equal(clip("", 10), "");
  assert.equal(clip("short", 60), "short");
  assert.equal(clip("one two three four five", 11), "one two");
  assert.equal(clip("  lots   of   spaces  ", 12), "lots of");
  assert.equal(clip("ends with a comma, and more", 18), "ends with a comma");
  // One word longer than the limit has to be cut inside it.
  assert.equal(clip("aaaaaaaaaaaaaaaaaaaa", 5).length, 5);
});

test("lengths read the way a person writes them", () => {
  assert.equal(asLength(5760), "1h 36m");
  assert.equal(asLength(3600), "1h");
  assert.equal(asLength(600), "10m");
  assert.equal(asLength(0), "0m");
  assert.equal(asLength(null), "0m");
  assert.equal(asLength(undefined), "0m");
});

// ============================ 3. the pages' fixed words are written once

test("the landing words live in the rules file, not in the page", () => {
  // They used to be two separate constants that happened to match: one
  // at the top of api/academy-meta.js and one in the React page. Nothing
  // checked that they agreed, and an edit to either would have changed
  // the title a crawler reads without changing the one a browser sets.
  const page = read("../src/pages/Academy/Landing/page.tsx");
  const edge = read("../api/academy-meta.js");

  for (const file of [page, edge]) {
    assert.doesNotMatch(
      file,
      /Short video courses in the tools data professionals use/,
      "the landing description has been written out again",
    );
    assert.doesNotMatch(
      file,
      /Learn one tool at a time/,
      "the landing headline has been written out again",
    );
  }

  // And the page reads them from the shared file.
  assert.match(page, /from "\.\.\/\.\.\/\.\.\/lib\/courseSeo"/);
  assert.match(page, /landingWords/);
});

test("the headline and subhead can come from the database, the title cannot", () => {
  const w = landingWords({
    headline: "Anything at all",
    subhead: "Anything at all",
    announce_on: false,
  });
  assert.equal(w.headline, "Anything at all");
  assert.equal(w.subhead, "Anything at all");
  assert.equal(w.title, LANDING.title);
  assert.equal(w.description, LANDING.description);
});

test("the site's address is written down once", () => {
  // Every other file must import it. A second copy is how the canonical
  // and the sitemap came to disagree.
  assert.equal(SITE_ORIGIN, "https://dataleadafrica.com");
  for (const path of [
    "../api/academy-meta.js",
    "../api/sitemap.js",
    "../api/og.js",
    "../src/lib/site.ts",
  ]) {
    const file = read(path);
    assert.doesNotMatch(
      file,
      /= *"https:\/\/(www\.)?dataleadafrica\.com"/,
      `${path} has its own copy of the site address`,
    );
  }
  // robots.txt names it too, and that one is a plain file nothing can
  // import, so it is checked rather than shared.
  const robots = read("../public/robots.txt");
  assert.match(robots, /^Sitemap: https:\/\/dataleadafrica\.com\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /www\.dataleadafrica\.com/);
});
