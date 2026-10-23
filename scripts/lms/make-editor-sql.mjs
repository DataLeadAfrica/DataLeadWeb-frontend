// Makes the *_EDITOR.sql copy of a SQL file meant for the Supabase SQL
// Editor, and is the only thing allowed to make one.
//
//   node scripts/lms/make-editor-sql.mjs            # write every copy
//   node scripts/lms/make-editor-sql.mjs --check    # fail if any is stale
//
// WHY THIS EXISTS. 16_verify.sql failed in the Supabase SQL Editor with
// `relation "the" does not exist` while running cleanly in psql. Taking
// out the semicolons did not fix it and nor did removing the comments.
// What ran was a version with no prose in it at all. The cause is still a
// guess: the Editor appears to scan the text for a table name after words
// like from, into, join, update and table, find one inside a sentence like
// "from the courses table", and ask Postgres about a table called "the".
//
// A code fragment inside a LIKE pattern has since been through the Editor
// and was fine, so prose is the only thing ever known to break it.
//
// WHAT IS STRIPPED, AND WHAT IS NOT. Comments BETWEEN function bodies go.
// Comments INSIDE a $$ body stay, byte for byte, for two reasons:
//
//   1. They are part of the function's stored source, so changing them
//      changes what the database holds.
//   2. 17_verify.sql row 16 reads PASS ONE and PASS TWO back out of
//      lms_nightly_prune's source. Strip those and the row turns NO while
//      the function itself is perfectly fine, which is the worst kind of
//      failure because it looks like a real fault.
//
// A body is never reached by the Editor's scanner anyway: it is one long
// string to the parser, so prose is safe in there and only the text
// around it matters.
//
// This is how file 17 actually went live. Big Sam ran a copy made this way
// and compared every stored function source against a psql build: identical
// apart from one trailing space. Hence the rule from the review that
// anything the run order says to paste gets a generated copy, and hence
// the test beside this that the bodies still match.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

// Every file the run order tells Big Sam to paste into the Editor, and
// which of the two shapes it takes. The shape is decided by what the file
// is, not by preference:
//
//   "bodies"  A file of functions. The prose lives inside $$ bodies, where
//             the Editor's scanner cannot reach it, so only the comments
//             between the bodies are removed.
//
//   "checks"  A verify file. It has no bodies at all, so every word in it
//             is either code or a string the Editor can read. The labels
//             become "check 1", "check 2" and so on, the note column is
//             emptied, and the explanations live in PHASE-6B-PLAIN.md
//             instead. This is the shape Big Sam actually got 57 of 57 on.
export const EDITOR_FILES = [
  { source: "database/lms/17_control_room.sql", shape: "bodies" },
  { source: "database/lms/17_undo.sql", shape: "bodies" },
  { source: "database/lms/17_verify.sql", shape: "checks" },
  { source: "database/lms/18_profile_name.sql", shape: "bodies" },
  { source: "database/lms/18_undo.sql", shape: "bodies" },
  { source: "database/lms/18_verify.sql", shape: "checks" },
  { source: "database/lms/19_email_check.sql", shape: "bodies" },
  { source: "database/lms/19_undo.sql", shape: "bodies" },
  { source: "database/lms/19_verify.sql", shape: "checks" },
  { source: "database/lms/20_lesson_checks.sql", shape: "bodies" },
  { source: "database/lms/20_undo.sql", shape: "bodies" },
  { source: "database/lms/20_verify.sql", shape: "checks" },
  { source: "database/lms/21_execute_privileges.sql", shape: "bodies" },
  { source: "database/lms/21_undo.sql", shape: "bodies" },
  { source: "database/lms/21_verify.sql", shape: "checks" },
  { source: "database/lms/22_gaps.sql", shape: "bodies" },
  { source: "database/lms/22_undo.sql", shape: "bodies" },
  { source: "database/lms/22_verify.sql", shape: "checks" },
  { source: "database/lms/23_certificate_integrity.sql", shape: "bodies" },
  { source: "database/lms/23_undo.sql", shape: "bodies" },
  { source: "database/lms/23_verify.sql", shape: "checks" },
  { source: "database/lms/24_module_badges.sql", shape: "bodies" },
  { source: "database/lms/24_undo.sql", shape: "bodies" },
  { source: "database/lms/24_verify.sql", shape: "checks" },
  { source: "database/lms/26_table_writes.sql", shape: "bodies" },
  { source: "database/lms/26_undo.sql", shape: "bodies" },
  { source: "database/lms/26_verify.sql", shape: "checks" },
];

/**
 * Splits SQL into alternating pieces so a caller can treat the code
 * around function bodies differently from the bodies themselves.
 *
 * Returns [{ body: false, text }, { body: true, text }, ...] where a body
 * piece includes its own $tag$ delimiters, so joining the pieces back
 * together reproduces the input exactly.
 *
 * Tracked properly rather than with a regex, because all four of these
 * can contain the others' opening marks and a regex cannot tell which
 * one it is inside:
 *   - a dollar quoted body, $$ or $function$ or $do$
 *   - a single quoted string, where '' is an escaped quote
 *   - a -- line comment
 *   - a / * block comment, which Postgres allows to nest
 */
export function split(sql) {
  const pieces = [];
  let plain = "";
  let i = 0;

  /** A $tag$ at i, or null. Never matches $1, which is a parameter. */
  const dollarTagAt = (at) => {
    if (sql[at] !== "$") return null;
    const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(at));
    return m ? m[0] : null;
  };

  while (i < sql.length) {
    const two = sql.slice(i, i + 2);

    if (two === "--") {
      const end = sql.indexOf("\n", i);
      plain += sql.slice(i, end === -1 ? sql.length : end);
      i = end === -1 ? sql.length : end;
      continue;
    }

    if (two === "/*") {
      // Postgres nests these, so count the depth rather than finding the
      // first close.
      let depth = 1;
      let j = i + 2;
      while (j < sql.length && depth > 0) {
        if (sql.slice(j, j + 2) === "/*") { depth += 1; j += 2; }
        else if (sql.slice(j, j + 2) === "*/") { depth -= 1; j += 2; }
        else j += 1;
      }
      plain += sql.slice(i, j);
      i = j;
      continue;
    }

    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j += 1; break; }
        j += 1;
      }
      plain += sql.slice(i, j);
      i = j;
      continue;
    }

    const tag = dollarTagAt(i);
    if (tag) {
      const close = sql.indexOf(tag, i + tag.length);
      const end = close === -1 ? sql.length : close + tag.length;
      if (plain) { pieces.push({ body: false, text: plain }); plain = ""; }
      pieces.push({ body: true, text: sql.slice(i, end) });
      i = end;
      continue;
    }

    plain += sql[i];
    i += 1;
  }

  if (plain) pieces.push({ body: false, text: plain });
  return pieces;
}

/** Just the $tag$ bodies, in order, for comparing two files. */
export function bodies(sql) {
  return split(sql).filter((p) => p.body).map((p) => p.text);
}

/**
 * The Editor copy: comments outside the bodies removed, bodies untouched.
 *
 * A comment is only removed where it really is a comment. "--" inside a
 * single quoted string stays, because that is data and cutting it would
 * change what a statement does.
 */
export function stripComments(sql) {
  const parts = [];

  for (const piece of split(sql)) {
    if (piece.body) { parts.push(piece.text); continue; }

    // Walk this piece the same way, so a -- inside a string survives.
    let i = 0;
    let text = piece.text;
    let kept = "";
    while (i < text.length) {
      const two = text.slice(i, i + 2);
      if (two === "--") {
        const end = text.indexOf("\n", i);
        i = end === -1 ? text.length : end;   // the newline itself is kept
        continue;
      }
      if (two === "/*") {
        let depth = 1;
        let j = i + 2;
        while (j < text.length && depth > 0) {
          if (text.slice(j, j + 2) === "/*") { depth += 1; j += 2; }
          else if (text.slice(j, j + 2) === "*/") { depth -= 1; j += 2; }
          else j += 1;
        }
        i = j;
        continue;
      }
      if (text[i] === "'") {
        let j = i + 1;
        while (j < text.length) {
          if (text[j] === "'" && text[j + 1] === "'") { j += 2; continue; }
          if (text[j] === "'") { j += 1; break; }
          j += 1;
        }
        kept += text.slice(i, j);
        i = j;
        continue;
      }
      kept += text[i];
      i += 1;
    }

    // A comment that was a whole line leaves its indent and its newline
    // behind. Tidy that, and collapse the runs of blank lines it makes,
    // so the file a person pastes is not mostly whitespace.
    //
    // TIDIED PER PIECE, NOT OVER THE WHOLE FILE. The first version of
    // this ran over the finished string, which includes the bodies, and
    // it took one trailing space off the inside of lms_reorder_lessons:
    // "declare p text[]; " became "declare p text[];". One body in 71,
    // changed by a whitespace rule that had no business touching a body
    // at all, and the comment here used to claim it never did.
    //
    // The review allowed the body comparison to ignore trailing
    // whitespace at end of line, and Big Sam's hand made copy differed
    // from a psql build by exactly one trailing space, which is very
    // likely this same one. Doing it per piece means the tolerance is
    // not needed: the bodies come out byte for byte identical and the
    // test asserts that, with nothing forgiven.
    // AND THE LAST LINE OF A PIECE IS LEFT ALONE, because a piece can end
    // in the middle of a line with a body starting right after it. The
    // space in "do $$" belongs to such a line: strip it as trailing
    // whitespace and the file says "do$$", which is a syntax error that
    // only shows when the generated copy is actually run. It is the best
    // argument for the rule that the generated copy, not the original,
    // goes through the database matrix.
    const lines = kept.split("\n");
    const last = lines.pop();
    parts.push(
      lines
        .map((line) => (line.trim() === "" ? "" : line.replace(/\s+$/, "")))
        .concat([last])
        .join("\n")
        .replace(/\n{3,}/g, "\n\n"),
    );
  }

  return parts.join("");
}

/** The Editor copy of a file of functions: header, then the stripped SQL. */
export function toEditor(sql) {
  const out = stripComments(sql);

  const header = [
    "-- GENERATED. Do not edit.",
    "--",
    "-- Made by scripts/lms/make-editor-sql.mjs from the file named below.",
    "-- The comments between the function bodies are removed. Every body is",
    "-- byte for byte what that file holds, and a test checks it.",
    "--",
    "-- Paste THIS one into the Supabase SQL Editor.",
    "--",
    "-- source: SOURCE_PATH",
    "",
  ].join("\n");

  return header + out.replace(/^\n+/, "");
}

/**
 * The Editor copy of a verify file: labels become "check N", the note
 * column is emptied, and the comments go. The checks themselves, which
 * are the part that could be wrong, are copied across untouched.
 *
 * GENERATED RATHER THAN TYPED because I said in a reply that the two files
 * could not drift, and at the time that was only true in the sense that
 * I had generated the first one by hand once. A test asserted the check
 * NUMBERS matched, which would catch a check being added or removed and
 * would not catch one being changed. Now the file is rebuilt from the
 * full one and compared, so a change to a check that is not carried over
 * is a failing test rather than a silently weaker file in Big Sam's
 * hands.
 */
export function toChecksEditor(sql) {
  // No $$ bodies in a verify file, so comment stripping is the plain
  // case: one piece, strings respected.
  // stripComments, NOT toEditor. The first version called toEditor and
  // then cut its generated header off with a regex, and the regex was
  // not anchored to the end of the header, so it ran on to the first
  // blank line and took "with checks as (" with it. The file still
  // looked plausible and would have failed in the Editor on line one.
  let text = stripComments(sql).replace(/^\n+/, "");

  // THE CHECKS CTE NEED NOT BE THE FIRST ONE.
  //
  // This matched only the literal "with checks as (" until file 21,
  // which puts its allow list and three signature lists in CTEs of
  // their own ahead of the checks. The rewrite then did nothing, so the
  // generated copy had a checks CTE with no column names while its
  // final select still asked for n, checking, answer and note, and the
  // Editor answered "column n does not exist".
  //
  // So both shapes are handled: "with checks as (" when it leads, and a
  // bare "checks as (" at the start of a line when other CTEs come
  // first. Anchored to the line start and to the name "checks" exactly,
  // so a CTE called something else is left alone.
  const cols = "checks (n, checking, answer, note) as (";
  if (/with\s+checks as \(/.test(text)) {
    text = text.replace(/with\s+checks as \(/, "with " + cols);
  } else if (/\nchecks as \(/.test(text)) {
    text = text.replace(/\nchecks as \(/, "\n" + cols);
  } else {
    throw new Error("cannot find the checks CTE to name its columns");
  }

  // Where each check starts, and therefore where each one ends.
  const starts = [...text.matchAll(/(?:^|\n)(\s*)(?:union all )?select (\d+)(?: as n)?,/g)]
    .map((m) => ({ at: m.index, n: Number(m[2]) }));
  if (!starts.length) throw new Error("no checks found in the verify file");

  // The tail is the closing bracket and the final select.
  const tailAt = text.lastIndexOf("\n)");
  if (tailAt < starts[starts.length - 1].at) throw new Error("cannot find the end of the checks");

  /** Every single quoted string in a piece of SQL, with its position. */
  const literalsIn = (s) => {
    const out = [];
    let i = 0;
    while (i < s.length) {
      if (s[i] !== "'") { i += 1; continue; }
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "'" && s[j + 1] === "'") { j += 2; continue; }
        if (s[j] === "'") { j += 1; break; }
        j += 1;
      }
      out.push({ from: i, to: j });
      i = j;
    }
    return out;
  };

  let out = "";
  let cursor = 0;
  for (let k = 0; k < starts.length; k += 1) {
    const from = starts[k].at;
    const to = k + 1 < starts.length ? starts[k + 1].at : tailAt;
    out += text.slice(cursor, from);

    let block = text.slice(from, to);
    const lits = literalsIn(block);
    if (lits.length < 2) throw new Error(`check ${starts[k].n} has too few strings to rewrite`);

    // The FIRST string in a check is its label and the LAST is its note.
    // Everything between them is part of the check and is left alone.
    const first = lits[0];
    const last = lits[lits.length - 1];
    block =
      block.slice(0, first.from) +
      `'check ${starts[k].n}'` +
      block.slice(first.to, last.from) +
      "''" +
      block.slice(last.to);

    // "select 1 as n," on the first check becomes "select 1,", and the
    // three column aliases go with it: the column names are stated once
    // in the "with checks (n, checking, answer, note)" line instead.
    // Only the first check carries them, the rest being positional.
    block = block
      .replace(/select (\d+) as n,/, "select $1,")
      .replace(/ as checking,/, ",")
      .replace(/ as answer,/, ",")
      .replace(/ as what_it_means\b/, "");

    out += block;
    cursor = to;
  }

  out += text
    .slice(cursor)
    .replace(
      /select n as "#"[\s\S]*?order by n;/,
      'select n as "#", checking as "what", answer as "answer", note as "note"\n  from checks order by n;',
    );

  return out;
}

/** Where the Editor copy of a source file lives. */
export function editorPathFor(path) {
  return join(dirname(path), basename(path).replace(/\.sql$/, "_EDITOR.sql"));
}

export function build({ source, shape }) {
  const sql = readFileSync(join(ROOT, source), "utf8");
  if (shape === "checks") {
    // No generated header on this one: it is the file that exists because
    // prose in it is suspected of breaking the Editor, so it carries none
    // at all, not even mine.
    return toChecksEditor(sql);
  }
  return toEditor(sql).replace("SOURCE_PATH", source);
}

if (process.argv[1] && process.argv[1].endsWith("make-editor-sql.mjs")) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const file of EDITOR_FILES) {
    const path = file.source;
    const out = editorPathFor(path);
    const wanted = build(file);
    let have = null;
    try { have = readFileSync(join(ROOT, out), "utf8"); } catch { /* not there yet */ }
    if (have === wanted) { console.log(`up to date  ${out}`); continue; }
    if (check) { console.error(`STALE       ${out}`); stale += 1; continue; }
    writeFileSync(join(ROOT, out), wanted);
    console.log(`written     ${out}`);
  }
  if (stale) {
    console.error(`\n${stale} Editor copy or copies are stale. Run: node scripts/lms/make-editor-sql.mjs`);
    process.exit(1);
  }
}
