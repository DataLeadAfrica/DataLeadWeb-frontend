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
| 01 | `01_core.sql` | Who people are. The `lms_role` type, the `lms_profiles` table that hangs off Supabase Auth, the `lms_admin_actions` audit table, the three role helpers and the `lms_touch` trigger function. | Run |
| 02 | `02_catalogue.sql` | What there is to learn. Courses, modules, lessons, learning paths, and the one row `lms_settings` table holding the landing page words and the welcome video. | Run |
| 03 | `03_access.sql` | Who may open what. The `lms_entitlements` table that decides all access, plus the Paystack order and webhook event tables. | Run |
| 04 | `04_learning.sql` | Progress and questions. Lesson progress, the watch slices behind the non skippable rule, quizzes, questions, options and attempts. | Run |
| 05 | `05_functions.sql` | The rules. Everything a learner could cheat by editing their browser, as `SECURITY DEFINER` functions. | Run |
| 06 | `06_policies.sql` | The locks. Row level security on every table, and the sign up trigger on `auth.users`. | Run |
| 07 | `07_quizzes.sql` | Two kinds of questions. A lesson check reporting counts only, and a module quiz with a pass mark. | Run |
| 10 | `10_roles_and_access.sql` | Renames the staff role to facilitator, makes access follow two email lists, adds the nightly access sweep, adds seven guards so only the administrator publishes, makes question imports retire instead of delete, tightens table permissions. | **Run 6 October 2026. `10_verify.sql` answered yes on all 20 rows** |
| 11 | `not-yet-run/11_housekeeping.sql` | Quiz safety and storage housekeeping. | **NOT YET RUN** |

There is no 08 or 09. Both were written and lost before being delivered: 08 was storage
housekeeping, which file 11 now does; 09 was an archive to Google Sheets, deliberately
deferred and no longer needed. See `docs/lms/STATUS.md`.

## The verify and undo files

Each numbered file ships with two companions. `10_verify.sql` and `11_verify.sql` answer yes
or no on every change the file was supposed to make, including checks on the data itself, not
just on the code. `10_undo.sql` and `11_undo.sql` put the database back.

Read the top of `11_undo.sql` before using it. There is one thing it deliberately does not
reverse, and the reason is that reversing it would lock learners out of lessons they have
already passed.

## The tests folder

`tests/` holds the test suites and the storage measurement, for a local copy of PostgreSQL
only. Nothing in it belongs on Supabase. See its own README.

## How to run one of these files

1. Open the certification project in Supabase.
2. Go to SQL Editor.
3. Open the file here on GitHub, press the copy button, and paste the whole thing in.
4. Press Run.
5. Read the notices. A red error means nothing was changed; send it on rather than trying the
   next file.
6. Run the matching verify file and read every row.

They are safe to run again: every table uses `create table if not exists`, every function uses
`create or replace`, and every policy and trigger is dropped before being created.

## Standing rule for anything new

**Every SQL file that creates an `lms_` table must end by calling
`lms_tidy_table_privileges()`.** Supabase grants every privilege on anything new in the public
schema to both `anon` and `authenticated`, including TRUNCATE, which row level security never
filters. The schema wide defaults are deliberately left alone because the certification system
shares the schema, so each new table has to be tidied as it is made. The other standing rules
are in `docs/lms/STATUS.md`.
