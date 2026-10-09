# File 11: the tests, failing then passing

Six things were asked for. For each one a test was written FIRST, run against the
database as it stood with files 01 to 07 and file 10 applied, shown failing, and only
then was the fix written. The same 28 tests appear in both runs below, unchanged.

Every test connects as a real role: `authenticated` with a user id set for a learner,
a facilitator or the administrator, and the table owner with no user id set where the
point is to test a trigger rather than a policy, which is also what the Supabase SQL
editor looks like.

## Result

| | Before file 11 | After file 11 |
| --- | --- | --- |
| File 11 tests | **17 passed, 11 failed** | **28 passed, 0 failed** |
| File 10 review suite | 36 passed | 36 passed |
| Original suite | 43 passed | 43 passed |

11 tests went from failing to passing. None went the other way.

## The headline failure, reproduced

```
N1  FAIL  zero marked questions never tells the learner they are through
          passed=false marked=0 feedback: All 0 correct. On you go.
N2  FAIL  zero marked questions leaves the attempt unmarked instead of failing it
          status=failed submitted=true
```

The route is no longer the question import, which file 10 fixed. It is an administrator
deleting a question outright while somebody is partway through. The learner was told
they were finished and had one of their tries used up.

After the fix:

```
N1  pass  passed=false marked=0 feedback: These questions are not available at the
          moment, so nothing has been marked and nothing has been recorded.
N2  pass  status=in_progress submitted=false
```

## Before: files 01 to 07 and file 10

```
 n  | result |                                    name                                    |                          detail                           
----+--------+----------------------------------------------------------------------------+-----------------------------------------------------------
  1 | pass   | N0 a learner cannot start a check that has no questions                    | attempt none, which is correct
  2 | pass   | N0b the learner starts a real check                                        | attempt 15a13d5e-21e1-489a-a1f2-843f4b6ffa7d
  3 | FAIL   | N1 zero marked questions never tells the learner they are through          | passed=false marked=0 feedback: All 0 correct. On you go.
  4 | FAIL   | N2 zero marked questions leaves the attempt unmarked instead of failing it | status=failed submitted=true
  5 | FAIL   | N3 an empty set of questions blocks the course from publishing             | blockers=0 -> none
  6 | FAIL   | N4 the administrator is refused, with a readable reason                    | Published.
  7 | FAIL   | N5 publishing an empty set of questions is refused                         | the update went through
  8 | pass   | N6 a set of questions with a question CAN still be published               | rows changed=1
  9 | pass   | N7 once every check has a question the course can publish                  | blockers left=0
 10 | pass   | N8 lms_record_watch throttles a burst, as it is meant to                   | slices recorded in one burst=10 of 12 asked for
 11 | pass   | N8b the lesson is now fully watched                                        | slices=12
 12 | pass   | N9 the learner passes the lesson check                                     | All 1 correct. On you go.
 13 | pass   | N10 the learner passes the module quiz                                     | Passed with 100.00 percent.
 14 | pass   | N11 lesson one completes                                                   | Lesson complete.
 15 | FAIL   | N12 completing the lesson threw away its watch slices                      | slices left=12
 16 | FAIL   | N13 the final coverage figure was kept on the progress row                 | column "final_coverage" does not exist
 17 | pass   | N14 coverage still reads correctly after the slices are gone               | coverage reported=100.00
 18 | FAIL   | N15 the lesson check attempts went, the module quiz attempt stayed         | check attempts=1 module attempts=1
 19 | FAIL   | N16 the pass itself was written onto the progress row                      | column "check_passed" does not exist
 20 | pass   | N17 the lesson is NOT locked after its attempts are deleted                | Lesson complete.
 21 | pass   | N18 the next lesson is still unlocked                                      | unlocked=true
 22 | pass   | N19 lesson three has some slices, then is abandoned                        | slices=4
 23 | FAIL   | N20 the nightly prune clears abandoned slices and spares recent ones       | function lms_prune_watch_buckets() does not exist
 24 | pass   | N21 the prune leaves every progress row alone                              | progress rows=2
 25 | pass   | N22 a learner CANNOT read the storage report                               | refused: function lms_storage_report() does not exist
 26 | FAIL   | N23 the administrator gets a row per table plus a total                    | function lms_storage_report() does not exist
 27 | pass   | N24 no table grants TRUNCATE, REFERENCES or TRIGGER                        | none
 28 | pass   | N25 a visitor who is not signed in holds no write privilege                | none
(28 rows)

17 passed, 11 FAILED, out of 28
```

## After: with file 11

```
 n  | result |                                    name                                    |                                 detail                                 
----+--------+----------------------------------------------------------------------------+------------------------------------------------------------------------
  1 | pass   | N0 a learner cannot start a check that has no questions                    | attempt none, which is correct
  2 | pass   | N0b the learner starts a real check                                        | attempt 82c08b12-b9fe-4594-83d3-0baec23691b4
  3 | pass   | N1 zero marked questions never tells the learner they are through          | passed=false marked=0 feedback: These questions are not available at t
  4 | pass   | N2 zero marked questions leaves the attempt unmarked instead of failing it | status=in_progress submitted=false
  5 | pass   | N3 an empty set of questions blocks the course from publishing             | blockers=1 -> Every set of questions has at least one question. Still 
  6 | pass   | N4 the administrator is refused, with a readable reason                    | This course is not ready yet. 1 thing(s) still missing.
  7 | pass   | N5 publishing an empty set of questions is refused                         | refused: This set of questions has no questions in it yet, so it canno
  8 | pass   | N6 a set of questions with a question CAN still be published               | rows changed=1
  9 | pass   | N7 once every check has a question the course can publish                  | blockers left=0
 10 | pass   | N8 lms_record_watch throttles a burst, as it is meant to                   | slices recorded in one burst=10 of 12 asked for
 11 | pass   | N8b the lesson is now fully watched                                        | slices=12
 12 | pass   | N9 the learner passes the lesson check                                     | All 1 correct. On you go.
 13 | pass   | N10 the learner passes the module quiz                                     | Passed with 100.00 percent.
 14 | pass   | N11 lesson one completes                                                   | Lesson complete.
 15 | pass   | N12 completing the lesson threw away its watch slices                      | slices left=0
 16 | pass   | N13 the final coverage figure was kept on the progress row                 | final coverage=100.00
 17 | pass   | N14 coverage still reads correctly after the slices are gone               | coverage reported=100.00
 18 | pass   | N15 the lesson check attempts went, the module quiz attempt stayed         | check attempts=0 module attempts=1
 19 | pass   | N16 the pass itself was written onto the progress row                      | check_passed=true
 20 | pass   | N17 the lesson is NOT locked after its attempts are deleted                | Lesson complete.
 21 | pass   | N18 the next lesson is still unlocked                                      | unlocked=true
 22 | pass   | N19 lesson three has some slices, then is abandoned                        | slices=4
 23 | pass   | N20 the nightly prune clears abandoned slices and spares recent ones       | abandoned left=0 recent left=1 pruned=4
 24 | pass   | N21 the prune leaves every progress row alone                              | progress rows=2
 25 | pass   | N22 a learner CANNOT read the storage report                               | refused: Only the administrator can read the storage report.
 26 | pass   | N23 the administrator gets a row per table plus a total                    | rows=19 database size=9463 kB
 27 | pass   | N24 no table grants TRUNCATE, REFERENCES or TRIGGER                        | none
 28 | pass   | N25 a visitor who is not signed in holds no write privilege                | none
(28 rows)

28 passed, 0 FAILED, out of 28
```

## Two fixture problems found on the way, both mine

A learner cannot start a set of questions that is empty: `lms_start_quiz` refuses,
which is why the first version of these tests could not reproduce the fault at all.
The reachable route had to be found before the test meant anything.

`lms_record_watch` deliberately throttles a burst of calls, so asking it for twelve
slices in a loop records about ten. That is the anti-cheating rule working. The fully
watched state is now built by the owner inserting the slices directly, and a separate
test asserts the throttle still bites.

Two older test seeds also had to change, because they created published sets of
questions BEFORE adding any questions to them, which file 11 now forbids. They create
them as drafts, add the questions, then publish, which is the order the control room
follows anyway.
