# Tests

**This whole folder is for a local copy of PostgreSQL. None of it belongs on Supabase.**

The three files whose names begin DO-NOT-RUN-ON-SUPABASE build pretend versions of things that
already exist on the real project, so the other files have something to run against. On Supabase
the auth schema exists and is not yours to create, the second would overwrite live mailer
functions, and the third would alter the live certification tables. They are named the way they
are because that mistake has already been made once.

**253 tests in seven suites. All 253 pass against files 01 to 15.**

| Suite | Tests | What it covers |
| --- | --- | --- |
| `original_tests.sql` | 43 | What file 10 was built to do |
| `review_tests.sql` | 36 | The six things the outside review raised |
| `file_11_tests.sql` | 28 | Quiz safety and housekeeping |
| `file_12_tests.sql` | 52 | The sign in deadlock, the health check and its token, and the refusal to delete an answered question |
| `file_13_tests.sql` | 18 | Course certificates, and who may set how long a video is |
| `file_14_tests.sql` | 29 | The two leaks file 14 closes, and the public catalogue |
| `file_15_tests.sql` | 47 | The two traps file 15 removes, and the learning pages |

Every number above was counted from a run, not from the commit that added the suite. An earlier
version of this file said the file 12 suite had 25 tests; it has had 52 for some time.

## What is here

| File | What it is |
| --- | --- |
| `DO-NOT-RUN-ON-SUPABASE_local-harness.sql` | A stand in for Supabase's auth schema, the three roles, and the certification tables the Academy points at. Local only |
| `DO-NOT-RUN-ON-SUPABASE_mail-harness.sql` | The live mailer tables and functions, transcribed from the database snapshot so file 12 has the real thing to replace. Local only. On Supabase these already exist and running this would overwrite them |
| `DO-NOT-RUN-ON-SUPABASE_certification-harness.sql` | The certification pieces file 13 leans on: the `modules` table, `make_certificate_number`, the verify function, and **the UNIQUE rule on `certificates.certificate_number`**. See the note below. Local only |
| `seed_original_tests.sql` + `original_tests.sql` | The original suite |
| `seed_review_tests.sql` + `review_tests.sql` | The review suite |
| `seed_file_11_tests.sql` + `file_11_tests.sql` | The file 11 suite |
| `seed_file_12_tests.sql` + `file_12_tests.sql` | The file 12 suite. The seed includes an outbox row deliberately left stuck for 25 minutes, and clears `lms_system_heartbeat` so the suite is repeatable |
| `seed_file_13_tests.sql` + `file_13_tests.sql` | The file 13 suite |
| `seed_file_14_tests.sql` + `file_14_tests.sql` | The file 14 suite. Results land in `t14_results`, not `t_results` |
| `seed_file_15_tests.sql` + `file_15_tests.sql` | The file 15 suite. Results land in `t15_results`. The seed builds one course shaped so every state a learning page draws exists in it at once |
| `measure_storage.sql` | Builds a 30 lesson course and a cohort of 20, for the storage measurement |
| `measure_complete_lessons.sql` | Has that cohort finish every lesson, so the housekeeping fires |
| `measure_report.sql` | Prints the row counts and sizes |

### The UNIQUE rule on certificates.certificate_number

The real `certificates` table on Supabase has a UNIQUE rule on `certificate_number`. The local
stand in was written before file 13 existed and did not, so **file 13 refused to apply locally**
with:

```
ERROR: This database is not ready for file 13. Missing or different:
  a UNIQUE rule on certificates.certificate_number
```

File 13 is right to insist. Without the rule, issuing the same certificate twice makes two rows
and "safe to run twice" stops being true. The certification harness now adds the rule if it is
missing, so this is handled for you as long as you apply that harness **before** file 13. The
order below does.

## How to run them on a local PostgreSQL 16

Build the database once per suite:

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
psql -d lmstest -f ../11_housekeeping.sql
psql -d lmstest -f DO-NOT-RUN-ON-SUPABASE_mail-harness.sql
psql -d lmstest -f ../12_email_and_health.sql
psql -d lmstest -f DO-NOT-RUN-ON-SUPABASE_certification-harness.sql
psql -d lmstest -f ../13_course_certificates.sql
psql -d lmstest -f ../14_public_catalogue.sql
psql -d lmstest -f ../15_learning_pages.sql
```

**The two harness files are not interchangeable in order.** The mail harness goes before file 12
and the certification harness before file 13, because each one builds what the file that follows
it checks for.

Then a seed and its suite, and read the results:

```
psql -d lmstest -f seed_review_tests.sql
psql -d lmstest -f review_tests.sql
psql -d lmstest -c "select n, case when coalesce(pass,false) then 'pass' else 'FAIL' end, name, detail from t_results order by n"
```

The file 14 suite writes to a different table, so its last line is:

```
psql -d lmstest -c "select n, case when coalesce(pass,false) then 'pass' else 'FAIL' end, name, detail from t14_results order by n"
```

Use a **fresh database for each suite**. They share fixture identifiers, and a suite run on top
of another suite's leftovers fails for reasons that have nothing to do with the code.

### Watching a suite fail first

A test that has never failed has never proved anything. Each of the last three suites has a way
to see it fail:

| Suite | Leave out | You should get |
| --- | --- | --- |
| file 12 | `../12_email_and_health.sql` | 11 passed, 14 FAILED |
| file 13 | `../13_course_certificates.sql` | 7 passed, 11 FAILED |
| file 14 | `../14_public_catalogue.sql` | 7 passed, 22 FAILED |
| file 15 | `../15_learning_pages.sql` | 9 passed, 36 FAILED |

All four were measured on 8 October 2026, not remembered.

### What the file 15 suite looks like before the file is run

Four of its failures are not missing features. They are faults a learner
can reach on an ordinary bad day, and the suite prints them in plain words:

```
10  FAIL  A LESSON CHECK NEVER LOCKS ANYONE OUT: try 21 still opens
          LOCKED OUT. The lesson, and the course, can never be finished
14  FAIL  NOBODY IS TRAPPED: the quiz says when it opens again
          NO REOPENING TIME. Shut for ever
25  FAIL  a FAILED module quiz gives away nothing per question
          LEAKED 3 marked questions, solvable by elimination
27  FAIL  rewinding and stopping is remembered as the LATEST position
          sent back to the furthest point, 250
```

Two notes on the file 15 seed, both of which cost an afternoon to find
once and should not cost it again:

- **The slices it plants are dated an hour ago, not now.** `lms_record_watch`
  refuses more than nine slices a minute as script-like. Fifteen slices
  dated this instant make every later recording in the suite be refused,
  and the tests fail for a reason that has nothing to do with the thing
  being tested.
- **The answer key is built as the owner, before the role changes.**
  `lms_options` has exactly one policy, `p_opt_staff_only`, so a learner
  reading that table gets nothing at all. That is `is_correct` never
  leaving the server, working correctly, and it means a test cannot look
  up the right answers while it is the learner.

The file 14 one is the interesting one. The two failures at the top are the two real leaks: a
stranger reading every video reference, and a stranger reading courses that are still drafts.
Both of those are in the failing 22, which is the point of running it this way round.

One of the seven that passes before file 14 passes for an uninteresting reason: test 15, "no
public function returns a video reference or a body", is trivially true when the public
functions do not exist yet. It is kept because it is the test that would catch somebody adding
a video reference to `lms_public_course` later.

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

Mistakes worth not repeating, all of which happened here:

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
- **A suite must leave the database as it found it.** In the file 12 suite, P13 checks that a
  mailer which has never called in raises an alarm, and P14, four lines later, makes it call in.
  The second run on the same database saw the first run's heartbeat and P13 passed for the wrong
  reason. The seed now clears `lms_system_heartbeat`.
- **A test for an absent rule must survive the thing being absent.** `14_verify.sql` asked
  whether a function behaved correctly inside a `CASE` guard that checked the function existed.
  PostgreSQL resolves function names when it parses the statement, not when it runs it, so the
  guard never helped and the whole row returned nothing. It uses `query_to_xml` now, which takes
  the query as text and resolves it later.
