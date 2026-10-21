// Pasting a sheet of questions, with and without its header row.
//
// WHY THIS TEST EXISTS. Pasting WITHOUT the header row was completely
// broken and had been since the Paste drawer shipped. Thirty rows pasted
// WITH a header worked perfectly, which is why nobody noticed.
//
// The rule for "is the first line the column names?" was "any cell
// matches a column name". A, B, C and D ARE column names, and the Right
// column of every question holds A, B, C or D. So the first question
// always matched, was eaten as the header, and every row after it was
// read against that question's cells. Three rows pasted came back as
// "2 rows read", both skipped, "No question text."
//
// The decision lives in sheet-rule.js as plain JavaScript precisely so
// this file can import it and run the real thing, the same arrangement
// as Player/slices.js. readSheet itself stays in TypeScript because
// Paste.tsx wants its types.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  HEADERS,
  hasHeaderRow,
} from "../src/pages/Academy/Studio/Questions/sheet-rule.js";

const ROOT = new URL("..", import.meta.url).pathname;

/** A question row, as Excel puts it on the clipboard. */
const row = (q, right) => [q, "mean", "mode", "median", "range", right, "because", "", ""];
const header = ["Question", "A", "B", "C", "D", "Right", "Why", "Lesson", "Time"];

test("the column names are read as the column names", () => {
  assert.equal(hasHeaderRow(header), true);
  // and in whatever case somebody's sheet happens to use
  assert.equal(hasHeaderRow(header.map((h) => h.toUpperCase())), true);
  assert.equal(hasHeaderRow(header.map((h) => h.toLowerCase())), true);
  // with spaces around them, which a paste from Google Sheets can carry
  assert.equal(hasHeaderRow(header.map((h) => ` ${h} `)), true);
});

test("a header row that names the first column something else is still a header", () => {
  // Four or more matches carries it: A, B, C, D and Right are five.
  assert.equal(hasHeaderRow(["Prompt", "A", "B", "C", "D", "Right", "Why"]), true);
});

test("A, B, C and D in the Right column do NOT make a question into a header", () => {
  // THE WHOLE POINT. Every one of these was read as a header before.
  for (const right of ["A", "B", "C", "D"]) {
    assert.equal(
      hasHeaderRow(row("Which one is the average?", right)),
      false,
      `a question with Right = ${right} was taken as the header row`,
    );
  }
  // and in lower case, which is just as likely in a real sheet
  for (const right of ["a", "b", "c", "d"]) {
    assert.equal(hasHeaderRow(row("Which one is the average?", right)), false);
  }
});

test("a question that begins with the word Question is not a header", () => {
  assert.equal(hasHeaderRow(row("Question 4: which is the mode?", "B")), false);
  assert.equal(hasHeaderRow(row("Questions like this one", "C")), false);
});

test("the one accepted miss is written down", () => {
  // A question whose entire text is the single word "Question" IS read
  // as a header. That is a word and not a question. The test exists so
  // the behaviour is deliberate rather than discovered.
  assert.equal(hasHeaderRow(row("Question", "B")), true);
});

test("a sheet pasted without its header row reads every line as a question", () => {
  // readSheet is TypeScript, so this works the way the drawer does:
  // decide with the rule, then map the cells onto HEADERS in order.
  const lines = [
    row("Which is the average?", "A"),
    row("Which is the middle?", "C"),
    row("Which is high minus low?", "D"),
  ];
  assert.equal(hasHeaderRow(lines[0]), false);

  const rows = lines.map((cells) => {
    const r = {};
    HEADERS.forEach((h, i) => {
      r[h] = (cells[i] || "").trim();
    });
    return r;
  });

  assert.equal(rows.length, 3, "all three lines are questions, none is a header");
  assert.deepEqual(
    rows.map((r) => r.Question),
    ["Which is the average?", "Which is the middle?", "Which is high minus low?"],
  );
  assert.deepEqual(rows.map((r) => r.Right), ["A", "C", "D"]);
  assert.ok(
    rows.every((r) => r.Question && r.Right),
    "every row has question text and an answer, which is what was failing",
  );
});

test("sheet.ts asks sheet-rule and does not keep its own copy of the rule", () => {
  // A second copy of the decision would drift, and the drifted one would
  // be the one that runs.
  const sql = readFileSync(
    join(ROOT, "src/pages/Academy/Studio/Questions/sheet.ts"),
    "utf8",
  );
  assert.match(sql, /from "\.\/sheet-rule"/, "sheet.ts no longer imports the rule");
  assert.match(sql, /hasHeaderRow\(firstCells\)/, "sheet.ts does not call the rule");
  assert.doesNotMatch(
    sql.replace(/^\s*(\/\/|\*|\/\*).*$/gm, ""),
    /firstCells\.some\(/,
    "sheet.ts still has a cell-matching rule of its own",
  );
});
