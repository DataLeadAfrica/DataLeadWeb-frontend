// Every undo file that refuses must actually be able to refuse.
//
// THE FAULT THIS WAS WRITTEN FOR, found in Phase 6H while testing file
// 28's undo and then found in three more:
//
// An undo opens with a block that raises unless a flag is set, and
// prints a sentence explaining how to set it. That reads like a lock.
// It is not one. A raise stops a script only in a client that stops on
// an error. The Supabase SQL editor does, which is the one place these
// are meant to be pasted, so the lock holds there. psql, run plainly,
// does not: it prints the refusal, moves on to the next statement, and
// drops everything the file was guarding. The refusal is shown and
// ignored.
//
// It was found by running 28_undo.sql without the flag and then
// counting the functions, rather than by reading the error message and
// believing it. All twenty-three were gone.
//
// THE FIX IS TWO LINES: begin; above the guard, commit; at the end.
// Inside a transaction the raise aborts everything, Postgres refuses
// each statement after it, and the commit becomes a rollback. Nothing
// happens, in any client.
//
// This test is here so the next undo file cannot quietly go back to the
// version that only looks locked.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = new URL("../database/lms/", import.meta.url).pathname;

/** Every undo file, the plain ones and the copies that get pasted. */
function undoFiles() {
  return readdirSync(DIR)
    .filter((f) => /_undo(_EDITOR)?\.sql$/.test(f))
    .sort();
}

const read = (f) => readFileSync(join(DIR, f), "utf8");

/** Statements only, with the comments taken out, so prose cannot pass. */
function statements(sql) {
  return sql
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");
}

test("every undo file that refuses is wrapped in one transaction", () => {
  const wrong = [];

  for (const f of undoFiles()) {
    const body = statements(read(f));
    // Only the ones that actually have a refusal to enforce.
    if (!/current_setting\('lms\.undo_/.test(body)) continue;

    const begins = body.match(/^\s*begin;\s*$/gim) || [];
    const commits = body.match(/^\s*commit;\s*$/gim) || [];

    if (begins.length !== 1 || commits.length !== 1) {
      wrong.push(
        `${f}: found ${begins.length} "begin;" and ${commits.length} "commit;", wanted one of each`,
      );
      continue;
    }

    // AND THE GUARD HAS TO BE INSIDE IT. A transaction opened after the
    // refusal makes the undo atomic and leaves the refusal exactly as
    // ignorable as it was. File 23 was in that state until Phase 6H.
    const at = body.search(/^\s*begin;\s*$/im);
    const guard = body.search(/current_setting\('lms\.undo_/);
    if (at > guard) {
      wrong.push(
        `${f}: the transaction opens AFTER the refusal, so the refusal still cannot stop anything`,
      );
    }
  }

  assert.deepEqual(
    wrong,
    [],
    "An undo that only prints a refusal is not guarded. Put begin; above the " +
      "guard block and commit; at the end:\n  " +
      wrong.join("\n  "),
  );
});

test("a guarded undo has nothing outside its transaction", () => {
  // commit; must be the LAST statement, not merely present somewhere.
  // A guarded file with a statement after its commit has a statement
  // the guard cannot stop, which is the same hole in a smaller place.
  //
  // Only the guarded files. An undo with no refusal to enforce has
  // nothing to be outside of, and several of the early ones end with a
  // note rather than a statement.
  const wrong = [];
  for (const f of undoFiles()) {
    const body = statements(read(f));
    if (!/current_setting\('lms\.undo_/.test(body)) continue;
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines[lines.length - 1] !== "commit;") {
      wrong.push(`${f} ends with "${lines[lines.length - 1]}"`);
    }
  }
  assert.deepEqual(wrong, [], `a guarded undo must end at its commit: ${wrong.join(", ")}`);
});
