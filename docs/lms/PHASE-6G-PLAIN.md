# Phase 6G, in plain words

| File | What it is | State |
|---|---|---|
| **27** | Nobody could be certified, and the screen said everything was fine. | This package |

## What was wrong

**A course exam is created as a draft, and nothing published it.** Publishing the *course* does not
publish its exam, and there was no second step that did, because `lms_publish_exam` has sat on the
server since file 16 and was **called by nothing in the entire site**.

So a facilitator would build a course, write the thirty exam questions, publish the course, and the
exam would stay a draft for ever. The learner then watches every lesson, reaches a hundred per cent,
and the course page reports **no exam**, because it only looks for a published one. No exam, no pass,
no certificate. Ever. Every course in the Academy was in that state.

**And the publish screen said it was finished.** The checklist asked whether the exam had enough
questions and ticked when it did. It never asked whether the exam was *published*. So the one screen
whose entire job is to tell a facilitator what is left showed nine green ticks over a course no
learner could complete. That is the worst kind of fault: not one that fails, but one that reports
success.

**The same was true of paths, twice over.** `lms_publish_path` was also called by nothing, so no path
could ever go live and no path certificate could ever be issued, and a path's exam had the same draft
problem underneath it.

## How it was found, and how it was proved

By walking the whole system end to end on a clean database rather than by reading it. A learner was
taken from nothing: watch every lesson, pass every lesson check, complete the course, earn the module
badge, reach a hundred per cent, and find no exam.

Then `lms_publish_exam` was called by hand. The exam opened, the learner sat it, passed it, and was
issued certificate `AUDITCOURSE-2026-GEN-6C39B8`. **The chain was never broken. It simply had no way
to be started.**

## What this package does

**The buttons that did not exist.** Publishing an exam is now a panel on the exam tab that says in
plain words that the exam is still a draft and no learner can sit it, with the button beside it. A
facilitator sees the same warning with "ask an administrator", because publishing is an
administrator's decision. Publishing a path is a button on the Paths screen, with the list of what is
still standing in the way shown above it, so you can see what is left before pressing anything.

**A tenth row on the checklist**, which asks whether the exam is published and says what it costs if
it is not.

**Three functions now state their own rule.** `lms_publish_exam`, `lms_publish_path` and
`lms_ensure_path_exam` asked `lms_is_staff()` where every function beside them asks for an
administrator.

**This last part is not a security fix, and the first draft of this file wrongly said it was.** A
facilitator calling those functions was refused anyway, by a trigger underneath: `lms_guard_quiz`
answers "Only the administrator can publish a set of questions" and `lms_guard_path` answers "Only
the administrator can publish a learning path". Both were checked by trying it on a database without
this file. The rule was already enforced one layer down. These three were simply the only functions
leaning on a trigger to say no rather than saying it themselves, which matters because the refusal a
person sees should name the real reason, and the next person reading the function should not have to
know the trigger exists.

## What each check in 27_verify_EDITOR.sql means

Row 4 is the row that would have caught all of this. Row 6 is the one that will still be working in a
year.

| # | What it checks | What a NO means |
|---|---|---|
| 1 | Publishing an exam is an administrator's decision | **Not a security row.** A facilitator was refused anyway by the `lms_guard_quiz` trigger. This asks that the function states the rule itself rather than leaning on a trigger, so the refusal names the real reason. |
| 2 | And so is publishing a path | The same, with `lms_guard_path` underneath it. Building a path is an administrator's job everywhere else already. |
| 3 | And so is making the exam a path will be judged by | The third straggler, found by looking at the two beside it. It is the exam a path certificate rests on. |
| 4 | The publish screen asks whether the exam is published | **The row that would have caught all of this.** The old checklist ticked nine green over a course whose learners would reach a hundred per cent and find no exam. A NO means the screen can report success over a course nobody can finish. |
| 5 | A signed in administrator can reach both, and a visitor cannot | The guard inside a function decides what it does; the grant decides whether the browser may call it at all. A button onto a function the signed in role cannot execute answers "permission denied", which is the file 21 lesson. A visitor who can call it is the opposite mistake. |
| 6 | No live course has an exam still in draft | **The row that keeps working.** A live course with a draft exam is a course nobody can finish. A NO is not an emergency: the courses named under the table are waiting for somebody to press publish on their exam, and until that happens no learner on them can be certified. |

## What this does not change

No certificate is issued, altered or revoked. Nothing already published is unpublished. No learner
data is touched. The package moves two guards, adds a checklist row, and adds two buttons.
