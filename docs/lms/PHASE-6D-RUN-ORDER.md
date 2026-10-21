# Phase 6D: what to run in Supabase, and in what order

**The order matters more than usual in this one.** File 19 copies Supabase's answer about who has
confirmed their address into a column of our own, and that answer is only true while Supabase is
still making people confirm. Run it after the setting is off and every account made in between is
marked proven when nobody proved anything.

| Order | What | Where |
|---|---|---|
| a | `database/lms/19_email_check_EDITOR.sql`, then `19_verify_EDITOR.sql` | Supabase SQL editor, **with Confirm email still ON** |
| b | `database/lms/20_lesson_checks_EDITOR.sql`, then `20_verify_EDITOR.sql` | Same session is fine |
| c | `database/lms/21_execute_privileges_EDITOR.sql`, then `21_verify_EDITOR.sql` | Same session is fine |
| d | Merge the branch | GitHub |
| e | Turn **Confirm email off** | Supabase, Authentication, Sign In / Providers, Email |

Between a and e the old flow keeps working. File 19 changes only who counts as proven, and
everybody who has already confirmed is backfilled.

`19_verify_EDITOR.sql` prints 19 rows, `20_verify_EDITOR.sql` prints 6 and
`21_verify_EDITOR.sql` prints 11. All should say yes.
`PHASE-6D-PLAIN.md` says what each number means.

Row 18 of the first one is the odd one out and is nothing to do with email. It asks whether
`lms_set_lesson_chapters` is still callable by a signed in account, which is the second half of the
chapter fault Big Sam found. It rides along in 6D because it is a live hole rather than a future
one. File 20 is what closes it, so row 18 says NO until step b is done.

## Why file 19 must go in before the setting changes

Sign up stops sending a code, so a typed address proves nothing. With Confirm email off, Supabase
sets `email_confirmed_at` the instant an account row is inserted, and **eleven places** in files 01
to 18 read that column.

The worst is not the certificate link. `lms_sync_my_access` gates three things behind that one
timestamp: facilitator access by email address, the participant link, and bootcamp access through
it. Unchanged, somebody who signed up with an appointed facilitator's address would be handed the
control room on their first sign in.

File 19 moves all of that onto `lms_profiles.email_verified_at`, which nothing sets except a
correct code typed on My learning.

**Run it twice if you are unsure whether it took.** It records the moment of its first run and
never backfills an account created after that, which is what makes a second run safe.

## File 20 is the one Big Sam has been waiting for

Nothing in the control room ever created a lesson check. Every lesson built in the builder had
none, so the Questions page had no id to give its editor, writing a question answered "invalid
input syntax for type uuid", and publish check 7 could never pass. No course could be published at
all.

File 20 makes the check with the lesson, and sweeps up every video lesson that already exists
without one. That sweep is the same one Big Sam ran by hand, so a rebuild lands where live already
is.

## File 21 is a security fix, and step c is where it goes

Three security definer functions were executable by everybody, signed in or out. The worst,
`lms_link_participant`, joins an account to somebody's certification record by email address and
checks nothing about who called it: the review called it as a plain learner and was joined to another
person's record. `lms_grant_free_courses` grants free courses to any account id, and
`lms_storage_report` reads row counts and sizes for a visitor.

All three are already shut on live, by hand. File 21 makes it permanent so a database rebuilt from
these files does not reopen them, and does the same for everything else that nothing calls. It only
ever takes privileges away, except for eight explicit grants to `authenticated` that put back what
the file itself would otherwise have removed.

**It is safe to run after 19 and 20 in the same session, and safe to run twice.** Row 8 of its
verify is the one to read: it fails on any `lms_` function a visitor can execute that is not on the
written allow list, so it keeps working on functions that do not exist yet.

If a row says NO, do not go looking for a sweep to fix it. Rows 5, 6, 7 and 9 exist precisely to
catch that: five of these functions are called inside 36 row level security policies, one is used
in a CHECK constraint, and the certification system reaches a dozen more as a visitor with its own
token login. `PHASE-6D-PLAIN.md` explains each row.

## What is NOT run

`12_email_and_health.sql` carries the `send_email_hook` search_path fix from 6C. It is already
live, by hand, so the file only matters to a rebuild.

`16_restructure.sql` is the same: already fixed on live by hand, so its changes only matter to a
rebuild. There are two, both in `lms_set_lesson_chapters`:

- the bare `delete from tmp_chapters` becomes `delete from tmp_chapters where true`, which is the
  exact form Big Sam ran on live. Supabase loads pg-safeupdate for calls arriving through the API
  and it refuses a `DELETE` with no `WHERE`, inside a security definer function as readily as
  anywhere else, so every lesson save on live was failing;
- the `grant execute ... to authenticated` is commented out, because that function asks "are you
  staff" and never "is this lesson yours".

Both are also applied by file 20 for a database that already exists, which is what step b does. The
file 16 edits are only for a database built from scratch.

## Two always-zero warnings, on purpose

With Confirm email off, the 24 hour prune of unconfirmed sign ups and the two health warnings about
them will never find anything again. They are **left in place** deliberately: they cost nothing,
and if the setting is ever turned back on they start working again. Do not read a zero there as
good news, because it is no longer news at all.

## The risk Big Sam has accepted, written down

With Confirm email off, Supabase's own sign up API answers an existing address differently from a
new one, whatever our page shows. Somebody calling that API directly can learn whether an address
has an account. Supabase's rate limits slow it down and nothing behind it is unlocked without the
email check, but it is true and it is worth having written down rather than discovered.

The Academy's own sign up page gives nothing away: both cases reach the same panel, with the same
words, and neither leaves a session in the browser. That is checked in a real browser, driving the
real form, for both cases.

## The undos

Each of 19, 20 and 21 has one, and each refuses unless you say you mean it, because each undoes
something that was a live fault.

- **19** restores the gate that trusts a typed address. If you run it, turn Confirm email back **on**
  first: the two belong together and the file cannot check the setting for you. The
  `email_verified_at` column and its timestamps are kept, so re-applying is safe.
- **20** stops anything creating a lesson check, which means no course can be published from the
  control room. Existing checks and the questions in them are kept.
- **21** hands three security definer functions back to every visitor, including the one that joins
  an account to somebody's certification record by email and asks nothing about who called it.
  Running it on live would undo work done there by hand as well as work done by these files. It
  deliberately does NOT remove the eight explicit grants to `authenticated`, because doing so would
  break the Academy for signed in learners, and `lms_sync_my_access` would stop working for
  everybody.

## The test files, which do not go near Supabase

`database/lms/tests/file_19_tests.sql` runs 33 checks and `file_20_tests.sql` runs 14. They make
accounts, build a whole course, act as a learner through row level security and roll everything
back. Section 2 of file 20's is the one worth knowing about: it builds a course from
`lms_create_course` to nine of nine publish checks and publishes it, inserting nothing by hand.
That is the path that was broken, and it is now the path that is tested.

All of it now runs with pg-safeupdate loaded, the way Supabase loads it for calls arriving through
the API, so a bare `DELETE` or `UPDATE` fails locally the way it was failing on live. The harness
loads it and says so in a notice if it cannot. The guard stops nothing in the whole matrix or in
any test file: the one bare statement in the numbered files was the one Big Sam had already found.
