// The *_EDITOR.sql copies: the files Big Sam actually pastes.
//
//   npm test
//
// WHY THESE COPIES EXIST. 16_verify.sql failed in the Supabase SQL Editor
// with `relation "the" does not exist` while running cleanly in psql, and
// what finally ran was a version with no prose in it. The cause is still a
// guess, written out in scripts/lms/make-editor-sql.mjs.
//
// File 17 went live the same way: Big Sam ran a copy with the comments
// between the function bodies taken out, then compared every stored
// function source against a psql build and found them identical apart from
// one trailing space. So the rule now is that anything the run order tells
// him to paste ships as a generated copy, and these tests are what make
// that copy trustworthy.
//
// THE POINT OF EVERY TEST BELOW is that the file he pastes and the file I
// edit cannot come apart. A copy that drifts is worse than no copy, because
// it is the one that gets run.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EDITOR_FILES,
  bodies,
  build,
  editorPathFor,
  split,
  stripComments,
} from "../scripts/lms/make-editor-sql.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("every Editor copy is exactly what the generator makes today", () => {
  // The strongest of these, and the one that makes the others mostly
  // belt. If the committed copy is byte for byte what the generator
  // produces from the current source, it cannot be stale, hand edited or
  // half regenerated.
  for (const file of EDITOR_FILES) {
    const path = editorPathFor(file.source);
    assert.equal(read(path), build(file),
      `${path} is not what the generator makes from ${file.source} any more. `
        + "Run: node scripts/lms/make-editor-sql.mjs");
  }
});

test("every function body is byte for byte identical, with nothing forgiven", () => {
  // Dr Ayoola allowed this comparison to ignore trailing whitespace at
  // the end of a line, because Big Sam's hand made copy differed from a
  // psql build by one trailing space.
  //
  // It does not ignore it, because the generator no longer creates that
  // difference. The first version tidied trailing whitespace over the
  // whole finished file, bodies included, and took a space off the inside
  // of lms_reorder_lessons: "declare p text[]; " became "declare p
  // text[];". One body in 71, changed by a rule with no business touching
  // a body. Tidying each piece between the bodies instead means the
  // tolerance is not needed, so it is not given.
  for (const file of EDITOR_FILES.filter((f) => f.shape === "bodies")) {
    const a = bodies(read(file.source));
    const b = bodies(read(editorPathFor(file.source)));
    assert.equal(b.length, a.length,
      `${file.source} has ${a.length} function bodies and its Editor copy has ${b.length}`);
    for (let i = 0; i < a.length; i += 1) {
      assert.equal(b[i], a[i],
        `body ${i} of ${file.source} is not identical in the Editor copy. A body is part of the `
          + "function's stored source, so changing one changes what the database holds.");
    }
  }
});

test("the comments inside the bodies survive, because a verify row reads them", () => {
  // 17_verify.sql row 16 reads PASS ONE and PASS TWO back out of
  // lms_nightly_prune's stored source. Strip the comments inside the
  // bodies and that row turns NO while the function is perfectly fine,
  // which is the worst kind of failure: it looks like a real fault and
  // sends somebody looking for a bug that is not there.
  const editor = read(editorPathFor("database/lms/17_control_room.sql"));
  assert.match(editor, /PASS ONE/, "PASS ONE was stripped out of the Editor copy");
  assert.match(editor, /PASS TWO/, "PASS TWO was stripped out of the Editor copy");

  // And the row that depends on them is still asking for them.
  assert.match(read("database/lms/17_verify.sql"), /%PASS ONE%PASS TWO%/,
    "verify row 16 no longer looks for PASS ONE and PASS TWO");
});

test("no comment survives outside the bodies except the generated header", () => {
  for (const file of EDITOR_FILES.filter((f) => f.shape === "bodies")) {
    const path = editorPathFor(file.source);
    // The generated header is the one comment block allowed, and it is
    // identified by being the FIRST thing in the file rather than by
    // matching its wording. Matching the wording is what the first
    // version of this did, line by line, and it missed a header line
    // whose giveaway phrase was on the line after it.
    const text = read(path);
    assert.match(text, /^-- GENERATED\. Do not edit\./, `${path} has no generated header`);
    const afterHeader = text.replace(/^(?:--.*\n)+/, "");
    const outside = split(afterHeader).filter((p) => !p.body).map((p) => p.text).join("");
    assert.deepEqual(outside.match(/^\s*--.*$/gm) || [], [],
      `${path} still has prose outside the function bodies, which is the thing it exists to remove`);
  }
});

test("a body that starts on the same line as code is not glued to it", () => {
  // "do $$" became "do$$", a syntax error, because the piece of text
  // before a body can end in the middle of a line and its last line's
  // trailing space is not trailing at all.
  //
  // It passed every check I had at the time: the bodies matched, the
  // comments were gone, the file looked right. It failed the moment the
  // generated copy was actually run, which is why the database matrix now
  // runs the copies rather than the originals.
  for (const file of EDITOR_FILES) {
    const text = read(editorPathFor(file.source));
    const glued = [...text.matchAll(/^.*\w\$\$.*$/gm)]
      .map((m) => m[0].trim())
      .filter((l) => !/\$\w+\$/.test(l));
    assert.deepEqual(glued, [],
      `${editorPathFor(file.source)} has a dollar quote glued to the word before it`);
  }
});

test("the verify copy holds the same checks as the full one", () => {
  // The numbers AND the checks. An earlier version of this test compared
  // only the check numbers, which would catch a check being added or
  // removed and would not catch one being changed, so the file Big Sam
  // runs could have quietly tested something weaker. Comparing the whole
  // generated file against the source covers both; this keeps the
  // narrower assertion as well because its failure message says which
  // check went missing.
  const numbers = (src) =>
    [...src.matchAll(/^\s*(?:union all )?select (\d+)(?: as n)?,/gm)].map((m) => Number(m[1]));

  const full = numbers(read("database/lms/17_verify.sql"));
  const editor = numbers(read("database/lms/17_verify_EDITOR.sql"));
  assert.ok(full.length >= 41, `17_verify.sql has only ${full.length} checks`);
  assert.deepEqual(editor, full,
    `the two verify files hold different checks. Full: ${full.length}, editor: ${editor.length}`);
});

test("the verify copy carries no prose at all", () => {
  const editor = read("database/lms/17_verify_EDITOR.sql");
  assert.ok(!/--/.test(editor), "17_verify_EDITOR.sql has a comment in it");
  assert.ok(!/\/\*/.test(editor), "17_verify_EDITOR.sql has a block comment in it");

  const labels = [...editor.matchAll(/^\s+'(check \d+)',$/gm)].length;
  const notes = [...editor.matchAll(/^\s+'',?$/gm)].length;
  const checks = [...editor.matchAll(/^\s*(?:union all )?select \d+,$/gm)].length;
  assert.equal(labels, checks, 'not every check is labelled "check N"');
  assert.equal(notes, checks, "not every check has an empty note");
});

test("every explanation the Editor copy drops is written down somewhere", () => {
  // The note column is emptied, so the only place left that says what a
  // NO means is the plain English doc. If a check is added to the verify
  // file and not to that doc, somebody gets a NO on a numbered row with
  // nothing to look it up in.
  // EVERY verify file, not just file 17's. Written against the list the
  // generator keeps, so a verify file added later is covered without
  // anybody remembering to come back here.
  const plain = read("docs/lms/PHASE-6B-PLAIN.md");
  for (const file of EDITOR_FILES.filter((f) => f.shape === "checks")) {
    const name = file.source.split("/").pop().replace(".sql", "");
    const checks = [...read(file.source)
      .matchAll(/^\s*(?:union all )?select (\d+)(?: as n)?,/gm)].map((m) => Number(m[1]));
    assert.ok(checks.length > 0, `${file.source} has no checks`);

    // Each verify file has its own table in the doc, so the rows are
    // looked for inside that file's section rather than anywhere in the
    // document: two tables both starting at row 1 would otherwise cover
    // for each other.
    const heading = `## What each check in ${name}_EDITOR.sql means`;
    const at = plain.indexOf(heading);
    assert.ok(at > 0, `PHASE-6B-PLAIN.md has no section headed "${heading}"`);
    const next = plain.indexOf("\n## ", at + 1);
    const section = plain.slice(at, next === -1 ? undefined : next);

    const missing = checks.filter((n) => !new RegExp(`^\\| ${n} \\|`, "m").test(section));
    assert.deepEqual(missing, [],
      `${heading} has no row for these check numbers, so a NO on one of them cannot be looked up `
        + `anywhere: ${missing.join(", ")}`);
  }
});

test("the comment stripper leaves a double dash inside a string alone", () => {
  // Cutting at a "--" inside a quoted string would change what the
  // statement does rather than only what it says. Postgres also allows
  // nested block comments, which a non-greedy match gets wrong.
  assert.equal(stripComments("select 'a -- b';\n"), "select 'a -- b';\n");
  // Note "select 1;" and not "select 1; ": the space the comment left
  // behind is tidied, which is wanted. My first expectation here had the
  // space in it and the generator was right.
  assert.equal(stripComments("select 1; -- gone\n"), "select 1;\n");
  assert.equal(stripComments("/* a /* b */ c */select 1;\n"), "select 1;\n");
  assert.equal(stripComments("select 'it''s -- fine';\n"), "select 'it''s -- fine';\n");
  // A $1 parameter is not a dollar quote.
  assert.equal(stripComments("select $1; -- gone\n"), "select $1;\n");
});
