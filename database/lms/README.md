# Data-Lead Academy database

This folder is the written record of the Academy's database. Every file here was pasted into
the Supabase SQL editor by hand, in the order below. Keeping them in the repository means the
schema exists somewhere other than inside Supabase.

The Academy lives in the **certification** Supabase project, the same one that holds
participants, programmes and certificates. It adds no new project. Every Academy table name
starts with `lms_` so that nothing collides with the certification tables that were already
there.

Nothing in this folder contains a key, a token, a password or a project URL.

## The files, in the order they were run

| # | File | What it does | Status |
| --- | --- | --- | --- |
| 01 | `01_core.sql` | Who people are. Creates the `lms_role` type, the `lms_profiles` table that hangs off Supabase Auth, the `lms_admin_actions` audit table, the three role helper functions and the `lms_touch` trigger function. | Run |
| 02 | `02_catalogue.sql` | What there is to learn. Courses, modules, lessons, learning paths, and the one row `lms_settings` table that holds the landing page words and the welcome video. | Run |
| 03 | `03_access.sql` | Who may open what. The `lms_entitlements` table that decides all access, plus the Paystack order and webhook event tables. | Run |
| 04 | `04_learning.sql` | Progress and questions. Lesson progress, the watch buckets behind the non skippable rule, quizzes, questions, options and attempts. | Run |
| 05 | `05_functions.sql` | The rules. Everything a learner could cheat by editing their browser lives here as a `SECURITY DEFINER` function: access checks, watch recording, unlocking, marking, publishing. | Run |
| 06 | `06_policies.sql` | The locks. Row level security on every table, and the sign up trigger on `auth.users`. | Run |
| 07 | `07_quizzes.sql` | Two kinds of questions. A lesson check that reports counts only, and a module quiz with a pass mark. Replaces the marking function from 05. | Run |
| 10 | `not-yet-run/10_roles_and_access.sql` | Renames the staff role to facilitator and makes access follow two email lists. | **NOT YET RUN** |

There is no 08 or 09 in this folder. Both were written and lost before being delivered: 08 was
storage housekeeping, 09 was an archive to Google Sheets that was deliberately deferred. See
`docs/lms/STATUS.md`.

## The not-yet-run folder

Three files sit in `not-yet-run/` because they have not been applied to the live database. They
are tested but unrun. Do not merge them into the numbered list above until they have actually
been run.

| File | What it does |
| --- | --- |
| `10_roles_and_access.sql` | Renames the `uploader` role to `facilitator`, repairs the function bodies that renaming breaks, creates the `lms_facilitators` email list, and adds `lms_sync_my_access()` which is called once after each sign in. |
| `10_verify.sql` | Run straight after. Returns ten rows that should all answer yes. |
| `10_undo.sql` | Puts the database back if something goes wrong. Afterwards re-run 05, 06 and 07. |

File 10 has been tested against all seven files above on a real PostgreSQL 16 database:
43 tests as real signed in and signed out roles, all passing, and holding through an
apply, undo, apply round trip.

**One known fault in file 10, left in place on purpose.** Its Step 1 comment says the rename
breaks `lms_lesson_is_open`, "which decides whether anyone can open a lesson at all". That is
wrong: the real `lms_lesson_is_open` does not mention the role. The function the rename actually
breaks is `lms_is_staff`, which the catalogue read policies call. The comment changes no
behaviour and the repair step handles the real case correctly, but the sentence should be
corrected before anybody relies on it.

## schema-snapshot.md

A readable record of what the live database actually contained on 6 October 2026: every table
with its columns, types, defaults and nullability, every enum, index, policy, privilege and
trigger, the one view, and the Academy function bodies. Taken by a read only query, not written
by hand.

Files 01 to 07 were checked against that snapshot object by object. Every table, enum, index,
policy, privilege, trigger, function and the view match. The files in this folder are the live
database.

## How to run one of these files

1. Open the certification project in Supabase.
2. Go to SQL Editor.
3. Open the file here on GitHub, press the copy button, and paste the whole thing in.
4. Press Run.
5. Read the notices. A red error means nothing was changed; send it on rather than trying the
   next file.

Run them in number order on a fresh database. On a database that already has them, they are
safe to run again: every table uses `create table if not exists`, every function uses
`create or replace`, and every policy is dropped before being created.

## One thing to know about privileges

In the live database, both the `anon` and the `authenticated` roles hold every table privilege
on every `lms_` table, including UPDATE, DELETE and TRUNCATE. That is Supabase's default for
new tables in the public schema and not something these files ask for. What actually stops a
learner writing to those tables is row level security, which is on for every table and has been
tested. The one privilege row level security never filters is TRUNCATE, so that one is worth
removing. See `docs/lms/STATUS.md`.
