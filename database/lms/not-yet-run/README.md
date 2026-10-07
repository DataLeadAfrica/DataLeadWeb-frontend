# Not yet run

`11_housekeeping.sql` and its verify and undo files have been written and tested but have NOT
been applied to the live database. Do not move them into `database/lms/` until they have.

## Before you run it

Run this first, because it decides whether the nightly clean-up gets a schedule:

```sql
select count(*) as pg_cron_installed from pg_extension where extname = 'pg_cron';
```

0 means the clean-up function will exist but will not be scheduled, and file 11 will say so in
a notice. Turn pg_cron on under Database, then Extensions, and run file 11 again if you want
the schedule.

## What it does

Part A, quiz safety:

- An attempt with nothing to mark is left in progress and refused, instead of being stamped as
  failed while telling the learner "All 0 correct. On you go."
- Nothing goes live with an empty set of questions: the course publish checklist gains a
  seventh item, and publishing the set on its own is refused outright.
- If a set of questions is ALREADY live and empty, Step 6 warns and names it. File 11 will not
  change it, because the only automatic fixes would be unpublishing content learners can see
  or inventing questions. Fix each one by hand.

Part B, housekeeping:

- Completing a lesson deletes that learner's watch slices for it, keeping the final watched
  figure on the progress row.
- Completing a lesson also deletes that learner's lesson check attempts for it. Module quiz
  attempts are kept. This is only safe because the file first records the pass on the progress
  row and switches the completion rule to read it.
- A nightly job removes slices from lessons abandoned for more than ninety days.
- `lms_storage_report()` shows the database against the 500 MB free allowance, table by table.
  Administrator only.

Part C: the file ends by calling `lms_tidy_table_privileges()` from file 10.

## Watch for

The order of authoring is now fixed: create a set of questions as a draft, add the questions,
then publish. You cannot create one already published and fill it in afterwards.

A draft set of questions with nothing in it will hold its whole course back from publishing.
That is deliberate. The blocker names which sets are empty.

## Read before undoing

The top of `11_undo.sql` explains the one thing it will not reverse, and gives a query that
tells you whether a full revert is still safe on your database.

See `docs/lms/WHAT-CHANGED-explained-file-11.md` for all of this in plain words, including the
storage measurement, and `docs/lms/test-evidence-file-11.md` for the tests failing and then
passing.
