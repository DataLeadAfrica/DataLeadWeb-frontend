# Phase 6G, file 27: what to run in Supabase, and in what order

**Run files 01 to 26 first.** File 27 checks they are in place and stops with a sentence naming
anything missing.

| Order | What | Where |
|---|---|---|
| a | `database/lms/27_publishing_EDITOR.sql`, then `27_verify_EDITOR.sql` | Supabase SQL editor |
| b | Merge the branch | GitHub |

`27_verify_EDITOR.sql` prints 6 rows. Rows 1 to 5 should say yes. **Row 6 may well say NO on your
database, and that is the point of it**: it lists every live course whose exam is still a draft, which
is every course built so far. Those are not broken, they are waiting for somebody to press publish.

**Run the SQL before merging.** The new buttons read the exam's state, and the tenth checklist row
comes from the server, so the screens make more sense once the SQL is in.

**It is safe to run twice.**

## What to do after it

For each live course the verify lists, open the control room, go to the course, open the exam tab,
and press **Publish the exam**. The panel tells you if questions are still needed. Until you do this,
no learner on that course can be certified.

Then, for any path you want live: open Paths, check the list of what is still in the way, and press
**Publish the path**.

## What it changes on a live database

**Publishing an exam, publishing a path and creating a path's exam become administrator decisions**
in the functions themselves. This changes nothing about who could already do what: a facilitator was
refused before by a trigger underneath. It means the function states the rule rather than leaning on
the trigger to state it, so the refusal names the real reason.

**The publish checklist gains a tenth row**, which asks whether the exam is published. Courses that
showed nine green ticks will now show nine and one red, and the red one is true.

## What it does NOT change

No certificate is issued, altered or revoked. Nothing already published is unpublished. No learner
data is touched.

## The undo

`27_undo_EDITOR.sql` refuses unless you say you mean it. What it puts back that matters is the
nine-row checklist, which reports success over a course nobody can finish. The guards going back to
`lms_is_staff()` changes nothing in practice, because the triggers still refuse a non administrator.

## The test files, which do not go near Supabase

`database/lms/tests/file_27_tests.sql` runs 18 checks. Section 3 is the whole point: it walks a
learner to a hundred per cent, shows the exam is invisible while it is a draft, has an administrator
publish it, and then has the learner sit and pass it.

Section 0 checks that the three actors really hold the roles the test thinks they do. Without it,
section 1 would pass on a database where the facilitator was never given the role, because a learner
is refused by every guard and the check would go green while proving nothing.
