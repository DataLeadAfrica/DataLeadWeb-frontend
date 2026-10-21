# Phase 6E, in plain words

Big Sam decided the learning structure and then found the gaps in it by hand, building his first
course. This phase closes them. It is split into three so that a fault in one part cannot hold up
the rest:

| File | What it is | State |
|---|---|---|
| **22** | The seven gaps. All small, all real, all found by building a course. | This package |
| 23 | Module badges, and the path exam end to end. | Next |
| 24 | The lesson video player. | After that |

## The structure Big Sam settled on

- After every lesson: a **lesson check**. As now.
- At the end of every module: a **module badge**. No exam. (File 24.)
- At the end of every course: the **course exam** and the **course certificate**. As now.
- At the end of a path: a **path exam** and a **certificate of completion** for the path. (File 24.)

A badge is not a certificate. It has no number, nothing in the certificates table and nothing on
`/verify`. It is a mark of having finished a module, shown to the learner who earned it.

## What file 22 fixes

**1. A lesson built in the builder had no lesson check.** Already fixed by file 20 in phase 6D.
Nothing more to do here.

**2. Courses made before file 17 have no exam at all.** The Course exam page took its quiz id from
the course's exam, found nothing, sent an empty string, and writing a question answered "invalid
input syntax for type uuid". Big Sam's Phase 4 test course is one of these. File 22 gives every
course that is not archived a draft exam if it has none, with the same settings a new course gets:
70 per cent to pass, 2 tries then a day's wait, 20 questions served out of a bank of 30, 40
minutes, shuffled. Each one still needs its questions written before the course can be published.

The other half of this was already done in 6D: the Questions page now says so in words when there
is nothing to write into, and shows no Write or Paste buttons, so an empty string can never again
be sent to the database.

**3. Pasting a sheet without its header row was completely broken.** The rule for "is the first
line the column names?" was "any cell matches a column name". **A, B, C and D are column names**,
and the Right column of every question holds A, B, C or D. So the first question always matched,
was eaten as the header, and every row after it was read against that question's cells. Three rows
pasted came back as "2 rows read", both skipped, "No question text". Thirty rows pasted *with* the
header row always worked, which is why nobody noticed.

The rule now needs the first cell to be the word `Question`, or four or more cells to match a
column name. A question row can only ever match on its Right cell, which is one. A header row
written with different wording still matches on A, B, C, D and Right, which is five.

One accepted miss: a question whose entire text is the single word "Question" is read as a header.
That is a word and not a question.

**4. "Certificates this week" counted the wrong thing over the wrong window.** It counted
`completed_on`, which is the day the **training ended**, often weeks before anybody issued the
certificate. So the tile was not answering "how many certificates went out recently", and was not
answering anything else either.

It now counts `issued_at` from the first of the current month, **in Lagos time**. The server runs on
UTC, an hour behind Abuja, and without the time zone the month would turn over at one in the morning
in Nigeria. On the first of the month that hour is the difference between a tile reading zero and
one reading correctly. The label is now "Certificates this month".

The other three tiles on the Overview were checked at the same time. **All three are a rolling seven
days, not a calendar week**, and none of them was wrong; they were just sitting under a heading that
said "This week". Each one now says its own window:

| Tile | What it counts | Window |
|---|---|---|
| New learners, 7 days | accounts created with the learner role | rolling 7 days |
| Active in the last 7 days | distinct learners with a watch day | rolling 7 days |
| Minutes watched, 7 days | watch seconds, totalled and divided | rolling 7 days |
| Certificates this month | certificates by `issued_at` | calendar month, Lagos |

The heading over them is now "Recently" rather than "This week", because one of the four is a month.

**5. Nothing in the control room could archive a course.** `lms_archive_course` has existed since
file 17 and the wrapper in `studio.ts` was there all along. What was missing was any button, so Big
Sam archived a test course by writing SQL by hand.

Two things the function itself needed before a button was worth adding:

- **It took no reason.** It logged that a course was archived and never why.
- **It would archive a live course**, and a learner part way through would have had it vanish
  underneath them. It now refuses and says to unpublish first, which is a separate decision with
  its own blockers.

And there was **no way back**: nothing turned an archived course into a draft again, so an archive
was final in practice even though the row was still there. `lms_restore_course` is the other half.
It restores to **draft**, never straight to live, because coming back into view is one decision and
going live is another with the publish checklist in between.

Never a delete, in either direction. Somebody may hold a certificate for the course.

The button is in the course builder's publish panel, for administrators, on any course that is not
live. An archived course shows "Bring it back to draft" instead. The Courses page already had an
Archived filter, and an archived course does reach it.

**6. Paths could not finish.** Two separate reasons, and file 22 fixes one of them.

`lms_create_path` never created a programme, while `lms_create_course` always has. Without one,
`lms_claim_path_certificate` answers "This path has no programme attached, so no Professional
Certificate can be issued for it yet" and refuses, so **no path certificate could ever be issued**,
however much work a learner did. File 22 makes new paths create their programme, and gives every
existing path without one a programme. The programme is titled with the path's **certificate name**,
because that is the line somebody reads on the certificate: "Professional Certificate in Data
Analytics", not "Data Analytics".

**And a programme name must not be one the certification system already owns.** This was found in
review after the first version of file 22. `lms_create_course` has made the programme slug from the
title and checked it against `lms_courses` alone since file 17, and `lms_create_path` inherited the
same habit. Neither ever looked at `programmes`, and the certification system's programmes were
there first.

Proved by doing it: a certification programme with slug `digital-marketing-web-design` was put in
`programmes`, then a path of that name was created, and `programmes` ended up with two rows sharing
the slug. That is not cosmetic, because `src/lib/certificateConfig.ts` keys **partner logos and
certificate templates by programme slug**. On live it would be one of two things and neither is
acceptable: if there is a unique rule on `programmes.slug` the path cannot be created at all and
file 22 stops dead, and if there is not, an Academy path certificate quietly borrows a bootcamp's
logos. The code matters the same way, because `make_certificate_number` is handed the code and the
number is printed on the certificate.

It is a live risk for the path Big Sam most wants: the backfill gives the Data Analytics path a
programme with slug `data-analytics`, and the Courses page sells a Data Analytics bootcamp.

One helper now chooses both, used by all three places that make a programme: a slug free in
`programmes` as well as in the Academy's own table, and a code free in `programmes`, with `-2`,
`-3` and so on exactly as the slug already did. **Inserts only.** Nothing reads a certification row
to change it, rename it or reuse it; the Academy moves out of the way instead.

### What Big Sam will see on a path certificate

**Nothing different.** The programme slug is never shown to anybody. It is an internal key, used to
find the partner logos and the certificate template, and it appears on no page and on no
certificate. What a learner sees is the programme **title**, which is the certificate name, so
"Professional Certificate in Data Analytics" either way.

The one place a difference could show is the certificate **number**, which is built from the
programme code. A path whose code had to move aside gets, for example, `DATAANALYTI2-2026-GEN-A1B2C3`
rather than `DATAANALYTIC-2026-GEN-A1B2C3`. The number is still unique, still verifies on `/verify`,
and still reads as one code, one year, one module, one random tail, because the digit is appended
inside the twelve characters rather than added as a fifth part with a dash.

A path that already exists keeps its own address. The backfill moves only the **programme**, never
the path's slug, because that slug is a URL a learner may already hold.

The other reason paths cannot finish is that nothing in the control room opens the path exam to write questions into.
That is file 24, and it is a bigger piece of work. File 22 makes the programme right so file 24 has
something to build on, and so the backfill has already run by the time it matters.

**7. The lesson video.** File 25.

## What each check in 22_verify_EDITOR.sql means

Rows 1 and 3 are the two Big Sam ran into: a course with no exam, and a path that could never issue
a certificate.

| # | What it checks | What a NO means |
|---|---|---|
| 1 | Every course that can still be taken has an exam | A course with no exam has nothing for the Course exam page to open, so writing a question answered "invalid input syntax for type uuid" and the course could never be published. |
| 2 | And a new course still gets one, with the agreed numbers | The backfill copies the settings because it cannot call `lms_ensure_course_exam`, which guards itself with `lms_is_staff()` and so refuses in the SQL editor where nobody is signed in. A NO means the two have drifted and a backfilled exam no longer matches a fresh one. |
| 3 | Every path has a programme | Without one, no path certificate can ever be issued, however much work a learner does. |
| 4 | And a path made after this one gets its programme too | The backfill fixes the paths that exist. This stops the next one being made without a programme, which is how all of them got that way. |
| 5 | The programme is titled with the certificate name | The programme title is what somebody reads on the certificate. A NO means a path certificate would carry the path name instead. |
| 6 | The certificate tile counts when a certificate was issued | It counted `completed_on`, the day the training ended, often weeks earlier. |
| 7 | Over a calendar month that starts at midnight in Lagos | Without the time zone the month turns over at one in the morning in Nigeria, and on the first of the month that is the whole difference. |
| 8 | And the column says so | The returned column was called `this_week`. Changing a return type needs the function dropped and remade, so a NO means the drop did not happen and the pages read a month out of something still called a week. |
| 9 | The same tile on the Overview changed with it | There are two of these tiles and different functions build them. A NO means they now disagree with each other, which is worse than both being wrong the same way. |
| 10 | Neither one is reachable by a visitor | A dropped function takes its grants with it and a new one is executable by `PUBLIC`. Both of these read the whole certificate register. This is the file 21 lesson arriving one file later. |
| 11 | Archiving needs a reason and leaves a note of it | It logged that a course was archived and never why. The second half matters as much: the old one-argument version must be **gone**, or the pages would keep calling the one that asks for nothing. |
| 12 | And it refuses a course that is still live | A learner part way through should not have a course disappear underneath them. |
| 13 | An archived course can be brought back, to draft and not to live | Archiving used to be final in practice. It returns as a draft on purpose. |
| 14 | Neither archiving nor restoring is reachable by a visitor | Both are new functions, and a new function is executable by `PUBLIC` the moment it exists. |
| 15 | No two programmes share a slug, and no two share a code | The row the review asked for. A NO does **not** mean this file failed: a clash that was already there is left exactly as it is, because nothing here changes a row the certification system owns. It means there are two for somebody to look at, and the list printed under the table names them, both the value shared and which programmes share it. It counts rather than asserting, so a clashing database gets a NO it can act on instead of an error that hides every other row. |
| 16 | And the helper that keeps it that way is in place, and private | One rule rather than three copies of it. It is reached only by the three security definer functions that call it, so nothing signed in needs it, and a new function is executable by `PUBLIC` the moment it exists. |
| 17 | Making a course asks the helper too, not just making a path | `lms_create_course` has carried this since file 17 and is used far more often than path creation, so fixing only the path would have left the larger half open. |

## What file 23 fixes

Three faults, all about certificates. The first two are live, and they pull in opposite directions:
one hands a certificate to somebody who did nothing, the other withholds one from somebody who did
everything.

**A. A learner could mark their own lessons complete.** File 06 put a policy covering updates on the
progress record so a learner could keep their own place. A policy cannot restrict which columns an
update touches, so the same permission that let them record where they had got to also let them set
`completed` and `check_passed` by hand. Watching one second of a lesson is enough to create the row.
From there the whole of `lms_complete_lesson` could be stepped around: every lesson marked finished,
no lesson actually watched, no check actually passed. File 23 drops the policy and takes the insert,
update and delete privileges away, so the progress record is read only to the person it belongs to
and only the server-side functions write to it.

**B. The exam was never required.** `lms_claim_course_certificate` counted the quizzes a learner had
passed by reaching them through `lms_modules`, which is where module quizzes used to live. File 16
abolished module quizzes and moved the exam onto the course. So for every course built since, the
count was zero, the test read "zero passed is not fewer than zero required", and the claim allowed
itself through. Taken with fault A, a learner could be issued a real certificate number having never
opened the exam. Taken on its own it was still wrong in the other direction: the function was not
checking the exam at all, so once fault A was closed an honest learner who had passed the exam was
being let through by luck rather than by the check working. File 23 counts the course's own published
quizzes and the attempts against them.

**C. The certificate title never followed the course title.** The certificate prints the programme
title. `lms_create_course` copies the course title to the programme row once, when the course is
made, and nothing updated it afterwards. A course created as `power-bi` and then properly titled
"Power BI for Analysts" would print "power-bi" on every certificate for ever. Now the programme title
follows the course title, and a path's programme title follows the path's certificate name, but only
while no certificate has been issued for that programme. Once one exists the title stays where it is,
because rewording a certificate somebody is already holding is a decision for a person, not for a
save button. The builder says so beside the title field, naming the title the issued certificates
carry.

Three things file 23 deliberately does not do. The programme **slug** never changes, because it is
part of a certificate's address. Only a programme row an Academy course or path points at is ever
touched, never one the certification system owns. And nothing already issued is altered, revoked or
renumbered.

## What each check in 23_verify_EDITOR.sql means

Rows 1 and 2 are the live hole. Row 7 is the one that will still be working in a year: the others
check a list of known mistakes, that one asks whether anything has drifted by any route.

| # | What it checks | What a NO means |
|---|---|---|
| 1 | A learner cannot mark their own lessons complete | **The live hole.** A learner can set `completed` and `check_passed` on their own progress record by hand and award themselves a finished course. Both halves matter: dropping the policy while leaving the privileges in place fixes nothing, because the policy was all that stood in front of them. |
| 2 | And a certificate is not issued until the exam is passed | **The other half**, and it bit an honest learner too. The claim counted module quizzes, which file 16 abolished, so the count was zero for every modern course and the exam was never required. A NO means somebody who watched every lesson and never opened the exam is handed a certificate. |
| 3 | The watch record and the attempt log are read only as well | These two were already right and file 23 changes nothing about them today. They are asked about because a fault like row 1 is rarely alone, and because a later hand re-granting the lot would reopen all three at once. The attempt log is the record of what somebody actually scored. |
| 4 | A certificate title can follow the course, but only before one is issued | The title stopped following at creation, so a course renamed after it was made printed its old working name on every certificate. A NO means either it still does not follow, or it follows past the point where a certificate exists, which would reword a certificate somebody holds. |
| 5 | And it refuses a programme no Academy course or path points at | The certification system owned `programmes` before the Academy existed. A NO means a bootcamp title could be rewritten by somebody renaming a course. |
| 6 | Both save functions ask it, and nothing signed in can | A course has a title and a path has a certificate name, and both are printed on a certificate, so fixing one and not the other would leave half the fault. A NO also fires if the helper is reachable by `anon` or `authenticated`: a new function is executable by `PUBLIC` the moment it exists. |
| 7 | Every course and path without a certificate still matches its own | **The row that keeps working.** A NO is not an emergency and nothing is broken by it: it means something has drifted by a route this file does not cover, and the list printed under the table names each one, what it is called and what its certificate says. Archived courses are left out, and so is anything with a certificate against it, because those are supposed to stay as they are. |

## What is not in this package

Module badges and the path exam are file 24. The video player is file 25. The control room
ease-of-use pass and the role-aware guide at `/lms/studio/guide` are file 26. The browser acceptance
test that drives the real pages against the real functions is being built alongside file 24, because
most of what it has to walk through is what file 24 adds.

File 23 went ahead of the badges because two of its three faults are live now: one lets a learner
issue themselves a real certificate, and the other stops an honest learner getting one.
