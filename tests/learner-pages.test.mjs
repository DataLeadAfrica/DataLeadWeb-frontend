// The learner pages: the promises Big Sam's brief names, checked
// against the source rather than against a screenshot.
//
//   npm test
//
// WHY THESE ARE SOURCE TESTS. Most of what Part B asks for is about
// what a page must NEVER do: never a sideways row of areas, never an
// answer in a result, never a popup on a lesson, never a recommendation
// somebody paid for. Those are not things a rendering test catches,
// because the way they go wrong is that somebody later writes one more
// line that undoes them, and the page still renders perfectly.
//
// What a browser is better at, this project checks in a browser: the
// map against the hero text, the tiles against the window, the rail
// moving and stopping, the chapters, the filters. Those runs are in the
// package's evidence rather than here, because they need a built site
// and a real Chromium.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** Source with its comments stripped, for "this must not appear" checks. */
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ---------------------------------------------------------------------
// 1. The landing page
// ---------------------------------------------------------------------

test("the areas wrap, and nothing scrolls sideways to find them", () => {
  const css = read("src/pages/Academy/Landing/AreaPicker.css");
  assert.match(css, /\.acad-pick__areas \{[^}]*flex-wrap: wrap/,
    "the area tabs do not wrap, so the last ones would be off the side");
  assert.ok(!/\.acad-pick__areas \{[^}]*overflow-x/.test(css),
    "the area tabs scroll sideways, which hides the last areas behind a gesture nobody is told about");

  const strip = read("src/pages/Academy/Landing/AreaStrip.css");
  assert.match(strip, /\.acad-strip \{[^}]*flex-wrap: wrap/,
    "the Explore by area strip does not wrap");
});

test("every tool is a key, and one with no course says so", () => {
  const src = read("src/pages/Academy/Landing/AreaPicker.tsx");
  // The keys come from the area's tools, not from the catalogue: an
  // area we teach shows what it covers before there is a course for it.
  assert.match(src, /tools\.map\(/, "the keys are not built from the area's tools");
  assert.match(src, /"Coming soon"/, "a tool with no course does not say so");
  assert.match(src, /t\.course \?/, "a key does not know whether it has a course behind it");
});

test("the picker does not move by itself", () => {
  const src = code(read("src/pages/Academy/Landing/AreaPicker.tsx"));
  for (const bad of ["setInterval", "setTimeout", "requestAnimationFrame"]) {
    assert.ok(!src.includes(bad),
      `the picker uses ${bad}, so something on it moves without being pressed`);
  }
});

test("the rail slides itself, stops when it is used, and has no pause button", () => {
  const src = read("src/pages/Academy/Landing/GoalRail.tsx");
  assert.match(src, /setInterval\([\s\S]*?\}, 4200\)/,
    "the rail does not slide every 4.2 seconds");
  for (const stop of ["onPointerEnter", "onPointerLeave", "onFocus", "onBlur", "onTouchStart", "onTouchEnd"]) {
    assert.ok(src.includes(stop), `the rail does not stop on ${stop}`);
  }
  assert.match(src, /prefers-reduced-motion: reduce/,
    "the rail moves for somebody who has asked their system for no motion");
  assert.ok(!/pause/i.test(code(src)),
    "there is a pause button, which is what a carousel offers instead of stopping when you touch it");
  assert.match(read("src/pages/Academy/Landing/GoalRail.css"),
    /\.acad-crail__dots \{[^}]*justify-content: center/,
    "the dots are not centred under the rail");
});

test("the landing sends people to the path page, not into course one", () => {
  const src = read("src/pages/Academy/Landing/PathBanner.tsx");
  assert.match(src, /See the path/, "the path banner does not offer the path");
  assert.match(src, /routes\.academyPath\.replace/,
    "the path banner does not link to the path page");
});

// ---------------------------------------------------------------------
// 2. The catalogue
// ---------------------------------------------------------------------

test("the catalogue has two toggles and no sort", () => {
  const src = read("src/pages/Academy/Courses/page.tsx");
  assert.match(src, /Free to start/, "the free to start toggle is missing");
  assert.match(src, /Under 90 minutes/, "the under 90 minutes toggle is missing");
  assert.ok(!/<select/.test(src), "there is still a sort dropdown on the catalogue");
  assert.ok(!/sortCourses/.test(src), "the catalogue still sorts");

  // Under 90 minutes is 5400 seconds, said once.
  assert.match(src, /<= 5400/, "under 90 minutes is not 5400 seconds");
});

test("a filter in the address is read once, on the way in", () => {
  const src = read("src/pages/Academy/Courses/page.tsx");
  assert.match(src, /useState\(\(\) => params\.get\("area"\) \|\| "All"\)/,
    "the area in the address is not the starting state");
  assert.match(src, /useState\(\(\) => params\.get\("free"\) === "1"\)/);
  assert.match(src, /useState\(\(\) => params\.get\("short"\) === "1"\)/);

  // And pressing a filter does not rewrite the address: a page per
  // combination of filters is a page per combination for a search
  // engine to find, and the canonical says this is one page.
  assert.ok(!/setSearchParams|navigate\(/.test(code(src)),
    "pressing a filter changes the address, which makes a page per combination");

  // The three Quick picks columns open it with the right one on.
  const picks = read("src/pages/Academy/Landing/QuickPicks.tsx");
  assert.match(picks, /\?free=1/, "See free courses does not open the catalogue filtered");
  assert.match(picks, /\?short=1/, "See short courses does not open the catalogue filtered");
});

// ---------------------------------------------------------------------
// 4 and 8. The sign up form and the exam are checked in their own files
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// 5. The lesson
// ---------------------------------------------------------------------

test("the watch tape needs every cell, and the 92 per cent line is gone", () => {
  const tape = read("src/pages/Academy/ui/WatchTape.tsx");
  assert.match(tape, /unlockPercent = 100/,
    "the tape still defaults to unlocking before the end");
  assert.ok(!/\b92\b/.test(tape), "92 is still in the watch tape");
  // The line itself is drawn only when the mark is not the end: at 100
  // it sits on the last cell's edge and reads as the end of the tape.
  assert.match(tape, /unlockPercent < 100 \? \(/,
    "the mark line is still drawn when the mark is the end");

  const player = read("src/pages/Academy/Learn/Player/page.tsx");
  assert.match(player, /coverage_percent \|\| 100/,
    "the player still falls back to less than the whole lesson");
});

test("chapters can be jumped to only once they have been reached", () => {
  const src = read("src/pages/Academy/Learn/Player/Chapters.tsx");
  assert.match(src, /jumpable\(chapters, \{ furthestSeconds, fullyWatched \}\)/,
    "the chapters panel decides for itself which are open");
  assert.match(src, /After you reach it/, "a chapter that is not reached does not say so");
  assert.match(src, /disabled=\{!can\}/, "a shut chapter can still be pressed");

  // The furthest point is the SERVER's, not the player's.
  const player = read("src/pages/Academy/Learn/Player/page.tsx");
  assert.match(player, /furthestSeconds=\{lesson\.furthest_seconds/,
    "the chapters are told how far you have got by the page rather than by the database");
});

test("the speed list unlocks only after a full watch", () => {
  const src = read("src/pages/Academy/Learn/Player/page.tsx");
  assert.match(src, /\[0\.75, 1, 1\.25, 1\.5, 1\.75, 2\]/, "the full speed list is missing");
  assert.match(src, /\[0\.75, 1, 1\.25, MAX_RATE_FIRST_WATCH\]/,
    "the first watch list is missing");
  assert.match(src, /cappedRate\(want, open\)/,
    "the chosen speed is not capped by whether the lesson has been watched");
});

test("the lesson outline ends with the exam", () => {
  const src = read("src/pages/Academy/Learn/Player/page.tsx");
  assert.match(src, /At the end/, "the outline does not show what comes after the lessons");
  assert.match(src, /routes\.academyExam\.replace/, "the outline does not link to the exam");
});

// ---------------------------------------------------------------------
// 6. The lesson check
// ---------------------------------------------------------------------

test("a missed check question gets a place to watch, never the answer", () => {
  const q = read("src/pages/Academy/ui/Question.tsx");
  assert.match(q, /Watch this part again/, "a miss does not offer the moment it came from");
  assert.match(q, /!mark\.was_right && mark\.again/,
    "the watch again button shows for an answer that was right");

  const check = read("src/pages/Academy/Learn/Check/LessonCheck.tsx");
  assert.match(check, /!m\.was_right && m\.lesson_id/,
    "the check builds a watch again link for a right answer too");
  assert.match(check, /back=check/, "the link has no way back to the check");

  // And the server never sends one.
  const sql = read("database/lms/16_restructure.sql");
  const i = sql.indexOf("create or replace function lms_attempt_marks");
  const fn = sql.slice(i, sql.indexOf("\n$$;", i));
  assert.ok(!/is_correct/.test(fn.split("language")[0]),
    "lms_attempt_marks returns which option was right");
});

test("passing a check offers the next lesson by name", () => {
  const src = read("src/pages/Academy/Learn/Check/LessonCheck.tsx");
  assert.match(src, /Next lesson: \$\{next\.title\}/,
    "a pass offers a nameless Next lesson");
  assert.match(src, /"Back to the course"/,
    "the last lesson of a course still offers a next one");
});

// ---------------------------------------------------------------------
// 7. My course
// ---------------------------------------------------------------------

test("my course lists one exam and no module quizzes", () => {
  const src = read("src/pages/Academy/Learn/MyCourse/page.tsx");
  assert.ok(!/QuizRow/.test(src), "the module quiz row is still drawn");
  assert.ok(!/module quiz/i.test(code(src)), "the page still talks about module quizzes");
  assert.match(src, /opens after lesson \$\{course\.lesson_count\}/,
    "the exam row does not say what opens it");
  assert.match(src, /See the rules/, "there is no way to see the exam's rules before it opens");
  assert.match(src, /Pass the course exam/,
    "the certificate card still counts something other than the exam");
});

// ---------------------------------------------------------------------
// 9. The path page
// ---------------------------------------------------------------------

test("a path names a course finished in another path", () => {
  const src = read("src/pages/Academy/Path/page.tsx");
  assert.match(src, /Already taken in the \{c\.also_in\} path, so it counts here/,
    "a course ticked from another path has no explanation, so the tick looks like a mistake");
  assert.match(src, /Opens after \$\{left\} more course/,
    "the path exam does not say what opens it");
  assert.match(src, /counted from another path/,
    "the path does not count how many came from elsewhere");
});

// ---------------------------------------------------------------------
// 10 and 11. Recommendations
// ---------------------------------------------------------------------

test("recommendations carry their reason, and are never paid for", () => {
  for (const f of [
    "src/pages/Academy/Me/page.tsx",
    "src/pages/Academy/Learn/Complete/page.tsx",
  ]) {
    const src = read(f);
    assert.match(src, /getRecommendations\(\)/,
      `${f} does not use lms_my_recommendations`);
    assert.match(src, /\{c\.reason\}|\{p\.reason\}/,
      `${f} shows a recommendation without the reason for it`);
  }

  // The line that says so, in words, on My learning.
  assert.match(read("src/pages/Academy/Me/page.tsx"),
    /Never from what anybody paid to show you/,
    "the page does not say how the recommendations were picked");

  // And the certificate moment no longer offers the whole catalogue,
  // which is how it used to offer somebody a course they had finished.
  assert.ok(!/getCatalogue/.test(read("src/pages/Academy/Learn/Complete/page.tsx")),
    "Keep the momentum is back to listing the catalogue, which includes courses they have finished");
});

test("the certificate moment says what the course counts towards", () => {
  const src = read("src/pages/Academy/Learn/Complete/page.tsx");
  assert.match(src, /Counts towards \{p\.name\}/,
    "the certificate moment does not say which paths the course counts towards");
  assert.match(src, /course\.paths\.map/,
    "it names one path rather than every path the course is in");
});

// ---------------------------------------------------------------------
// 12. The popup
// ---------------------------------------------------------------------

test("the popup is on four pages and never on a lesson, a check or an exam", () => {
  const allowed = {
    "src/pages/Academy/Landing/page.tsx": "landing",
    "src/pages/Academy/Courses/page.tsx": "courses",
    "src/pages/Academy/Course/page.tsx": "course",
    "src/pages/Academy/Me/page.tsx": "me",
  };
  for (const [f, place] of Object.entries(allowed)) {
    assert.match(read(f), new RegExp(`<Popup place="${place}"`),
      `${f} has no popup, and it is one of the four pages that may have one`);
  }

  for (const f of [
    "src/pages/Academy/Learn/Player/page.tsx",
    "src/pages/Academy/Learn/Check/LessonCheck.tsx",
    "src/pages/Academy/Learn/Exam/page.tsx",
    "src/pages/Academy/Learn/MyCourse/page.tsx",
    "src/pages/Academy/Learn/Complete/page.tsx",
  ]) {
    assert.ok(!/<Popup/.test(read(f)),
      `${f} can show a popup. A lesson, a check and an exam never may.`);
  }

  // And the database refuses those places too, so it is said twice.
  const sql = read("database/lms/16_restructure.sql");
  assert.match(sql, /if p_place not in \('landing','courses','course','me'\) then/,
    "lms_live_popup does not refuse the places a popup may not appear");
});

test("the popup has no do not show again link", () => {
  const src = code(read("src/pages/Academy/ui/Popup.tsx"));
  assert.ok(!/do not show|don't show|dismiss forever|never again/i.test(src),
    "the popup offers to stop showing itself, which is a promise the next campaign breaks");
  // How often it appears is set on the popup, by whoever made it.
  assert.match(read("database/lms/16_restructure.sql"), /how_often/,
    "there is no how often setting on a popup");
});

// ---------------------------------------------------------------------
// 13. The covers are checked in tests/cover-art.test.mjs
// ---------------------------------------------------------------------

test("nothing on a learner page puts answers in browser storage", () => {
  // The sign up form is checked by name in signup-answers.test.mjs.
  // This is the rest of the Academy: a learner's answers, a result and
  // an exam in progress all belong on the server.
  for (const f of [
    "src/pages/Academy/Learn/Exam/page.tsx",
    "src/pages/Academy/Learn/Check/LessonCheck.tsx",
    "src/pages/Academy/Path/page.tsx",
    "src/pages/Academy/Landing/AreaPicker.tsx",
  ]) {
    assert.ok(!/localStorage|sessionStorage|indexedDB/.test(code(read(f))),
      `${f} keeps something in the browser's own storage`);
  }
});

// ---------------------------------------------------------------------
// The launch switch, where the new pages touch it
// ---------------------------------------------------------------------

test("every public Academy page the switch covers says noindex, follow", () => {
  // Found by measuring, not by reading: the path page was emitting NO
  // robots tag at all while the Academy is private. The landing page
  // carries "noindex, follow", and follow tells a crawler to walk the
  // links on it; one of those links is the path banner. So the path page
  // was a way in that the switch did not cover.
  //
  // FOUR public pages, not three: the landing page, the catalogue, a
  // course page and a path page.
  for (const f of [
    "src/pages/Academy/Landing/page.tsx",
    "src/pages/Academy/Courses/page.tsx",
    "src/pages/Academy/Course/page.tsx",
    "src/pages/Academy/Path/page.tsx",
  ]) {
    const src = read(f);
    assert.match(src, /noindex=\{!ACADEMY_PUBLIC\}/,
      `${f} does not gate its robots tag on the launch switch`);
    assert.match(src, /robots="noindex, follow"/,
      `${f} says nofollow, so the links on it stop passing when the switch flips`);
    assert.match(src, /from "\.\.\/\.\.\/\.\.\/lib\/site"/,
      `${f} does not read the switch from the one file both sides import`);
  }
});

test("the exam and the lesson pages stay nofollow, because they are behind a sign in", () => {
  // The default. A page showing one person's own progress has nothing a
  // crawler should follow, switch or no switch.
  for (const f of [
    "src/pages/Academy/Learn/Exam/page.tsx",
    "src/pages/Academy/Learn/Player/page.tsx",
    "src/pages/Academy/Learn/MyCourse/page.tsx",
    "src/pages/Academy/Me/page.tsx",
  ]) {
    const src = read(f);
    assert.ok(!/robots="noindex, follow"/.test(src),
      `${f} is behind a sign in and asks a crawler to follow its links`);
    assert.match(src, /<Seo[^>]*noindex|noindex\s*$|noindex\n/m,
      `${f} has a page with no noindex at all`);
  }
});

test("the path page is not in the sitemap, and the note in _site-routes is true", () => {
  const routesFile = read("api/_site-routes.js");
  assert.match(routesFile, /academyPath:/,
    "academyPath is not accounted for, so a new route can be added with nobody deciding about it");
  // It is in the "not in the sitemap" map, so PUBLIC_ROUTES cannot emit
  // a literal ":slug".
  assert.ok(!/"\/lms\/paths\/:slug"/.test(routesFile.split("NOT_IN_SITEMAP")[0] || routesFile),
    "the path route is listed as a public route, so the sitemap would emit a literal :slug");

  // And the claim in that note has to match vercel.json, which only
  // rewrites three Academy addresses plus the sign up. The note used to
  // say the edge function knows how to write a path page's tags. It does
  // not.
  const meta = read("api/academy-meta.js");
  assert.ok(!/\/lms\/paths/.test(meta),
    "api/academy-meta.js now answers a path address, so the note in _site-routes.js is out of date");
  assert.match(routesFile, /does NOT answer it/,
    "the note no longer says the edge function does not answer a path address");
});
