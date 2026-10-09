# File 13: tests failing first, then passing

Every test connects as a real `anon` or `authenticated` role, never as the database owner, because a
suite run as the owner bypasses row level security and passes for the wrong reason.

The database is built from the real files: the harness, then `01_core.sql` through `07_quizzes.sql`
as they are live, then files 10, 11 and 12, then a transcription of the certification pieces file 13
writes into, taken from the definitions sent on 7 October 2026. The only difference between the two
runs below is whether `13_course_certificates.sql` has been applied.

## The suite: 18 tests

| Range | What it covers |
| --- | --- |
| U1 to U4 | Part B, nobody but staff may set how long a video is |
| V1 to V3 | Part B, the publish checklist |
| W1 to W9 | Part A, the certificate |
| X1, X2 | Permissions still tight afterwards |

## Before: 7 passed, 11 FAILED

```
|  1 | pass   | U1 a learner cannot change a video length directly                      | rows changed=0                                             |
|  2 | pass   | U2 a learner cannot change it through the function either               | length is still 600. refused: function lms_set_lesson_dura |
|  3 | FAIL   | U3 a facilitator CAN correct it on a draft course                       | function lms_set_lesson_duration(unknown, integer) does no |
|  4 | pass   | U4 a silly length is refused                                            | refused: function lms_set_lesson_duration(unknown, integer |
|  5 | FAIL   | V1 a course with no programme cannot be published                       | no such item                                               |
|  6 | FAIL   | V2 a lesson with no video is named, not just counted                    | Every video lesson has its video                           |
|  7 | pass   | V3 the good test course has nothing blocking it                         | blockers=0                                                 |
|  8 | pass   | W1 somebody not signed in gets nothing                                  | refused: function lms_claim_course_certificate(unknown) do |
|  9 | FAIL   | W2 no certificate while lessons are unfinished                          | function lms_claim_course_certificate(unknown) does not ex |
| 10 | FAIL   | W3 no certificate while the module quiz is unpassed                     | function lms_claim_course_certificate(unknown) does not ex |
| 11 | FAIL   | W4 a finished course issues a certificate                               | function lms_claim_course_certificate(unknown) does not ex |
| 12 | FAIL   | W5 claiming twice gives the same number and makes no second certificate | function lms_claim_course_certificate(unknown) does not ex |
| 13 | FAIL   | W6 the certificate verifies on the public page                          | name=null programme=null                                   |
| 14 | FAIL   | W7 a withdrawn certificate is NOT quietly reissued                      | function lms_claim_course_certificate(unknown) does not ex |
| 15 | FAIL   | W8 somebody with no access to the course gets nothing                   | function lms_claim_course_certificate(unknown) does not ex |
| 16 | FAIL   | W9 a course with no programme says so plainly                           | function lms_claim_course_certificate(unknown) does not ex |
| 17 | pass   | X1 a visitor who is not signed in cannot reach the length function      | nobody                                                     |
| 18 | pass   | X2 no table grants TRUNCATE, REFERENCES or TRIGGER                      | none                                                       |
+----+--------+-------------------------------------------------------------------------+------------------------------------------------------------+

7 passed, 11 FAILED, out of 18
```

**U1 passes before the fix, and that is the point of it.** It asserts a learner cannot change a
video length directly, which was already true: the rule that allows editing a lesson requires staff.
What was missing was a test saying so. It is here to fail loudly if anybody ever loosens that rule
by accident, not to prove file 13 did something.

**U2 and U4 also pass before**, for a duller reason: the function does not exist yet, so of course a
learner cannot call it. They only become meaningful beside U3, which fails before and passes after.

## After: 18 passed, 0 FAILED

```
|  1 | pass   | U1 a learner cannot change a video length directly                      | rows changed=0                                             |
|  2 | pass   | U2 a learner cannot change it through the function either               | length is still 600. Only a facilitator or the administrat |
|  3 | pass   | U3 a facilitator CAN correct it on a draft course                       | Length changed from 600 to 900 seconds.                    |
|  4 | pass   | U4 a silly length is refused                                            | A length must be between 1 second and 24 hours. Give it in |
|  5 | pass   | V1 a course with no programme cannot be published                       | Has a programme, so a certificate can be issued. Set lms_c |
|  6 | pass   | V2 a lesson with no video is named, not just counted                    | Every video lesson has its video and its length. Still mis |
|  7 | pass   | V3 the good test course has nothing blocking it                         | blockers=0                                                 |
|  8 | pass   | W1 somebody not signed in gets nothing                                  | refused: permission denied for function lms_claim_course_c |
|  9 | pass   | W2 no certificate while lessons are unfinished                          | Not finished yet. You have completed 0 of 2 lessons.       |
| 10 | pass   | W3 no certificate while the module quiz is unpassed                     | Not finished yet. You have passed 0 of 1 module quizzes.   |
| 11 | pass   | W4 a finished course issues a certificate                               | DA-2026-GEN-D38F7D / Congratulations. Your certificate is  |
| 12 | pass   | W5 claiming twice gives the same number and makes no second certificate | same number=true this learner has 1                        |
| 13 | pass   | W6 the certificate verifies on the public page                          | name=Test Learner programme=Data Analytics                 |
| 14 | pass   | W7 a withdrawn certificate is NOT quietly reissued                      | this learner still has 1. A certificate for this was issue |
| 15 | pass   | W8 somebody with no access to the course gets nothing                   | You do not have access to this course.                     |
| 16 | pass   | W9 a course with no programme says so plainly                           | This course has no programme attached, so no certificate c |
| 17 | pass   | X1 a visitor who is not signed in cannot reach the length function      | nobody                                                     |
| 18 | pass   | X2 no table grants TRUNCATE, REFERENCES or TRIGGER                      | none                                                       |
+----+--------+-------------------------------------------------------------------------+------------------------------------------------------------+

18 passed, 0 FAILED, out of 18
```

## The tests worth reading

### U2 and U3, the pair that guards the whole non skippable rule

The correction function is SECURITY DEFINER, which means it runs with the owner's permissions and
the ordinary access rules do not apply to it. **The check inside it is the only thing standing
between a learner and the column that controls the non skippable mechanism.**

U2 proves a learner is refused. U3 proves a facilitator is allowed. If somebody ever removes that
check, U2 fails and nothing else does: the videos still play, the bar still fills, and the rule
quietly stops meaning anything. Neither test should ever be deleted.

### What U2 taught me about draft courses

The first version of U2 called the function as a learner, then read the length back **as the
learner** to check it had not changed. It failed, and the reason is a good one: a learner cannot
even see a lesson on a draft course, so the read returned nothing rather than 600.

Had I written the assertion slightly differently, it would have passed for entirely the wrong
reason. The test now reads the length as the owner.

### W5 and W7, and a bug I accused the function of having

W5 asserts that claiming twice gives the same number and makes no second certificate. The first
version counted **every row in the certificates table** and expected 1. It found 3 and I thought
"safe to call twice" was broken.

It was not. The seed already carries two unrelated certificates, and file 13 had correctly issued
exactly one. The function had found the participant, reused them, and handed back the same number.
The test now counts only certificates belonging to this learner.

Worth recording because the instinct on seeing `certificates=3` was to go and fix the function, and
that would have been fixing something that was already right.

### W6, which proves it is a real certificate

It takes the number file 13 issued and passes it to `verify_certificate`, the function the public
`/verify/:number` page actually calls, transcribed from your live database rather than imagined.

It comes back `found`, not revoked, with the learner's name and the programme title. That is the
test that says the Academy certificate is the same kind of thing as every other certificate, rather
than a parallel system that looks similar.

### W7, a withdrawn certificate

It withdraws the certificate, then finishes the course again, and asserts that no new certificate
appears and the learner is told to get in touch. A function that silently reissued would make the
staff withdraw button a lie.

### V2, naming the lesson rather than counting it

It asserts the checklist says "Still missing: Lesson one" rather than just refusing. This is the
item I had meant to split in two, until the database told me the video and the length always arrive
together.

## No regressions, and three failures that were right

| Suite | Tests | Result |
| --- | --- | --- |
| Original file 10 suite | 43 | 43 passed |
| File 10 outside review suite | 36 | 36 passed |
| File 11 suite | 28 | 28 passed |
| File 12 suite | 52 | 52 passed |
| File 13 suite | 18 | 18 passed |
| **Total** | **177** | **177 passed, 0 failed** |

Getting there took one honest detour. On the first run, three tests in the older suites failed:

```
M17 administrator CAN still publish      | This course is not ready yet
N3  an empty quiz blocks publishing      | blockers=2 -> Has a programme...
N7  once every check has a question...   | blockers left=1
```

Those were not broken tests. They were **the new programme rule working**. Their fixtures created
courses with no programme, which file 13 now refuses to publish, and the fixtures predate the rule.
I gave each fixture a programme, which is what a real course will have.

That is the second time in this project that a deliberate new rule has broken an older fixture, and
the handling is the same both times: change the fixture, say so in writing, and never change the
rule to make a test green.

## Safe to run twice, and the round trip

`13_course_certificates.sql` was applied to a finished database a second time. Clean, no errors,
nothing changed, and no second certificate.

`13_undo.sql` was then applied. It removed both functions and restored the publish checklist, and
**the certificate that had been issued was still there**, which is the behaviour the file promises:
a qualification somebody earned is not removed because we are rolling back code. The file was then
reapplied and the suite returned to 18 passed.

## What is NOT tested here

**The real `make_certificate_number`.** My harness has a stand-in, because that function lives only
on your database. File 13 **calls** the real one rather than reimplementing it, so the format the
stand-in produces does not affect whether file 13 is correct. What is untested is what the real one
does when asked for a number with no module, which is how file 13 calls it. Both existing callers
pass a null module code in some cases, so this is well-trodden ground, but the first real
certificate is the proof.

**The real `participants.email_norm`.** Something on your database fills that column, and I cannot
see what. My harness uses a trigger so the lookup works locally. File 13 inserts a participant the
same way `staff_issue_certificate` does, so if that mechanism were ever broken it would be broken
for the staff console too, not just here.
