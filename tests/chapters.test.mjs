// Reading a pasted chapter list, and deciding which chapters a learner
// may jump to.
//
//   npm test
//
// WHY THIS TEST EXISTS. A facilitator pastes forty lines out of a
// YouTube description. One of them has a typo. "Invalid input" against
// forty lines is not something anybody can act on, so every refusal has
// to name the line and show it, and that is most of what is checked
// here.
//
// The parser is written twice on purpose: here in JavaScript for the
// staff screen's live preview, and in SQL in
// database/lms/16_restructure.sql, which is the authority and parses
// the text again on the way in. The last test reads the SQL and checks
// the two still refuse the same things for the same reasons, because a
// preview that accepts what the database then rejects is worse than no
// preview.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { clock, jumpable, parseChapters } from "../src/pages/Academy/Learn/chapters.js";

// ---------------------------------------------------------------------
// Reading a good list
// ---------------------------------------------------------------------

test("an ordinary pasted list", () => {
  const { chapters, error } = parseChapters(
    "00:00 Opening\n01:15 Finding duplicates\n12:40 Wrapping up",
  );
  assert.equal(error, undefined);
  assert.deepEqual(chapters, [
    { start_seconds: 0, title: "Opening" },
    { start_seconds: 75, title: "Finding duplicates" },
    { start_seconds: 760, title: "Wrapping up" },
  ]);
});

test("an hour long lesson uses h:mm:ss", () => {
  const { chapters, error } = parseChapters("00:00 Start\n1:01:15 Deep in\n2:00:00 Later");
  assert.equal(error, undefined);
  assert.deepEqual(chapters.map((c) => c.start_seconds), [0, 3675, 7200]);
});

test("blank lines between chapters are ordinary, not errors", () => {
  // A pasted description usually has them, and refusing one would send
  // a facilitator hunting for a problem that is not there.
  const { chapters, error } = parseChapters("00:00 Start\n\n  \n02:00 Next\n");
  assert.equal(error, undefined);
  assert.equal(chapters.length, 2);
});

test("windows line endings are handled", () => {
  const { chapters, error } = parseChapters("00:00 Start\r\n02:00 Next");
  assert.equal(error, undefined);
  assert.equal(chapters.length, 2);
});

test("nothing pasted yet is not an error", () => {
  // The staff screen runs this on every keystroke. An empty box is the
  // state it starts in.
  assert.deepEqual(parseChapters(""), { chapters: [] });
  assert.deepEqual(parseChapters("   \n  "), { chapters: [] });
  assert.deepEqual(parseChapters(null), { chapters: [] });
});

test("a title keeps its own spacing and punctuation", () => {
  const { chapters } = parseChapters("00:00 Step 1: open the file (and look)");
  assert.equal(chapters[0].title, "Step 1: open the file (and look)");
});

// ---------------------------------------------------------------------
// Every refusal names the line
// ---------------------------------------------------------------------

const refuses = (text) => {
  const { error } = parseChapters(text);
  assert.ok(error, `this should have been refused:\n${text}`);
  assert.ok(error.message.includes(`Line ${error.line}`) || error.message.includes(`line ${error.line}`),
    `the message does not name the line: ${error.message}`);
  return error;
};

test("the first chapter has to be 00:00", () => {
  const e = refuses("01:00 Start\n02:00 Next");
  assert.match(e.message, /must start at 00:00/);
  assert.match(e.message, /starts at 01:00/);
});

test("the times have to rise", () => {
  const e = refuses("00:00 Start\n05:00 Later\n03:00 Earlier");
  assert.equal(e.line, 3);
  assert.match(e.message, /goes backwards/);
  assert.match(e.message, /03:00 Earlier/);
});

test("the same time twice is backwards too", () => {
  const e = refuses("00:00 Start\n05:00 One\n05:00 Two");
  assert.equal(e.line, 3);
});

test("a line that is not a chapter is named and shown", () => {
  const e = refuses("00:00 Start\nthis is just prose\n02:00 Next");
  assert.equal(e.line, 2);
  assert.match(e.message, /is not a chapter/);
  assert.match(e.message, /this is just prose/);
  // And it says what one looks like, so the fix is obvious.
  assert.match(e.message, /01:15 Finding duplicates/);
});

test("a time with no title is not a chapter", () => {
  refuses("00:00 Start\n02:00");
});

test("70 seconds and 70 minutes are refused by name", () => {
  assert.match(refuses("00:00 Start\n01:70 Bad").message, /70 seconds/);
  assert.match(refuses("00:00 Start\n1:70:00 Bad").message, /70 minutes/);
});

test("a title longer than 120 characters is refused", () => {
  const e = refuses("00:00 " + "x".repeat(121));
  assert.match(e.message, /longer than 120/);
});

test("what was read before the bad line is still returned", () => {
  // The preview shows the good lines and the message under them, so a
  // facilitator can see how far it got.
  const { chapters, error } = parseChapters("00:00 Start\n02:00 Next\nrubbish");
  assert.equal(error.line, 3);
  assert.equal(chapters.length, 2);
});

// ---------------------------------------------------------------------
// Showing the times
// ---------------------------------------------------------------------

test("times are shown the way they were typed", () => {
  assert.equal(clock(0), "00:00");
  assert.equal(clock(75), "01:15");
  assert.equal(clock(760), "12:40");
  assert.equal(clock(3675), "1:01:15");
  assert.equal(clock(-5), "00:00");
});

// ---------------------------------------------------------------------
// Which chapters a learner may jump to
// ---------------------------------------------------------------------

const CH = [
  { start_seconds: 0, title: "Opening" },
  { start_seconds: 75, title: "Finding duplicates" },
  { start_seconds: 300, title: "Wrapping up" },
];

test("on a first watch, only what has been reached", () => {
  const got = jumpable(CH, { furthestSeconds: 80, fullyWatched: false });
  assert.deepEqual(got.map((c) => c.open), [true, true, false]);
});

test("nothing watched yet still opens the first chapter", () => {
  // It starts at zero, which they are already at.
  const got = jumpable(CH, { furthestSeconds: 0, fullyWatched: false });
  assert.deepEqual(got.map((c) => c.open), [true, false, false]);
});

test("after a full watch, all of them", () => {
  // Rewatching is free. This is the rule that stops revision being
  // punished.
  const got = jumpable(CH, { furthestSeconds: 0, fullyWatched: true });
  assert.deepEqual(got.map((c) => c.open), [true, true, true]);
});

test("no chapters at all does not throw", () => {
  assert.deepEqual(jumpable(undefined, {}), []);
  assert.deepEqual(jumpable([], {}), []);
  assert.deepEqual(jumpable(CH), [true, false, false].map((open, i) => ({ ...CH[i], open })));
});

// ---------------------------------------------------------------------
// The database refuses the same things
// ---------------------------------------------------------------------

test("the SQL parser says the same things as this one", () => {
  const sql = readFileSync(new URL("../database/lms/16_restructure.sql", import.meta.url), "utf8");

  assert.ok(sql.includes("lms_parse_chapters"), "file 16 has no chapter parser");

  // Each of these is a refusal a facilitator can actually hit. If the
  // wording drifts apart, the preview and the save say different things
  // about the same paste.
  for (const phrase of [
    "is not a chapter",
    "The first chapter must start at 00:00",
    "goes backwards",
    "seconds, and a minute only has 60",
    "minutes, and an hour only has 60",
    "longer than 120 characters",
  ]) {
    assert.ok(sql.includes(phrase),
      `the database no longer refuses with "${phrase}", so the preview and the save disagree`);
  }

  // And the shape of a line, which is the one thing a facilitator is
  // told to copy.
  assert.ok(sql.includes("01:15 Finding duplicates"),
    "the database's message no longer shows what a chapter line looks like");
});
