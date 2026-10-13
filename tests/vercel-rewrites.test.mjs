// vercel.json: every rewrite that something live depends on.
//
//   npm test
//
// WHY THIS TEST EXISTS. On 9 October a commit rewrote vercel.json from
// an older copy of the file and silently dropped four rewrites:
// /sitemap.xml, /lms, /lms/courses and /lms/courses/:slug. Nothing
// failed. The build passed, the deployment went green, and the damage
// was invisible from inside the repository:
//
//   robots.txt went on advertising a sitemap at /sitemap.xml, which
//   from then on returned the home page. A sitemap that answers HTML
//   is a broken sitemap, and Google stops asking for a while.
//
//   The three public Academy pages fell through to the catch-all, so
//   they were served index.html with the home page's title and
//   description instead of the edge function's.
//
// The same mistake in the other direction would be worse: a package
// built from a copy of the file that predates the Excel basics merge
// would delete the two /register/excel-basics rewrites and take a live
// registration page down.
//
// So this file lists both sets and fails if either goes missing. It
// does not care about the order of the file, only that the four
// Academy rewrites come BEFORE the catch-all, because Vercel takes the
// first match and the catch-all matches everything.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);

const rewrites = config.rewrites || [];
const sourceAt = (source) => rewrites.findIndex((r) => r.source === source);
const CATCH_ALL = "/((?!api/).*)";

/** Every rewrite nothing may be merged without, and what breaks without it. */
const REQUIRED = [
  // ----- the four that were dropped on 9 October
  [
    "/sitemap.xml",
    "/api/sitemap",
    "robots.txt advertises a sitemap at /sitemap.xml. Without this rewrite that address returns the home page, which Google reads as a broken sitemap.",
  ],
  [
    "/lms",
    "/api/academy-meta?path=/lms",
    "the Academy landing page gets the home page's title and description instead of its own.",
  ],
  [
    "/lms/courses",
    "/api/academy-meta?path=/lms/courses",
    "the catalogue gets the home page's title and description.",
  ],
  [
    "/lms/courses/:slug",
    "/api/academy-meta?path=/lms/courses/:slug",
    "every course page gets the home page's title and description, and no share picture of its own.",
  ],

  // ----- the two that a stale upload would delete
  [
    "/register/excel-basics",
    "/register/excel-basics/index.html",
    "the live Excel basics registration page stops loading.",
  ],
  [
    "/register/excel-basics/",
    "/register/excel-basics/index.html",
    "the live Excel basics registration page stops loading when the address is typed with a trailing slash.",
  ],
];

test("every rewrite something live depends on is present", () => {
  for (const [source, destination, breaks] of REQUIRED) {
    const i = sourceAt(source);
    assert.ok(
      i > -1,
      `vercel.json has no rewrite for "${source}". Without it, ${breaks}\nThis is almost always a vercel.json pasted from an older copy of the file. Merge, do not replace.`,
    );
    assert.equal(
      rewrites[i].destination,
      destination,
      `the rewrite for "${source}" points at the wrong place`,
    );
  }
});

test("the catch-all is last, so nothing is shadowed by it", () => {
  const i = sourceAt(CATCH_ALL);
  assert.ok(i > -1, "the catch-all rewrite to /index.html is missing, so every page of the site 404s");
  assert.equal(
    i,
    rewrites.length - 1,
    "the catch-all is not the last rewrite. Vercel takes the first match, and it matches everything, so anything after it is dead.",
  );

  for (const [source] of REQUIRED) {
    assert.ok(
      sourceAt(source) < i,
      `the rewrite for "${source}" is after the catch-all, which matches everything, so it never runs`,
    );
  }
});

test("the other register and static page rewrites are still there too", () => {
  // Not just Excel basics. These are the rest of the live static pages
  // that are served out of /public through a rewrite, and the same
  // stale paste would take any of them with it.
  for (const source of [
    "/certificate/:number",
    "/cowrie",
    "/giz/host-an-intern",
    "/giz/employability",
    "/giz/employability/record",
    "/deaf-in-tech/web-design",
    "/register/data-analytics",
  ]) {
    assert.ok(sourceAt(source) > -1, `the rewrite for "${source}" has gone`);
  }
});

test("the redirects are still there", () => {
  const redirects = config.redirects || [];
  const has = (source) => redirects.some((r) => r.source === source);
  for (const source of [
    "/deaf-in-tech/graphic-design",
    "/careers/enumerator-application",
    "/world-cup-2026",
  ]) {
    assert.ok(has(source), `the redirect for "${source}" has gone, so an address that is linked to from outside the site now 404s`);
  }
});

test("no rewrite is listed twice", () => {
  const seen = new Map();
  for (const r of rewrites) {
    assert.ok(
      !seen.has(r.source),
      `"${r.source}" is listed twice in vercel.json. The second one never runs, and the two usually disagree.`,
    );
    seen.set(r.source, r.destination);
  }
});
