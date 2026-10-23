# Phase 6F, file 26: what to run in Supabase, and in what order

**Run files 01 to 24 first.** File 26 begins by checking they are in place and stops with a sentence
naming anything missing, so it cannot be run early by accident. There is no file 25 to run: that one
was the video player and is front end only.

| Order | What | Where |
|---|---|---|
| a | `database/lms/26_table_writes_EDITOR.sql`, then `26_verify_EDITOR.sql` | Supabase SQL editor |
| b | Merge the branch | GitHub |

`26_verify_EDITOR.sql` prints 8 rows. All should say yes, and it prints the allow list underneath
every time. `PHASE-6F-PLAIN.md` says what each number means. It is safe to run the verify before the
fix as well as after: it prints a column of NOs rather than an error.

**There is no front end change in this package at all**, so the order of the two steps does not
matter here. Run the SQL when you are ready.

**It is safe to run twice.** Running it three times in a row was part of the testing.

## What it changes on a live database

**A facilitator can no longer write any table directly.** Fourteen write policies are dropped and
insert, update and delete are revoked from `public`, `anon` and `authenticated` on those fourteen
tables. Every write now goes through a function that asks `lms_may_edit_course` or `lms_is_admin`
and logs it.

**A facilitator reads the answer key only for courses they may edit.** Administrators still read
every one. Learners and visitors still read none, which is where they already were.

**Nothing anybody has made changes.** This file moves policies and privileges and nothing else. No
course, lesson, question, badge or certificate is touched in either direction.

## What it does NOT change

`lms_profiles` keeps its self write, limited by column grants, and a learner still cannot set
`email_verified_at`. `lms_popup_seen` keeps its own row insert. The tables whose only write policy is
`lms_is_admin()` are left as they are, and each one is printed in the verify file's allow list with
its reason, so it is a decision rather than an oversight.

## The undo

`26_undo_EDITOR.sql` refuses unless you say you mean it, and the refusal carries the line that lets
it through. **It has the strongest reason of any undo so far**: undoing it puts back a hole that was
measured, not feared. It restores the policies exactly as file 24 left them, read out of a database
at that version rather than typed from memory.

It changes nothing anybody made, in either direction. After an undo, `26_verify.sql` says NO on rows
1 to 6 and 8 and yes on row 7, which is what the undo's own notice says to expect.

## The test files, which do not go near Supabase

`database/lms/tests/file_26_tests.sql` runs 24 checks in seven sections: the three attacks, the
regression that a facilitator can still do their whole job on their own course, an administrator
still reading everything, a learner and a visitor reading nothing, the policy helper being reachable
by the right people, the two reads that rode on a write policy being back, and no write policy or
grant left on the fourteen. On a database without file 26, 12 of the 24 fail.

Section 2 is the one worth keeping. Taking the write away without it would have stopped the control
room working for the very people it is for, which is the trap file 23 set and the same way out of it.

All of it runs with pg-safeupdate loaded, the way Supabase loads it for calls arriving through the
API.
