# Phase 6E, file 22: what to run in Supabase, and in what order

**Run 6D first.** File 22 begins by checking that files 01 to 21 are in place and stops with a
sentence naming anything missing, so it cannot be run early by accident. If 6D has not been run,
run it in its own order first: `PHASE-6D-RUN-ORDER.md`.

| Order | What | Where |
|---|---|---|
| a | `database/lms/22_gaps_EDITOR.sql`, then `22_verify_EDITOR.sql` | Supabase SQL editor |
| b | Merge the branch | GitHub |

`22_verify_EDITOR.sql` prints 14 rows. All should say yes. `PHASE-6E-PLAIN.md` says what each
number means.

**There is no setting to change and nothing to do in a particular order within the file.** Unlike
file 19, this one does not depend on a Supabase setting, and unlike file 21 it does not take
anything away from anybody. It is safe to run twice: every step is guarded by "is it already done",
and running it three times in a row was part of the testing.

## What it changes on a live database

**It gives every course that is not archived a draft exam, if it has none.** That is the one that
unblocks Big Sam. Each backfilled exam still needs its questions written before the course can be
published, so expect the publish checklist to say so.

**It gives every path a programme.** Nothing visible changes today, because the path exam still
cannot be written from the control room. That is file 23. This is what makes file 23 possible.

**It changes two tiles.** "Certificates this week" becomes "Certificates this month", counted by
when the certificate was issued rather than when the training ended, from the first of the month in
Lagos time. The number will usually go UP, because the old one was counting the wrong column.

**It adds an Archive button** to the course builder's publish panel, for administrators, on any
course that is not live.

## What it does NOT change

Nothing about sign up, sign in, email, access, or who can see what. No table is created or dropped.
No learner data is touched. The only rows written are draft exam rows for courses that had none and
programme rows for paths that had none, and neither is removed by the undo.

## The undo

`22_undo_EDITOR.sql` refuses unless you say you mean it, like the undos for 19, 20 and 21, because
two of the three things it puts back were faults rather than choices. It restores the three function
definitions and nothing else.

**It keeps the rows.** The draft exams stay, because by the time anybody undoes this somebody may
have written questions into one, and throwing a facilitator's work away to undo a count is not a
trade worth making. The path programmes stay, because a programme is a certificate system row and a
certificate may already point at one. Nothing a learner has touched gets hard deleted.

So `22_verify.sql` after an undo says NO on rows 4 to 9 and 11 to 14, and yes on rows 1, 2, 3 and
10. That is correct and is what the undo's own notice says to expect.

## The test files, which do not go near Supabase

`database/lms/tests/file_22_tests.sql` runs 32 checks: the exam backfill including an archived
course being left alone, the path programme including a certificate name that was already set and
one that was blank, the certificate tile to the second across the Lagos month boundary, archiving
and restoring with every refusal, and the grants after the drop. On a database without file 22, 13
of the 32 fail.

`tests/paste-sheet.test.mjs` runs 7 checks on the pasted sheet rule, in plain Node with no browser.
Three of them fail against the old rule.

All of it runs with pg-safeupdate loaded, the way Supabase loads it for calls arriving through the
API.

## What is still to come

**File 23: module badges and the path exam.** A badge for finishing a module, awarded server side in
the same transaction as the last requirement. The path exam written from the control room, the
learner's path page, the path certificate. The browser acceptance test that drives the real pages
against the real functions is being built with it, because most of what it has to walk through is
what file 23 adds.

**File 24: the lesson video player.** Our own control bar, one set of controls, captions that work
with YouTube's own bar switched off. Part of it cannot be finished without a real YouTube video on
the Vercel preview, so it will arrive with a numbered checklist to run there.
