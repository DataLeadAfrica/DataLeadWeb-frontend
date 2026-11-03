# Phase 6H, file 28: what to run in Supabase, and in what order

**Run files 01 to 27 first.** File 28 checks they are in place and stops with a sentence naming
anything missing.

| Order | What | Where |
|---|---|---|
| a | `database/lms/28_attendance_EDITOR.sql`, then `28_verify_EDITOR.sql` | Supabase SQL editor |
| b | Merge the branch | GitHub |

**It is safe to run twice.**

`28_verify_EDITOR.sql` prints 14 rows. Rows 1 to 12 and 14 should say yes.

**Row 13 will say NO on your database, and that is the point of it.** It counts active participants
who have no ID card. On the day this goes in that is every one of them, because no card has been
issued yet. The list underneath the rows breaks it down by cohort, so it is a worklist rather than a
fault. Nobody without a card can be scanned in.

**Run the SQL before merging.** The screens read these functions, so they make sense once the SQL is
in.

## What to do after it

1. **Issue the ID cards.** Open the control room, go to Attendance, pick a cohort and press
   **Issue cards**. Every participant in that cohort who has no card gets a number and a hidden
   token. Nobody already holding a card is given a second one.
2. **Print them.** The same screen prints a sheet sized for a normal laminating pouch. The QR holds
   the hidden token and nothing else, not a web address.
3. **On the day,** open Attendance, press **Open today**, say whether it is in a room or online, and
   scan people in. For an online class press **Reveal the code** during the lesson and read it out.

## What it changes on a live database

**Five new tables**, all of them new, none of them touching anything that already existed:
`lms_participant_cards`, `lms_learner_setup`, `lms_attendance_days`, `lms_attendance_checkins` and
`lms_attendance_responses`.

**One change to an existing table, and it only takes something away.** `lms_module_badges`, made in
file 24, still let a signed-in person empty it in one statement, because the default privileges on
this database grant everything on a new table to the browser roles. File 28 takes that away. Nothing
on the site has ever used it. Row level security cannot refuse a TRUNCATE, so the permission is the
only place to stop it.

**The certification tables are not altered at all.** The ID card needs a number and a secret token,
and the obvious home for them was two new columns on `participants`. `participants` is a
certification table, so the card data went into a table of its own that points at it instead.

## What it does NOT change

No learner's progress, no certificate, no entitlement, no course, no exam. Nothing that existed
before file 28 is read differently afterwards. The first-sign-in screen does not re-ask any of the
six things the sign-up page already collects, and it does not touch `lms_learner_profiles`, which
holds the disability answer and stays exactly as file 26 left it.

**There is no photograph anywhere in this file.** That was asked for, considered and declined for
now, so no photo column was created and no storage bucket was set up. The scanner shows a name and a
cohort. A later file can add a photo without disturbing anything here.

## The undo

`28_undo_EDITOR.sql` refuses unless you say you mean it, and then **refuses again to throw away
anybody's attendance**.

This undo is not like the others. Files 17 to 27 moved rules about, so undoing them changed nobody's
records. File 28 makes tables, and attendance is a record of something that happened to a person on
a particular day. So the undo removes the nineteen functions, which is what makes the feature stop,
and then drops only the tables that are **empty**. Any table holding rows is left exactly where it
is, and the undo says how many rows it refused to destroy. Those tables are inert once the functions
are gone: nothing can write them.

It does **not** hand TRUNCATE back on the badge table. Restoring that would reopen a hole.

## The test files, which do not go near Supabase

`database/lms/tests/file_28_tests.sql` runs 79 checks. Sections 2, 3 and 4 are the whole point: they
are the four loopholes demonstrated rather than described.

- **Section 2** has a learner try to scan somebody else's card and be refused, then has a facilitator
  scan the same card twice and shows one record, not two.
- **Section 3** reveals a code, shows that what is stored is a fingerprint and not the code, and has
  it refused when it has expired, when it belongs to another cohort and when it has already been
  used by that account.
- **Section 4** has somebody who was never marked present try to open the form, and be refused.
- **Section 5** shows the day boundary. At 23:30 UTC it is already tomorrow in Lagos, so a scan filed
  by the server's own date would land on the day before.
- **Section 0** checks the actors really hold the roles the test thinks they do. Without it, "a
  learner cannot scan" would go green on a database where the learner was never linked to a
  participant, because they would be refused for the wrong reason.

### How the tests were proved to be worth anything

The usual negative proof, running the tests on a database without the file, cannot work here: every
table and function is new, so without file 28 the suite dies on the first missing function rather
than reporting failures.

So each protection was deliberately broken instead, one at a time, and the suite was run to see
which checks went red. Eleven mutations, every one of them noticed:

| What was broken | Checks that went red |
|---|---|
| Staff-only scanning removed | 6 |
| The one-per-person-per-day rule dropped | 5 |
| The form's check-in requirement removed | 4 |
| The code's time window ignored | 2 |
| The code's cohort check removed | 1 |
| The day table made readable | 2 |
| The setup table made writable | 1 |
| TRUNCATE handed back | 2 |
| The server's date used instead of Lagos | 1 |
| Card issuing opened to anyone | 2 |
| Corrections opened to facilitators | 2 |

**That exercise found two real problems**, which is why it was worth doing. The expired-code check
was using a learner from the wrong cohort, so it was being refused by the cohort test and would have
gone green on a database that ignored the window completely. And the scan function's return value
leaned on a constraint in another object, so it raised an unreadable error rather than a clear one if
that constraint were ever removed. Both are fixed.
