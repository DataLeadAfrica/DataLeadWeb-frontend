# Tests for file 10

**This whole folder is for a local copy of PostgreSQL. None of it belongs on Supabase.**

The file whose name begins DO-NOT-RUN-ON-SUPABASE builds a pretend version of Supabase's
own auth schema so the other files have something to run against. On Supabase that schema
already exists and is not yours to create, so running it there fails with a permission
error. It is named the way it is because that mistake has already been made once.

## What is here

| File | What it is |
| --- | --- |
| `DO-NOT-RUN-ON-SUPABASE_local-harness.sql` | A stand in for Supabase's auth schema, the three roles, and the certification tables the Academy points at. Local only |
| `seed_original_tests.sql` | Test data for the original suite |
| `original_tests.sql` | 43 tests covering what file 10 was built to do |
| `seed_review_tests.sql` | Test data for the review suite |
| `review_tests.sql` | 36 tests covering the six things the outside review raised |
| `seed_file_11_tests.sql` | Test data for the file 11 suite |
| `file_11_tests.sql` | 28 tests covering quiz safety and housekeeping |
| `measure_storage.sql` | Builds a 30 lesson course and a cohort of 20, for the storage measurement |
| `measure_complete_lessons.sql` | Has that cohort finish every lesson, so the housekeeping fires |
| `measure_report.sql` | Prints the row counts and sizes |

## How to run them on a local PostgreSQL 16

```
createdb lmstest
psql -d lmstest -f DO-NOT-RUN-ON-SUPABASE_local-harness.sql
psql -d lmstest -f ../01_core.sql
psql -d lmstest -f ../02_catalogue.sql
psql -d lmstest -f ../03_access.sql
psql -d lmstest -f ../04_learning.sql
psql -d lmstest -f ../05_functions.sql
psql -d lmstest -f ../06_policies.sql
psql -d lmstest -f ../07_quizzes.sql
psql -d lmstest -f ../10_roles_and_access.sql
psql -d lmstest -f ../not-yet-run/11_housekeeping.sql

psql -d lmstest -f seed_review_tests.sql
psql -d lmstest -f review_tests.sql
psql -d lmstest -c "select n, case when pass then 'pass' else 'FAIL' end, name, detail from t_results order by n"
```

Then the same two lines with `seed_original_tests.sql` and `original_tests.sql`, and again
with `seed_file_11_tests.sql` and `file_11_tests.sql`.

## Reproducing the storage measurement

```
psql -d lmstest -f measure_storage.sql
psql -d lmstest -f measure_report.sql            # before any lesson is finished
psql -d lmstest -f measure_complete_lessons.sql
psql -d lmstest -f measure_report.sql            # after
psql -d lmstest -c "vacuum full lms_watch_buckets"
psql -d lmstest -c "vacuum full lms_quiz_attempts"
psql -d lmstest -c "vacuum full lms_lesson_progress"
psql -d lmstest -f measure_report.sql            # the true steady state
```

The vacuum step matters. PostgreSQL does not return space to the operating system when rows
are deleted, so without it the sizes look unchanged even though the rows have gone.

## How the tests avoid fooling themselves

Each test connects as a real role rather than as the database owner, because a suite run as
the owner bypasses row level security entirely and passes for the wrong reason. The roles
used are `anon` for a visitor who is not signed in, `authenticated` with a user id set in
`request.jwt.claim.sub` for somebody who is, and the owner with no user id set only where
the point is to test a trigger rather than a policy.

Two mistakes worth not repeating, both of which happened here:

- The session setting that stands in for the signed in user must be session scoped, not
  transaction scoped. Set it transaction scoped and the signed in user is null for the whole
  run, and every denial test passes for no reason at all.
- A test whose result is neither true nor false must count as a failure. It used to be
  stored as null, and `where not pass` silently skips nulls, which hid a real failure.
- A destructive test must use its own throwaway fixture. One delete test removed the course
  the next seven tests needed, turning one real failure into eight and hiding which was
  which.
- `lms_record_watch` throttles a burst of calls on purpose, so a loop asking for twelve
  slices records about ten. Build a fully watched lesson by inserting the slices as the
  owner, and test the throttle separately.
