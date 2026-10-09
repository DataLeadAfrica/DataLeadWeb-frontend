# File 10 version 2: the tests, failing then passing

Six problems were raised by an outside review. For each one a test was written
FIRST, run against file 10 as it stood, shown failing, and only then was the fix
written. The same 36 tests appear in both runs below, unchanged between them.

Every test connects as a real role: `anon` for a visitor who is not signed in,
`authenticated` with a user id set for somebody who is, and the table owner with
no user id set where the point is to test a trigger rather than a policy.

The database was built from the real 01 to 07 files on PostgreSQL 16, with a small
local stand in for Supabase's auth schema.

## Result

| | Before the fix | After the fix |
| --- | --- | --- |
| Review tests | **13 passed, 23 failed** | **36 passed, 0 failed** |
| Original suite | 43 passed | 43 passed |

23 tests went from failing to passing. None went the other way.

## Before: file 10 version 1

```
 n  | result |                                  name                                   |                                   detail                                   
----+--------+-------------------------------------------------------------------------+----------------------------------------------------------------------------
  1 | pass   | M0 first sign in during cohort one creates the grant                    | expires 2026-09-07 00:00:00+00
  2 | FAIL   | M1 returning student in an active second cohort gets access back        | access=false expires 2026-09-07 00:00:00+00 msg: Nothing has changed since
  3 | FAIL   | M2 extending the cohort moves the expiry date                           | expires 2026-09-07, expected 2028-09-06
  4 | FAIL   | M3 an open ended enrolment clears the expiry                            | expires 2026-09-07 00:00:00+00
  5 | pass   | M4 calling it again changes nothing and leaves one live grant           | changed=false live=1
  6 | FAIL   | M5 facilitator CANNOT publish a course directly                         | rows changed=1
  7 | FAIL   | M6 facilitator CANNOT make a course free                                | rows changed=1
  8 | FAIL   | M7 facilitator CANNOT delete a course                                   | rows deleted=1
  9 | FAIL   | M8 facilitator CANNOT edit a course that is already live                | rows changed=1
 10 | FAIL   | M9 facilitator CANNOT create a course already published                 | the insert went through
 11 | FAIL   | M10 facilitator CANNOT add a module to a live course                    | the insert went through
 12 | FAIL   | M11 facilitator CANNOT change a lesson on a live course                 | the update went through
 13 | FAIL   | M12 the guard refuses a non-admin publishing a path                     | the update went through
 14 | FAIL   | M13 the guard refuses a non-admin publishing a set of questions         | the update went through
 15 | FAIL   | M13b the guard refuses a non-admin deleting a path                      | the delete went through
 16 | pass   | M14 facilitator CAN still edit a draft course                           | rows changed=1
 17 | pass   | M15 facilitator CAN still create a draft course                         | 
 18 | pass   | M16 facilitator CAN still add a module to a draft course                | 
 19 | pass   | M17 administrator CAN still publish                                     | published=true status=published msg: Published.
 20 | pass   | M18 administrator CAN unpublish and edit a live course                  | rows changed=1
 21 | pass   | M19 a learner can start the check, freezing the question ids            | attempt ca0b97c2-0927-4efc-b90a-498aa9107e73
 22 | FAIL   | M20 facilitator CANNOT import into a live set of questions              | 1 question(s) imported.
 23 | pass   | M21 facilitator CAN import into a draft set on a draft course           | 1 question(s) imported.
 24 | pass   | M22 administrator CAN revise a live set of questions                    | 2 question(s) imported.
 25 | FAIL   | M23 the old questions were NOT deleted                                  | old rows still present=0 of 2
 26 | FAIL   | M24 old questions were retired, new ones are active                     | active=2 retired=0
 27 | FAIL   | M25 the learner frozen question ids still point at real rows            | frozen ids with no row=2
 28 | FAIL   | M26 a learner mid attempt is still marked against real questions        | questions marked=0 feedback: All 0 correct. On you go.
 29 | pass   | M27 no two questions in one quiz share a position                       | clashing positions=0
 30 | FAIL   | M28 the nightly sweep closes a withdrawn student access with no sign in | function lms_nightly_access_sweep() does not exist
 31 | FAIL   | M29 the nightly sweep gives it back and sets the right expiry           | function lms_nightly_access_sweep() does not exist
 32 | FAIL   | M30 running the sweep again changes nothing                             | function lms_nightly_access_sweep() does not exist
 33 | pass   | M31 a learner CANNOT run the nightly sweep                              | refused: function lms_nightly_access_sweep() does not exist
 34 | FAIL   | M32 nobody signed in or out holds TRUNCATE, REFERENCES or TRIGGER       | still held: lms_admin_actions / anon / REFERENCES, lms_admin_actions / ano
 35 | FAIL   | M33 a visitor who is not signed in cannot write to any table            | still held: lms_admin_actions / DELETE, lms_admin_actions / INSERT, lms_ad
 36 | pass   | M34 a signed in person can still read the tables                        | tables readable=19
(36 rows)

13 passed, 23 FAILED, out of 36
```

## After: file 10 version 2

```
 n  | result |                                  name                                   |                                   detail                                   
----+--------+-------------------------------------------------------------------------+----------------------------------------------------------------------------
  1 | pass   | M0 first sign in during cohort one creates the grant                    | expires 2026-09-07 00:00:00+00
  2 | pass   | M1 returning student in an active second cohort gets access back        | access=true expires 2027-08-03 00:00:00+00 msg: Your bootcamp access has b
  3 | pass   | M2 extending the cohort moves the expiry date                           | expires 2028-09-06, expected 2028-09-06
  4 | pass   | M3 an open ended enrolment clears the expiry                            | expires null
  5 | pass   | M4 calling it again changes nothing and leaves one live grant           | changed=false live=1
  6 | pass   | M5 facilitator CANNOT publish a course directly                         | refused: Only the administrator can publish a course or change its price.
  7 | pass   | M6 facilitator CANNOT make a course free                                | refused: Only the administrator can publish a course or change its price.
  8 | pass   | M7 facilitator CANNOT delete a course                                   | refused: Only the administrator can delete a course.
  9 | pass   | M8 facilitator CANNOT edit a course that is already live                | refused: This course is live. Ask the administrator to unpublish it before
 10 | pass   | M9 facilitator CANNOT create a course already published                 | refused: New courses start as drafts.
 11 | pass   | M10 facilitator CANNOT add a module to a live course                    | refused: That course is live. Ask the administrator to unpublish it before
 12 | pass   | M11 facilitator CANNOT change a lesson on a live course                 | refused: That course is live. Ask the administrator to unpublish it before
 13 | pass   | M12 the guard refuses a non-admin publishing a path                     | refused: Only the administrator can publish a learning path.
 14 | pass   | M13 the guard refuses a non-admin publishing a set of questions         | refused: Only the administrator can publish a set of questions.
 15 | pass   | M13b the guard refuses a non-admin deleting a path                      | refused: Only the administrator can delete a learning path.
 16 | pass   | M14 facilitator CAN still edit a draft course                           | rows changed=1
 17 | pass   | M15 facilitator CAN still create a draft course                         | 
 18 | pass   | M16 facilitator CAN still add a module to a draft course                | 
 19 | pass   | M17 administrator CAN still publish                                     | published=true status=published msg: Published.
 20 | pass   | M18 administrator CAN unpublish and edit a live course                  | rows changed=1
 21 | pass   | M19 a learner can start the check, freezing the question ids            | attempt ed92feb4-e6f4-4e32-99bd-ab803d44bb54
 22 | pass   | M20 facilitator CANNOT import into a live set of questions              | These questions are live. Ask the administrator to change them, or unpubli
 23 | pass   | M21 facilitator CAN import into a draft set on a draft course           | 1 question(s) imported. 0 older question(s) kept but retired, so part-fini
 24 | pass   | M22 administrator CAN revise a live set of questions                    | 2 question(s) imported. 2 older question(s) kept but retired, so part-fini
 25 | pass   | M23 the old questions were NOT deleted                                  | old rows still present=2 of 2
 26 | pass   | M24 old questions were retired, new ones are active                     | active=2 retired=2
 27 | pass   | M25 the learner frozen question ids still point at real rows            | frozen ids with no row=0
 28 | pass   | M26 a learner mid attempt is still marked against real questions        | questions marked=2 feedback: 0 of 2 correct. Have another look at the ones
 29 | pass   | M27 no two questions in one quiz share a position                       | clashing positions=0
 30 | pass   | M28 the nightly sweep closes a withdrawn student access with no sign in | live grants=0 swept: granted 0 renewed 0 revoked 1 looked at 1
 31 | pass   | M29 the nightly sweep gives it back and sets the right expiry           | expires 2028-02-19, expected 2028-02-19
 32 | pass   | M30 running the sweep again changes nothing                             | granted 0 renewed 0 revoked 0
 33 | pass   | M31 a learner CANNOT run the nightly sweep                              | refused: permission denied for function lms_nightly_access_sweep
 34 | pass   | M32 nobody signed in or out holds TRUNCATE, REFERENCES or TRIGGER       | none
 35 | pass   | M33 a visitor who is not signed in cannot write to any table            | none
 36 | pass   | M34 a signed in person can still read the tables                        | tables readable=19
(36 rows)

36 passed, 0 FAILED, out of 36
```

## The original 43 tests

Five of the original tests failed against version 2 at first, and they were right to:
they asserted that a facilitator may add a module, a lesson and a set of questions
to a course that is already published. The review has deliberately forbidden that, so
those five tests were encoding the fault. They now build inside a draft course, which
is the only correct path, and the refusal on a published course is covered by the new
tests M10 and M11.

A sixth problem turned up in the test harness itself. A test whose result came back
as neither true nor false was recorded as null, and the summary query filtered
failures with `where not pass`, which quietly skips nulls. One real failure was
hiding there. The harness now stores null as false, and the summary counts anything
that is not a pass.

## Running them yourself

The files are in `database/lms/tests/`. They are for a local copy of PostgreSQL only.
The file whose name begins DO-NOT-RUN-ON-SUPABASE invents a fake version of
Supabase's own auth schema; running it on Supabase would fail, and the whole folder
has no business being run there.
