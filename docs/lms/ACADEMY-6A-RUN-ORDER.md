# What to run in Supabase, and in what order

Three files, in this order. Nothing else in this branch touches the database.

| Order | File | What it does | How long |
|---|---|---|---|
| 1 | `database/lms/16_restructure.sql` | The whole restructure, in one transaction | A few seconds |
| 2 | `database/lms/16_verify.sql` | Changes nothing. Prints 55 rows | Instant |
| 3 | only if it has to come off: `database/lms/16_undo.sql` | Puts it back as file 15 left it | A few seconds |

## Before you start

**Not yet.** Part A and Part B come in together, and nothing is run on Supabase until you have
reviewed both. This page is the order for when you are ready.

File 16 checks for itself that files 01 to 15 have been run, and stops with a list of what is
missing if any of them has not. You do not need to check first.

## 1. Run the restructure

Open the Supabase SQL editor, paste the whole of `16_restructure.sql`, and run it.

It is one transaction. Either all of it lands or none of it does, so there is no half applied state
to clean up. Running it a second time changes nothing, so if you are unsure whether it took, run it
again.

You should see a line of notices, one per step, ending with:

```
Step 16: locked down 7 reference tables, then checked permissions on 30 Academy tables and views.
```

## 2. Run the verify

Paste the whole of `16_verify.sql` and run it. It writes nothing.

**Read every row. All 55 should say yes in the answer column.** If one says NO, the fourth column
says what that row was protecting and what to do about it.

- **Rows 1 to 36** are the brief.
- **Rows 37 to 48** are the eight things you found in your review of the first delivery, one row
  each, so you can check the fixes off against your own list.
- **Rows 49 to 55** are what the learner pages needed: the lesson door handing over the chapters
  and the furthest second, `lms_my_course` with no module quiz rows, `lms_my_path`, and the places
  a popup may not appear.

If you run this one before the restructure by mistake, you get 50 NOs rather than a Postgres error,
which is the answer: run the restructure first. That is what the file is for, so if it ever gives
you an error instead of a column of NOs, tell me.

## 3. The undo, only if needed

`16_undo.sql` puts the database back as file 15 left it.

**It refuses if anybody has used the new things.** If any learner has filled in the About you form,
or anybody has sat a course or path exam, it stops and changes nothing, because undoing would throw
those away. If you genuinely want that, run this first, in the same editor session:

```sql
select set_config('lms.undo_16_force', 'yes, delete learner answers', true);
```

One thing it cannot put back exactly: `coverage_percent` was raised to 100 on every lesson, and the
undo sets it back to 92, which is the number file 15 used. If any single lesson had its own figure
before, set that one again afterwards.

## After it is run

Nothing on the live site changes until the branch is merged and deployed. File 16 only adds tables
and functions; the pages that use them come with the branch.

Two things are seeded as drafts and are not live until staff publish them:

- the first popup, which promotes Power BI dashboards
- a course exam is created as a draft, and goes live through `lms_publish_exam` once its question
  bank holds at least 1.5 times one try

### One nightly job is added

The restructure schedules `lms-prune-unconfirmed-signups` for 03:12 every night, next to file 11's
existing watch slice prune at 02:42. It deletes accounts that never confirmed their email and are
more than a day old, and only if they have nothing at all: no grant anybody had to give them, no
attempt, no progress, no watch slice, no About you answers and no certificate. A confirmed account
is never touched. The count goes into `lms_admin_actions` every night, so you can check it with:

```sql
select created_at, detail from lms_admin_actions
 where action = 'prune_unconfirmed_signups'
 order by created_at desc limit 14;
```

To run it by hand: `select lms_prune_unconfirmed_signups();`

### One thing to watch in system_health

`system_health` gains a row called **"sign up answers refused, last 7 days"**. It should read `ok`
and `0`. If it ever reads `warn`, somebody filled in the About you form and the database refused
the answers, which almost always means the form and the database have stopped agreeing about a
rule. The account was kept and nothing was stored. The reason is in:

```sql
select at, detail from lms_system_heartbeat where name = 'signup_answers_refused';
```

## The test file, which does not go near Supabase

`database/lms/tests/file_16_tests.sql` runs 52 checks, and it is **not** for the Supabase editor: it
makes a learner, sits an exam twice, and gets refused a third time, so it writes rows and then rolls
them back. I run it on a local copy of the database. It is in the package so the checks are written
down and can be run again, not because you need to run it.
