// No semicolon inside a string literal or a comment, in any SQL file
// meant for the Supabase SQL Editor.
//
//   npm test
//
// WHY THIS TEST EXISTS. On 14 October 16_verify.sql failed in the
// Supabase SQL Editor with:
//
//     relation "the" does not exist
//
// The same file ran cleanly in psql, and cleanly as one query through
// node-postgres. So the Editor is doing something to the text before
// Postgres sees it.
//
// WHAT IS KNOWN, AND WHAT IS NOT. An earlier version of this comment
// said the cause was semicolons inside string literals, and said it as
// fact. It was wrong, and it was wrong in a way worth leaving on the
// record: taking every semicolon out did NOT fix the file, and nor did
// removing every comment. What finally ran was a version with short
// labels ("check 1", "check 2"), an empty explanation column and no
// comments at all.
//
// The best guess now, and it is a guess: the file that failed had
// phrases like "from the courses table" and "moved into the new table"
// inside its explanation strings. The one that worked had none. That
// would fit an Editor scanning the text for a table name after words
// like from, into, join, update and table, finding "the", and asking
// Postgres about a relation by that name.
//
// So this file enforces two rules, and is honest about why:
//
//   1. No semicolon inside a string literal. Not proven to be the
//      cause. Kept because it costs a reworded sentence and a splitter
//      is a splitter.
//   2. No "from <word>", "into <word>", "join <word>", "update <word>"
//      or "table <word>" inside a string literal in a VERIFY file.
//      This one matches the evidence.
//
// And the belt: 17_verify_EDITOR.sql exists beside 17_verify.sql with
// short labels and no prose at all. That is the file to paste into the
// Editor. The full one stays for reading and for psql.
//
// WHAT IS AND IS NOT ALLOWED, for the semicolon half:
//   - A semicolon ending a statement:     fine, that is the point.
//   - A semicolon inside a $$ ... $$ body: fine. The Editor does
//     understand dollar quoting, which is why file 16, which is almost
//     entirely function bodies, has always run there.
//   - A semicolon inside '...':           NOT allowed.
//   - A semicolon inside a -- comment:    NOT allowed.
//   - A semicolon inside a /* */ comment: NOT allowed.
//
// WHY COMMENTS ARE TREATED DIFFERENTLY FROM STRINGS, and this is
// measured rather than assumed. When this test was first written it
// refused both, and it then reported 135 semicolons sitting in --
// comments across files 01 to 16. Every one of those files has been run
// in the Supabase SQL Editor, most of them more than once, and none has
// ever failed on account of a comment. That is evidence the Editor
// strips comments before it splits, which is the ordinary way to write
// such a splitter.
//
// So: a semicolon in a string literal is refused in EVERY file, because
// that is the one that demonstrably breaks. A semicolon in a comment is
// refused in every file written from file 17 onwards, and the files
// that already exist are grandfathered by name below. Rewriting 135
// lines of comment in files that are already applied to the live
// database would be a large change to fix nothing, and a large change
// to fix nothing is how a real mistake gets lost in a diff.
//
// A grandfathered file stops being grandfathered the moment somebody
// wants to clean it up. Take its name off the list and the test says
// where the work is.
//
// HOW TO SAY IT INSTEAD. In prose, drop the semicolon: "run it by hand
// with: select lms_prune_unconfirmed_signups()". In a LIKE pattern, use
// _ , which matches any single character and is what the pattern wanted
// anyway.

/**
 * Files that existed before this rule, and may keep the semicolons in
 * their COMMENTS. They may not keep one in a string literal: those are
 * fixed, in every file, and nothing is grandfathered from that half.
 *
 * Nothing is ever added to this list. A new file is written to the rule.
 */
const COMMENTS_GRANDFATHERED = new Set([
  "01_core.sql", "02_catalogue.sql", "03_access.sql", "04_learning.sql",
  "05_functions.sql", "06_policies.sql", "07_quizzes.sql",
  "10_roles_and_access.sql", "10_undo.sql", "10_verify.sql",
  "11_housekeeping.sql", "11_undo.sql", "11_verify.sql",
  "12_email_and_health.sql", "12_undo.sql", "12_verify.sql",
  "13_course_certificates.sql", "13_undo.sql", "13_verify.sql",
  "14_public_catalogue.sql", "14_test_course.sql", "14_undo.sql", "14_verify.sql",
  "15_learning_pages.sql", "15_undo.sql", "15_verify.sql",
  "16_restructure.sql", "16_undo.sql", "16_verify.sql",
]);

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Every .sql file in the repository, at any depth. */
function sqlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sqlFiles(full, out);
    else if (name.endsWith(".sql")) out.push(full);
  }
  return out;
}

/**
 * Walk the text once, tracking which of five places we are in, and
 * report every semicolon that is not at statement level.
 *
 * Written as a character walk rather than a regular expression on
 * purpose. The thing being looked for is "a semicolon in a particular
 * context", and context is what a regular expression over a whole file
 * cannot see: it would match the semicolon in a comment that quotes a
 * LIKE pattern, and miss the one in a string that spans two lines.
 */
export function stray(text) {
  const found = [];
  const strings = [];
  let body = "";
  let i = 0;
  let line = 1;
  // "code" | "quote" | "line-comment" | "block-comment" | "dollar"
  let where = "code";
  let dollarTag = "";
  let opened = 1;

  while (i < text.length) {
    const c = text[i];
    const two = text.slice(i, i + 2);

    if (c === "\n") line += 1;

    if (where === "code") {
      // A dollar quoted body: $$ or $tag$. Everything up to the
      // matching close is somebody else's code, semicolons and all.
      const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(text.slice(i));
      if (dollar) {
        where = "dollar";
        dollarTag = dollar[0];
        i += dollarTag.length;
        continue;
      }
      if (c === "'") { where = "quote"; opened = line; i += 1; continue; }
      if (two === "--") { where = "line-comment"; opened = line; i += 2; continue; }
      if (two === "/*") { where = "block-comment"; opened = line; i += 2; continue; }
      i += 1;
      continue;
    }

    if (where === "dollar") {
      if (text.startsWith(dollarTag, i)) { where = "code"; i += dollarTag.length; continue; }
      i += 1;
      continue;
    }

    if (where === "quote") {
      // '' inside a string is an escaped quote, not the end of it.
      if (two === "''") { body += "''"; i += 2; continue; }
      if (c === "'") {
        strings.push({ text: body, line: opened });
        body = "";
        where = "code";
        i += 1;
        continue;
      }
      if (c === ";") found.push({ line, where: "a string literal", opened });
      body += c;
      i += 1;
      continue;
    }

    if (where === "line-comment") {
      if (c === "\n") { where = "code"; i += 1; continue; }
      if (c === ";") found.push({ line, where: "a -- comment", opened });
      i += 1;
      continue;
    }

    // block-comment
    if (two === "*/") { where = "code"; i += 2; continue; }
    if (c === ";") found.push({ line, where: "a /* */ comment", opened });
    i += 1;
  }

  return found;
}

/**
 * Every single quoted string in the text, with the line it started on.
 *
 * Shares the walk above rather than using a regular expression, for the
 * same reason: a quote inside a comment does not open a string, and
 * nothing short of walking the text knows that.
 */
export function literals(text) {
  const out = [];
  let i = 0;
  let line = 1;
  let where = "code";
  let dollarTag = "";
  let body = "";
  let opened = 1;

  while (i < text.length) {
    const c = text[i];
    const two = text.slice(i, i + 2);
    if (c === "\n") line += 1;

    if (where === "code") {
      const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(text.slice(i));
      if (dollar) { where = "dollar"; dollarTag = dollar[0]; i += dollarTag.length; continue; }
      if (c === "'") { where = "quote"; body = ""; opened = line; i += 1; continue; }
      if (two === "--") { where = "line-comment"; i += 2; continue; }
      if (two === "/*") { where = "block-comment"; i += 2; continue; }
      i += 1;
      continue;
    }
    if (where === "dollar") {
      if (text.startsWith(dollarTag, i)) { where = "code"; i += dollarTag.length; continue; }
      i += 1;
      continue;
    }
    if (where === "quote") {
      if (two === "''") { body += "''"; i += 2; continue; }
      if (c === "'") { out.push({ text: body, line: opened }); where = "code"; i += 1; continue; }
      body += c;
      i += 1;
      continue;
    }
    if (where === "line-comment") {
      if (c === "\n") where = "code";
      i += 1;
      continue;
    }
    if (two === "*/") { where = "code"; i += 2; continue; }
    i += 1;
  }
  return out;
}

/**
 * The words that look like the start of a table reference.
 *
 * NOT a guess about English: these are the five words after which SQL
 * expects a table name, which is what makes "from the courses table"
 * dangerous inside a sentence and "the courses table" harmless.
 */
const TABLE_WORDS = ["from", "into", "join", "update", "table"];

/**
 * Every "<keyword> <word>" inside a PROSE string.
 *
 * A string holding % is a LIKE pattern, and a verify file is full of
 * them: they match against a function's own source, so "update
 * lms_quizzes" inside one is the thing being looked for rather than a
 * sentence. Those are exempt.
 *
 * That distinction is not a guess about intent. A pattern has a wildcard
 * in it; a sentence does not. If somebody ever writes a sentence with a
 * per cent sign in it, they lose this check on that one string, which is
 * a small price for not having to rewrite every pattern in the file.
 */
export function tableish(text) {
  const out = [];
  for (const s of literals(text)) {
    if (s.text.includes("%")) continue;

    // A string that IS a query is not prose about one either. Same
    // exemption as a LIKE pattern, by a different door.
    //
    // 19_verify.sql has to ask about a table that does not exist until
    // file 19 has run, and the only way is query_to_xml, because
    // Postgres resolves every relation when it PLANS a statement rather
    // than when a CASE reaches it. Those strings are real SQL naming
    // real tables, so an Editor scanning one finds lms_profiles and asks
    // Postgres about lms_profiles, which exists. The failure this rule
    // is for is a scanner finding "the" or "a" after from, and that only
    // happens in a sentence.
    //
    // Narrow on purpose: the string has to START with a SQL verb.
    // "counted from the courses table" does not, and is still caught.
    if (/^\s*(select|insert|update|delete|with)\b/i.test(s.text)) continue;
    const re = new RegExp(`\\b(${TABLE_WORDS.join("|")})\\s+([A-Za-z_][A-Za-z0-9_]*)`, "gi");
    let m;
    while ((m = re.exec(s.text)) !== null) {
      out.push({ line: s.line, phrase: `${m[1]} ${m[2]}` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// The detector itself, before it is trusted with the real files
// ---------------------------------------------------------------------

test("the detector finds a semicolon in a string literal", () => {
  const hits = stray("select 'run it with: select f();' as note;\n");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].where, "a string literal");
});

test("the detector finds one in either kind of comment", () => {
  assert.equal(stray("-- run it with: select f();\nselect 1;\n")[0].where, "a -- comment");
  assert.equal(stray("/* run it with: select f(); */\nselect 1;\n")[0].where, "a /* */ comment");
});

test("the detector leaves statement semicolons and dollar bodies alone", () => {
  assert.deepEqual(stray("select 1; select 2;\n"), []);
  assert.deepEqual(
    stray("create function f() returns void language plpgsql as $$\nbegin\n  perform 1;\n  perform 2;\nend $$;\n"),
    [],
    "a function body was flagged, and those are the one place semicolons must be",
  );
  assert.deepEqual(
    stray("do $outer$ begin perform 1; end $outer$;\n"),
    [],
    "a tagged dollar body was flagged",
  );
});

test("the detector is not fooled by an escaped quote", () => {
  // The string ends at the LAST quote, not at the doubled pair in the
  // middle, so the semicolon after it is at statement level.
  assert.deepEqual(stray("select 'file 02''s wording' as a;\n"), []);
  // And one genuinely inside a string with an escaped quote in it is
  // still found.
  assert.equal(stray("select 'file 02''s rule: select f();' as a;\n").length, 1);
});

test("the detector does not treat a quote inside a comment as opening a string", () => {
  // Otherwise a comment with an apostrophe in it would swallow the rest
  // of the file and every semicolon after it would be reported.
  assert.deepEqual(stray("-- Big Sam's note\nselect 1;\nselect 2;\n"), []);
});

// ---------------------------------------------------------------------
// The real files
// ---------------------------------------------------------------------

test("no SQL file hides a semicolon in a string literal, which is the one that breaks", () => {
  const bad = [];
  for (const file of sqlFiles(join(ROOT, "database"))) {
    for (const hit of stray(readFileSync(file, "utf8"))) {
      if (hit.where !== "a string literal") continue;
      bad.push(`${relative(ROOT, file)}:${hit.line}`
        + (hit.opened !== hit.line ? ` (string opened on line ${hit.opened})` : ""));
    }
  }
  assert.deepEqual(
    bad,
    [],
    "The Supabase SQL Editor splits a script on semicolons before sending it and does not know "
      + "that one inside '...' is just a character, so each of these can cut a statement in half "
      + "and hand Postgres the tail of a sentence to parse:\n  " + bad.join("\n  ")
      + "\n\nIn prose, drop the semicolon. In a LIKE pattern, use _ instead.",
  );
});

test("no SQL file written from file 17 onwards hides one in a comment either", () => {
  const bad = [];
  for (const file of sqlFiles(join(ROOT, "database"))) {
    const name = file.split("/").pop();
    if (COMMENTS_GRANDFATHERED.has(name)) continue;
    // database/lms/tests/ never goes near the Editor. Those files make
    // a learner, sit an exam and roll the lot back, so they are run on
    // a local Postgres through psql and nowhere else. The string
    // literal half above still covers them, because that costs nothing.
    if (file.includes("/database/lms/tests/")) continue;
    for (const hit of stray(readFileSync(file, "utf8"))) {
      if (hit.where === "a string literal") continue;
      bad.push(`${relative(ROOT, file)}:${hit.line} has a semicolon inside ${hit.where}`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    "Belt and braces: a comment has never been known to break the Editor, which strips them "
      + "before it splits, but a splitter is a splitter and the cost of avoiding this is a "
      + "reworded sentence:\n  " + bad.join("\n  "),
  );
});

test("the grandfathered list is a closed list, not a place to put new files", () => {
  // If a file from 17 onwards ever appears on it, the rule has been
  // turned off rather than followed.
  for (const name of COMMENTS_GRANDFATHERED) {
    const n = Number(name.slice(0, 2));
    assert.ok(n <= 16,
      `${name} is on the grandfathered list. The list is for files that existed before the rule.`);
  }
});

// ---------------------------------------------------------------------
// The rule that matches the evidence: no table-shaped phrase in a
// verify file's strings
// ---------------------------------------------------------------------

test("the detector finds a table-shaped phrase inside a string", () => {
  // "table" at the very end matches nothing, because there is no word
  // after it for Postgres to mistake for a relation. That is the right
  // behaviour: it is the NEXT word that becomes the table name.
  assert.deepEqual(
    tableish("select 'counted from the courses table' as note;\n").map((h) => h.phrase),
    ["from the"],
  );
  assert.deepEqual(
    tableish("select 'moved into the new table now' as n;\n").map((h) => h.phrase),
    ["into the", "table now"],
  );
});

test("the detector leaves real SQL alone", () => {
  // from, into and join OUTSIDE a string are the whole language. Only
  // what is inside quotes is suspect.
  assert.deepEqual(tableish("select * from lms_courses c join lms_modules m on m.id = c.id;\n"), []);
  assert.deepEqual(tableish("insert into lms_areas (slug) values ('analysis');\n"), []);
  // and a string with no keyword in it is fine
  assert.deepEqual(tableish("select 'the courses are published' as note;\n"), []);
});

test("no verify file has a table-shaped phrase in any of its strings", () => {
  // THE RULE THAT MATCHES THE EVIDENCE. The 16_verify.sql that failed in
  // the Supabase Editor had "from the courses table" and "moved into the
  // new table" in its explanation strings. The version that ran had
  // none. The cause is still a guess, but this is the thing the two
  // versions actually differed by, and the cost of avoiding it is a
  // reworded sentence.
  //
  // VERIFY FILES ONLY. A restructure file is full of prose about tables
  // and is pasted into the Editor as one long script rather than as a
  // single final statement, and none of those has ever failed. Widening
  // this to every file would mean rewriting thousands of words of
  // comment to fix nothing.
  const bad = [];
  for (const file of sqlFiles(join(ROOT, "database"))) {
    if (!/_verify(_EDITOR)?\.sql$/.test(file)) continue;
    // Files 10 to 16 are grandfathered, exactly as they are for the
    // comment rule and for the same reason: they are applied to the
    // live database and rewriting their prose would be a large change
    // that fixes nothing. The number is read off the file name.
    const n = Number((file.split("/").pop() || "").slice(0, 2));
    if (n <= 16) continue;
    for (const hit of tableish(readFileSync(file, "utf8"))) {
      bad.push(`${relative(ROOT, file)}:${hit.line} has "${hit.phrase}" inside a string`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    "A verify file is pasted into the Supabase SQL Editor, which appears to scan the text for a "
      + "table name after from, into, join, update or table. These phrases sit inside string "
      + "literals, where a table name is the one thing they are not:\n  " + bad.join("\n  ")
      + "\n\nReword them. \"counted from the courses table\" becomes \"counted off the courses\".",
  );
});

test("17_verify.sql and 17_verify_EDITOR.sql hold the same checks", () => {
  // The EDITOR one is what Big Sam pastes. If it ever holds fewer
  // checks than the full one, he is being told everything is fine on
  // the strength of a shorter list.
  const full = readFileSync(join(ROOT, "database/lms/17_verify.sql"), "utf8");
  const editor = readFileSync(join(ROOT, "database/lms/17_verify_EDITOR.sql"), "utf8");

  // "select 1 as n," in the full file, "select 1," in the editor one.
  // The alias has to be optional or the first check is missed and the
  // two files look one apart when they are not.
  const numbers = (src) =>
    [...src.matchAll(/^\s*(?:union all )?select (\d+)(?: as n)?,/gm)]
      .map((m) => Number(m[1]))
      .sort((a, b) => a - b);

  const a = numbers(full);
  const b = numbers(editor);
  assert.ok(a.length > 0, "17_verify.sql has no checks at all");
  assert.deepEqual(b, a,
    `the two verify files hold different checks. Full: ${a.length}, editor: ${b.length}`);
});

test("the editor file carries no prose for the Editor to misread", () => {
  const editor = readFileSync(join(ROOT, "database/lms/17_verify_EDITOR.sql"), "utf8");
  assert.ok(!/--/.test(editor), "17_verify_EDITOR.sql has a comment in it");
  assert.ok(!/\/\*/.test(editor), "17_verify_EDITOR.sql has a block comment in it");
  assert.deepEqual(tableish(editor), [],
    "17_verify_EDITOR.sql has a table-shaped phrase in a string, which is the thing it exists to avoid");
  // Every label is "check N", and every note is empty. That is the
  // actual requirement, so it is what is asserted.
  //
  // A length limit was tried first and was the wrong shape: it fired on
  // 'TABLE(ok boolean, message text)', which is a type signature being
  // compared against, not something anybody reads. A rule that has to
  // be excused is a rule aimed at the wrong thing.
  const labels = [...editor.matchAll(/^\s+'(check \d+)',$/gm)].length;
  const notes = [...editor.matchAll(/^\s+'',?$/gm)].length;
  const checks = [...editor.matchAll(/^\s*(?:union all )?select \d+,$/gm)].length;
  assert.equal(labels, checks, "not every check in the editor file is labelled \"check N\"");
  assert.equal(notes, checks, "not every check in the editor file has an empty note");
});

// ---------------------------------------------------------------------
// No UPDATE or DELETE without a WHERE
// ---------------------------------------------------------------------

test("no SQL file updates or deletes every row of a table", () => {
  // THE SECOND HALF OF A PAIR, AND THE PAIR IS NOW COMPLETE. An earlier
  // version of this comment said pg-safeupdate could not be installed
  // here, so this static scan was all that was on offer. That is no
  // longer true and the claim has been removed rather than left to rot:
  // the extension was built from source against
  // postgresql-server-dev-16, and the whole matrix and every test file
  // in this folder now run with it loaded, exactly as Supabase loads it
  // for requests arriving through the API.
  //
  // Both halves are still worth having, because they fail on different
  // things. safeupdate catches a bare statement when it RUNS, including
  // one assembled at run time out of a string, and catches nothing in a
  // code path no test happens to walk. This reads the text instead, so
  // it covers statements no test reaches and misses anything dynamic.
  //
  // ON CONFLICT DO UPDATE is outside the rule by construction rather
  // than by exemption: such a statement starts with "insert", so the
  // pattern below never looks at it. The same is true of "for update",
  // "on update cascade" and "before update on", which is what sank the
  // first version of this test.
  //
  // The numbered files are the ones Dr Ayoola asked about and the ones
  // that matter, since those run on live. The tests and seeds are
  // scanned too: clearing a whole table is their legitimate business, so
  // they hold most of the "where true" in the repository, and with the
  // guard loaded in the harness a bare one there now stops the matrix
  // dead. Better to say so here than to discover it mid-run.
  const dir = (sub) => readdirSync(join(ROOT, "database/lms", sub || "."))
    .filter((f) => f.endsWith(".sql") && !f.includes("_EDITOR"))
    .map((f) => (sub ? `${sub}/${f}` : f))
    .sort();
  const numbered = dir().filter((f) => /^\d+_/.test(f));
  const files = [...numbered, ...dir("tests")];
  assert.ok(numbered.length >= 15, `only found ${numbered.length} numbered SQL files`);

  const bad = [];
  for (const file of files) {
    // Comments out, strings blanked: a sentence about deleting things is
    // not a delete, and the sixth scanner of mine to learn that.
    const sql = readFileSync(join(ROOT, "database/lms", file), "utf8")
      .replace(/^\s*--.*$/gm, "")
      .replace(/'(?:[^']|'')*'/g, (s) => " ".repeat(s.length));

    // A STATEMENT, not the word. The first version matched "update"
    // anywhere and reported fourteen faults that were all "on update
    // cascade", "for update" and "before update on", which is every
    // place the word appears in DDL and none of them a statement.
    //
    // Splitting on the semicolons and asking what each piece STARTS
    // with is both simpler and right, because that is what a statement
    // is.
    let at = 0;
    for (const piece of sql.split(";")) {
      const stmt = piece.trim();
      at += piece.length + 1;
      const m = /^(update|delete\s+from)\s+([a-z_][a-z0-9_.]*)/i.exec(stmt);
      if (!m) continue;
      if (/\bwhere\b/i.test(stmt)) continue;
      const line = sql.slice(0, at - piece.length - 1).split("\n").length;
      bad.push(`${file}:${line} ${m[1].toLowerCase()} ${m[2]} with no WHERE`);
    }
  }

  assert.deepEqual(bad, [],
    "these touch every row of a table, which is almost never what was meant:\n  " + bad.join("\n  "));
});

// ---------------------------------------------------------------------
// The file 21 allow list, which is written down in more than one place
// ---------------------------------------------------------------------

test("every copy of the file 21 allow list says the same thing", () => {
  // THE LIST OF lms_ FUNCTIONS A VISITOR MAY EXECUTE is written out four
  // times: twice in 21_verify.sql, because its second statement is after
  // a semicolon and so cannot see the first one's CTE, once in
  // file_21_tests.sql as the assertion, and once more there as the
  // reverse check that no name on the list is unused. Four copies is
  // three too many, and the alternative was worse: a list held in a
  // table would drift from the file that is supposed to govern it, and
  // the verify file has to stand alone because Big Sam pastes it into
  // the Supabase editor on its own.
  //
  // So the copies are allowed and this test is what stops them drifting.
  // It finds every array literal that mentions lms_can_edit, which is
  // the first name on the list in all four, and insists they are
  // identical as sets.
  const files = [
    "database/lms/21_verify.sql",
    "database/lms/tests/file_21_tests.sql",
  ];

  const lists = [];
  for (const f of files) {
    const sql = readFileSync(join(ROOT, f), "utf8");
    // array[ ... ] blocks, non greedy to the matching close bracket. The
    // names are plain quoted identifiers with no commas inside them, so
    // this does not need the full dollar quoting walk the generator has.
    for (const m of sql.matchAll(/array\s*\[([^\]]*)\]/gi)) {
      // The exact quoted name, with no bracket after it. The signature
      // lists elsewhere in these files hold 'lms_can_edit()' instead,
      // and matching those collected an array of nothing and reported it
      // as a list that had lost all 26 names.
      if (!m[1].includes("'lms_can_edit'")) continue;
      const names = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
      const line = sql.slice(0, m.index).split("\n").length;
      lists.push({ where: `${f}:${line}`, names });
    }
  }

  assert.ok(lists.length >= 3,
    `expected the allow list in at least three places, found ${lists.length}`);

  const first = lists[0];
  assert.ok(first.names.length >= 20,
    `the allow list at ${first.where} has only ${first.names.length} names, which cannot be right`);

  for (const l of lists.slice(1)) {
    assert.deepEqual(l.names, first.names,
      `the allow list at ${l.where} does not match the one at ${first.where}.\n` +
      `  only in ${first.where}: ${first.names.filter((n) => !l.names.includes(n)).join(", ") || "none"}\n` +
      `  only in ${l.where}: ${l.names.filter((n) => !first.names.includes(n)).join(", ") || "none"}`);
  }

  // And the file that does the revoking must not name anything that is
  // on the allow list, which would be a flat contradiction.
  const fix = readFileSync(join(ROOT, "database/lms/21_execute_privileges.sql"), "utf8")
    .replace(/^\s*--.*$/gm, "");
  const revoked = new Set(
    [...fix.matchAll(/revoke\s+execute\s+on\s+function\s+([a-z_]+)\s*\(/gi)].map((m) => m[1]),
  );
  const contradictions = first.names.filter((n) => revoked.has(n));
  assert.deepEqual(contradictions, [],
    "these are on the allow list AND revoked by file 21, which cannot both be intended: " +
      contradictions.join(", "));
});
