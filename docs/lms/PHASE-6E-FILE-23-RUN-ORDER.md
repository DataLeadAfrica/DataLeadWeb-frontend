# Phase 6E, file 23: what to run in Supabase, and in what order

**Run 6D and file 22 first.** File 23 begins by checking that files 01 to 22 are in place, and that
`lms_set_course_details`, `lms_set_path_details` and the `programmes` table are there, and stops with
a sentence naming anything missing. It cannot be run early by accident.

| Order | What | Where |
|---|---|---|
| a | `database/lms/23_certificate_integrity_EDITOR.sql`, then `23_verify_EDITOR.sql` | Supabase SQL editor |
| b | Merge the branch | GitHub |

`23_verify_EDITOR.sql` prints 7 rows. All should say yes. `PHASE-6E-PLAIN.md` says what each number
means. It is safe to run the verify file before the fix as well as after: it prints a column of NOs
rather than an error, which is the answer.

**The SQL goes first and the merge second, and here that order matters.** The builder's new message
reads two fields that `lms_studio_course` only returns once the SQL has run. Merging first is not
dangerous, but until the SQL runs the title field would show the ordinary wording to an
administrator looking at a course whose certificates have already been issued, which is the one case
the message exists for.

**There is no setting to change.** Unlike file 19 this one does not depend on a Supabase setting. It
is safe to run twice: every step is guarded by "is it already done", and running it three times in a
row was part of the testing.

## What it changes on a live database

**A learner's progress record becomes read only to the learner.** The policy covering updates on
`lms_lesson_progress` is dropped and the insert, update and delete privileges are taken away from
`anon` and `authenticated`. Nothing a learner does in the browser changes, because everything that
writes to that record already goes through a server side function that runs as its owner:
`lms_record_watch` creates the row, `lms_complete_lesson` finishes it. What stops is a learner
writing to it directly.

**A course certificate now requires the course exam.** The claim counts the course's own published
quizzes and the passed attempts against them. Before this it counted module quizzes, which file 16
abolished, so for every course built since file 16 the exam was not being required at all.

**A certificate title follows its course title, until the first certificate is issued.** Saving a
course's details updates its programme title to match. Saving a path's details updates its programme
title to the path's certificate name. Both stop the moment a certificate exists for that programme.

**The course builder says which title the issued certificates carry**, beside the title field, on a
course whose programme already has certificates against it.

## What it does NOT change

The programme **slug** never changes: it is part of a certificate's address and
`src/lib/certificateConfig.ts` keys logos and templates by it. Only a programme row an Academy course
or path points at is ever touched, never one the certification system owns. Nothing already issued is
altered, revoked or renumbered. No table is created or dropped. Nothing about sign up, sign in,
email, access or who can see what.

**Nobody loses a certificate they have already been issued.** If one was issued through the hole,
it stays issued. Closing the hole stops the next one; it does not go back through the register.

## The undo

`23_undo_EDITOR.sql` refuses unless you say you mean it, like the undos for 19 to 22, because two of
the three things it would put back were faults rather than choices. Undoing this reopens the hole
that lets a learner issue themselves a certificate.

**It keeps three things.** Any programme title that has already followed stays as it is, because by
then it is the title on a certificate or about to be. Every certificate stays. And the read only
state of the watch record and the attempt log stays, because those were right before file 23 and
file 23 changed nothing about them.

So `23_verify.sql` after an undo says NO on rows 1, 2, 4, 5 and 6, and yes on rows 3 and 7. That is
correct and is what the undo's own notice says to expect. The round trip was tested both ways: with
the undo forced, the attack issues a real certificate number again, and re-applying file 23 shuts
it.

## The test files, which do not go near Supabase

`database/lms/tests/file_23_tests.sql` runs 30 checks in seven sections: the attack itself, an
honest learner who skips the exam, the regression that an honest learner who sits it still gets the
certificate, the three progress tables being read only, the title following and stopping, the helper
and its privileges, and that nothing already issued was touched. On a database without file 23, 18
of the 30 fail.

The third section is the one that earned its place. Requiring the exam without it would have made
every course certificate unobtainable rather than merely harder, and the check that proves the
honest path still works is what caught that.

All of it runs with pg-safeupdate loaded, the way Supabase loads it for calls arriving through the
API.

## What is still to come

**File 24: module badges and the path exam.** A badge for finishing a module, awarded server side in
the same transaction as the last requirement. The path exam written from the control room, the
learner's path page, the path certificate. The browser acceptance test that drives the real pages
against the real functions is being built with it.

**File 25: the lesson video player.** Our own control bar, one set of controls, captions that work
with YouTube's own bar switched off. Part of it cannot be finished without a real YouTube video on
the Vercel preview, so it will arrive with a numbered checklist to run there.

**File 26: the control room made easy.** An ease-of-use pass over the whole control room, then a
role-aware guide at `/lms/studio/guide` that shows a facilitator and an administrator each what they
can actually do.
