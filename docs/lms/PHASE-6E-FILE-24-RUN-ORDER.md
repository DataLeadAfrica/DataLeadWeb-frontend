# Phase 6E, file 24: what to run in Supabase, and in what order

**Run file 23 first.** File 24 begins by checking that files 01 to 23 are in place and stops with a
sentence naming anything missing, so it cannot be run early by accident.

| Order | What | Where |
|---|---|---|
| a | `database/lms/24_module_badges_EDITOR.sql`, then `24_verify_EDITOR.sql` | Supabase SQL editor |
| b | Merge the branch | GitHub |

`24_verify_EDITOR.sql` prints 8 rows. All should say yes. `PHASE-6E-PLAIN.md` says what each number
means. It is safe to run the verify before the fix as well as after: it prints a column of NOs
rather than an error.

**Nothing here is urgent.** Unlike file 23, none of this is a hole. It is a new thing for learners,
two links that were missing, and two numbers that were counting the wrong people.

**It is safe to run twice.** Every step is guarded by "is it already done", and running it three
times in a row was part of the testing.

## What it changes on a live database

**Module badges start being awarded.** A learner who completes every lesson in a module is given a
badge, in the same transaction as the last lesson. It shows on the module card in their course page.
A badge is not a certificate: no number, nothing in the certificate register, nothing on `/verify`.

**Badges are backfilled for work already done**, dated to the last lesson the person actually
finished rather than to the day you run this, so a module finished in September does not say October.

**Administrators get a way into the path exam.** A "Write the path exam" button on the Paths screen.
Until now the sentence on that screen about a path going live once its exam holds 60 questions named
a condition nobody could meet, because there was no address to write them at.

**A learner can sit a path exam.** The "Start the exam" button on a path page linked to the path page
itself. It now goes to the exam.

**Two numbers change, and they will usually go DOWN.** The Overview and the Courses table count
learners rather than everybody holding a course, so a course whose only access holders are you and
Big Sam now reads 0 rather than 2. That is the true number. The Learners tab gains a course dropdown
so the figure and the list can be checked against each other.

## What it does NOT change

No certificate is issued, altered or revoked by any of this, and the certification system is not
touched. Nothing about sign up, sign in, email or access. No learner data is removed. The only rows
written are badges, and the undo does not take them away.

## The undo

`24_undo_EDITOR.sql` refuses unless you say you mean it, like the undos for 19 to 23. The refusal
message carries the line that lets it through.

**Every badge is kept.** The record is not dropped and not emptied. A badge is a learner's own work
written down, and undoing a decision about how the control room counts people is no reason to throw
somebody's finished module away.

**The read only state is kept too.** Nothing in the undo hands a learner the ability to write a
badge, because that was never file 24's doing to undo: it is the rule file 23 established and the
rule the progress record lives by.

What undoing costs: paths cannot be published again, because the control room loses its way into a
path exam. New badges stop being awarded, and the ones already held become invisible rather than
lost. So `24_verify.sql` after an undo says NO on rows 2 to 7 and yes on rows 1 and 8, which is what
the undo's own notice says to expect.

## The test files, which do not go near Supabase

`database/lms/tests/file_24_tests.sql` runs 24 checks in seven sections: the award and its timing, a
learner trying to write or back date one, a badge surviving a lesson added to a finished module, a
badge not being a certificate, the two counts, the path exam lookup with a learner refused, and the
backfill answering for work already done. On a database without file 24, 12 of the 24 fail.

The third section is the one worth keeping. The obvious way to build this, comparing lessons done
against lessons, passes every other check in the file and fails that one, by taking a badge back off
somebody who did nothing wrong.

All of it runs with pg-safeupdate loaded, the way Supabase loads it for calls arriving through the
API.

## What is still to come

**File 25: the lesson video player.** Our own control bar, one set of controls, captions that work
with YouTube's own bar switched off. Part of it cannot be finished without a real YouTube video on
the Vercel preview, so it will arrive with a numbered checklist to run there.

**File 26: the control room made easy.** An ease-of-use pass over the whole control room, then a
role-aware guide at `/lms/studio/guide` that shows a facilitator and an administrator each what they
can actually do. The browser acceptance test belongs with it.
