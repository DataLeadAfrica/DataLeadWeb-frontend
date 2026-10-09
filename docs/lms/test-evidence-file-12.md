# File 12: tests failing first, then passing

Every test connects as a real `anon` or `authenticated` role, never as the database owner, because a
suite run as the owner bypasses row level security and passes for the wrong reason.

The database under test is built from the real files: the harness, then `01_core.sql` through
`07_quizzes.sql` as they are live, then file 10, then file 11, then a transcription of the live
mailer tables and functions taken from the snapshot. The only difference between the two runs below
is whether `12_email_and_health.sql` has been applied.

## The suite: 51 tests

| Range | What it covers |
| --- | --- |
| P1 to P8 | Part 0, the sign in deadlock |
| P9 to P19 | Part 3, the health check and its token |
| P20 to P23 | Part 5, refusing to delete a question a learner has been given |
| P24, P25 | That the table permissions are still tight afterwards |
| Q1 to Q7 | One identical reply for everybody who asks for a code |
| R1 to R6 | The caller limit, the spoofed header, the ceiling and its boundary |
| S1 to S8 | The Send Email Hook, so Academy email reaches the public at all |

## Before: 13 passed, 36 FAILED

```
|  1 | FAIL   | P1 an enrolled student with no certificate IS sent a code                | codes=0 emails queued=0                                    |
|  2 | pass   | P2 the form says the same thing either way, so it leaks nothing          | returned true                                              |
|  3 | pass   | P3 a complete stranger is sent nothing                                   | codes=0                                                    |
|  4 | pass   | P4 somebody holding a certificate still gets a code                      | codes=1                                                    |
|  5 | pass   | P5 a withdrawn student with no certificate stays out                     | codes=0                                                    |
|  6 | pass   | P6 a revoked certificate alone stays out                                 | codes=0                                                    |
|  7 | FAIL   | P7 the per address limit still bites, now at five attempts               | codes=3                                                    |
|  8 | pass   | P8 a malformed address is ignored quietly                                | returned true                                              |
|  9 | FAIL   | P9 the health check refuses a wrong token                                | function system_health(unknown) does not exist             |
| 10 | FAIL   | P10 the health check answers with the right token                        | function lms_set_health_token(text) does not exist         |
| 11 | FAIL   | P11 there is one OVERALL row the alarm script can read                   | function system_health(unknown) does not exist             |
| 12 | FAIL   | P12 it notices an email stuck in the outbox for 25 minutes               | function system_health(unknown) does not exist             |
| 13 | FAIL   | P13 before the mailer has ever run, that is an alarm                     | function system_health(unknown) does not exist             |
| 14 | FAIL   | P14 once the mailer fetches, the heartbeat is recorded                   | function system_health(unknown) does not exist             |
| 15 | FAIL   | P15 it reports the database size against 500 MB                          | function system_health(unknown) does not exist             |
| 16 | FAIL   | P16 it counts only the unconfirmed sign ups from the last day            | function system_health(unknown) does not exist             |
| 17 | FAIL   | P17 it reports on the scheduled jobs, or says pg_cron is absent          | function system_health(unknown) does not exist             |
| 18 | pass   | P18 a signed in learner is refused even holding the right token          | refused: function system_health(unknown) does not exist    |
| 19 | pass   | P19 a signed in learner CANNOT change the health token                   | refused: function lms_set_health_token(unknown) does not e |
| 20 | FAIL   | P20 a question an attempt has been given CANNOT be deleted               | the delete went through                                    |
| 21 | FAIL   | P21 but it CAN be retired instead                                        | rows retired=0                                             |
| 22 | pass   | P22 a question nobody has been given can still be deleted                | rows deleted=1                                             |
| 23 | FAIL   | P23 not even the administrator can delete a served question              | the delete went through                                    |
| 24 | pass   | P24 no table grants TRUNCATE, REFERENCES or TRIGGER                      | none                                                       |
| 25 | pass   | P25 a visitor who is not signed in holds no write privilege              | none                                                       |
| 26 | FAIL   | Q1 an enrolled student really is sent a code                             | function request_sign_in_code(unknown) does not exist      |
| 27 | FAIL   | Q2 a withdrawn student is sent nothing                                   | function request_sign_in_code(unknown) does not exist      |
| 28 | FAIL   | Q3 enrolled, withdrawn, unknown and graduate all get the IDENTICAL reply | function request_sign_in_code(unknown) does not exist      |
| 29 | FAIL   | Q4 the reply is the agreed wording                                       | function request_sign_in_code(unknown) does not exist      |
| 30 | FAIL   | Q5 only a badly typed address is answered differently                    | function request_sign_in_code(unknown) does not exist      |
| 31 | FAIL   | Q6 the per address limit bites, and says nothing about it                | function request_sign_in_code(unknown) does not exist      |
| 32 | FAIL   | Q7 the per address limit fires for an unenrolled address too             | relation "sign_in_attempts" does not exist                 |
| 33 | FAIL   | R1 the caller is taken from the LAST entry, not the one they claimed     | function sign_in_caller_ip() does not exist                |
| 34 | FAIL   | R2 a faked header on every request does NOT get round the caller limit   | relation "sign_in_attempts" does not exist                 |
| 35 | FAIL   | R3a one short of the ceiling, the code still goes out                    | codes queued=0                                             |
| 36 | FAIL   | R3b at the ceiling, the next one is refused                              | relation "sign_in_attempts" does not exist                 |
| 37 | FAIL   | R3f the hourly ceiling bites on its own, well inside the daily one       | relation "sign_in_attempts" does not exist                 |
| 38 | pass   | R3e nobody from the browser can read or raise the ceiling                | none                                                       |
| 39 | FAIL   | R4 and even at the ceiling the reply gives nothing away                  | function request_sign_in_code(unknown) does not exist      |
| 40 | FAIL   | R5 a missing or broken header does not break sign in                     | function request_sign_in_code(unknown) does not exist      |
| 41 | FAIL   | R6 the log holds no address in the clear, and nobody may read it         | relation "sign_in_attempts" does not exist                 |
| 42 | FAIL   | S1 a sign up confirmation is queued for the mailer to collect            | function send_email_hook(jsonb) does not exist             |
| 43 | FAIL   | S2 a password reset is marked as one, so it gets the right wording       | function send_email_hook(jsonb) does not exist             |
| 44 | FAIL   | S3 a kind of email we have not met is still sent, not dropped            | function send_email_hook(jsonb) does not exist             |
| 45 | FAIL   | S4 a hook call with no code fails loudly instead of sending nothing      | function send_email_hook(jsonb) does not exist             |
| 46 | FAIL   | S5 the hook obeys the same site wide ceiling                             | relation "sign_in_attempts" does not exist                 |
| 47 | pass   | S6 nobody from the browser can call the hook and make us email anybody   | nobody                                                     |
| 48 | FAIL   | S7 the mailer is told the purpose of every row it collects               | TABLE(id uuid, to_email text, code_plain text)             |
| 49 | FAIL   | S8 a row written the old way still counts as a certificate code          | relation "sign_in_attempts" does not exist                 |
+----+--------+--------------------------------------------------------------------------+------------------------------------------------------------+
(49 rows)

+---------------------------------+
|             summary             |
+---------------------------------+

13 passed, 36 FAILED, out of 49
```

### The three failures that matter most

```
P1  an enrolled student with no certificate IS sent a code   | codes=0 emails queued=0
Q3  enrolled, withdrawn, unknown and graduate all get the
    IDENTICAL reply                                          | function does not exist
S7  the mailer is told the purpose of every row it collects   | TABLE(id uuid, to_email text, code_plain text)
```

P1 is the deadlock reproduced: a participant with a live enrolment and no certificate asks for a
code, and nothing is minted and nothing is queued. The function still answers `true`, which is why
the page shows no error.

S7 is the Academy email problem in one line. The mailer is told the address and the code and nothing
else, so it has no way to word a sign up confirmation differently from a certificate code.

### Two honest notes on the "before" column

**P2 passes before the fix and it is not evidence of anything on its own.** It asserts that the form
answers the same either way, which the broken version also did, because answering the same was never
the fault. It becomes load bearing only once the function actually sends something, which P1 proves.

**S6 passes before the fix for a dull reason.** It asserts that nobody from a browser can call the
hook, and before the fix the hook does not exist, so of course they cannot. It is meaningful only
beside S1, which fails before and passes after.

## After: 51 passed, 0 FAILED

```
|  1 | pass   | P1 an enrolled student with no certificate IS sent a code                | codes=1 emails queued=1                                    |
|  2 | pass   | P2 the form says the same thing either way, so it leaks nothing          | returned true                                              |
|  3 | pass   | P3 a complete stranger is sent nothing                                   | codes=0                                                    |
|  4 | pass   | P4 somebody holding a certificate still gets a code                      | codes=1                                                    |
|  5 | pass   | P5 a withdrawn student with no certificate stays out                     | codes=0                                                    |
|  6 | pass   | P6 a revoked certificate alone stays out                                 | codes=0                                                    |
|  7 | pass   | P7 the per address limit still bites, now at five attempts               | codes=5                                                    |
|  8 | pass   | P8 a malformed address is ignored quietly                                | returned true                                              |
|  9 | pass   | P9 the health check refuses a wrong token                                | rows saying the token was rejected=1                       |
| 10 | pass   | P10 the health check answers with the right token                        | rows=8                                                     |
| 11 | pass   | P11 there is one OVERALL row the alarm script can read                   | severity=alarm value=7 checks, 1 alarm, 1 warn             |
| 12 | pass   | P12 it notices an email stuck in the outbox for 25 minutes               | severity=alarm value=25.0 minutes                          |
| 13 | pass   | P13 before the mailer has ever run, that is an alarm                     | severity=alarm value=never recorded                        |
| 14 | pass   | P14 once the mailer fetches, the heartbeat is recorded                   | severity=ok value=0.0 minutes ago                          |
| 15 | pass   | P15 it reports the database size against 500 MB                          | value=9847 kB of 500 MB (1.9 percent)                      |
| 16 | pass   | P16 it counts only the unconfirmed sign ups from the last day            | value=2 (3 exist, one is 40 hours old)                     |
| 17 | pass   | P17 it reports on the scheduled jobs, or says pg_cron is absent          | rows about scheduled jobs=1                                |
| 18 | pass   | P18 a signed in learner is refused even holding the right token          | rows back=1, refusal rows=1                                |
| 19 | pass   | P19 a signed in learner CANNOT change the health token                   | refused: Only the administrator can set the health token.  |
| 20 | pass   | P20 a question an attempt has been given CANNOT be deleted               | refused: This question has already been given to a learner |
| 21 | pass   | P21 but it CAN be retired instead                                        | rows retired=1                                             |
| 22 | pass   | P22 a question nobody has been given can still be deleted                | rows deleted=1                                             |
| 23 | pass   | P23 not even the administrator can delete a served question              | refused: This question has already been given to a learner |
| 24 | pass   | P24 no table grants TRUNCATE, REFERENCES or TRIGGER                      | none                                                       |
| 25 | pass   | P25 a visitor who is not signed in holds no write privilege              | none                                                       |
| 26 | pass   | Q1 an enrolled student really is sent a code                             | queued=1                                                   |
| 27 | pass   | Q2 a withdrawn student is sent nothing                                   | queued=0                                                   |
| 28 | pass   | Q3 enrolled, withdrawn, unknown and graduate all get the IDENTICAL reply | identical: If you are enrolled, your code arrives within   |
| 29 | pass   | Q4 the reply is the agreed wording                                       | If you are enrolled, your code arrives within 5 minutes. N |
| 30 | pass   | Q5 only a badly typed address is answered differently                    | status=bad_email                                           |
| 31 | pass   | Q6 the per address limit bites, and says nothing about it                | codes queued=5, reply unchanged                            |
| 32 | pass   | Q7 the per address limit fires for an unenrolled address too             | rate limited attempts=3                                    |
| 33 | pass   | R1 the caller is taken from the LAST entry, not the one they claimed     | read as 41.58.9.9                                          |
| 34 | pass   | R2 a faked header on every request does NOT get round the caller limit   | refused by the caller limit=5                              |
| 35 | pass   | R3a one short of the ceiling, the code still goes out                    | codes queued=1                                             |
| 36 | pass   | R3b at the ceiling, the next one is refused                              | codes queued=1 refused by the ceiling=1                    |
| 37 | pass   | R3f the hourly ceiling bites on its own, well inside the daily one       | codes queued=0 refused=1                                   |
| 38 | pass   | R3c raising the ceiling in mail_limits lifts it immediately              | queued before=0 after=1                                    |
| 39 | pass   | R3d with the settings row gone it falls back to a limit, not to none     | per hour=25 per day=80                                     |
| 40 | pass   | R3e nobody from the browser can read or raise the ceiling                | none                                                       |
| 41 | pass   | R4 and even at the ceiling the reply gives nothing away                  | If you are enrolled, your code arrives within              |
| 42 | pass   | R5 a missing or broken header does not break sign in                     | queued=1                                                   |
| 43 | pass   | R6 the log holds no address in the clear, and nobody may read it         | no privileges, addresses in the clear=0                    |
| 44 | pass   | S1 a sign up confirmation is queued for the mailer to collect            | purpose=academy_signup to=newlearner@gmail.com             |
| 45 | pass   | S2 a password reset is marked as one, so it gets the right wording       | purpose=academy_recovery                                   |
| 46 | pass   | S3 a kind of email we have not met is still sent, not dropped            | purpose=academy_other                                      |
| 47 | pass   | S4 a hook call with no code fails loudly instead of sending nothing      | answered {"error": {"message": "The email could not be pre |
| 48 | pass   | S5 the hook obeys the same site wide ceiling                             | answered {"error": {"message": "Too many emails have been  |
| 49 | pass   | S6 nobody from the browser can call the hook and make us email anybody   | nobody                                                     |
| 50 | pass   | S7 the mailer is told the purpose of every row it collects               | TABLE(id uuid, to_email text, code_plain text, purpose tex |
| 51 | pass   | S8 a row written the old way still counts as a certificate code          | purpose=certificate_code                                   |
+----+--------+--------------------------------------------------------------------------+------------------------------------------------------------+
(51 rows)

+--------------------------------+

51 passed, 0 FAILED, out of 51
```

## The tests worth reading

### Q3, the one I would keep if I could keep only one

It asks four different people for a code, in one go: an enrolled student, a withdrawn one, an
address that has never been a participant, and somebody who has already graduated. It then asserts
that all four answers are **identical as whole objects**, not merely that the sentences match.

That object is what the browser receives, and anybody can open their developer tools and read it. So
a hidden status that differed would leak exactly what the wording exists to hide. Comparing the
whole object is what makes the test meaningful rather than cosmetic.

If a future change makes any of the four differ, Q3 fails and says `DIFFERENT, the page is an
oracle`.

### Q7, and why the limit counts tries rather than codes

The per-address limit fires after 5 **attempts**, not 5 codes. That distinction is the whole point
and it is easy to get wrong.

If it counted codes, then hitting the limit could only ever happen to an address that was being sent
codes, so hitting it would itself prove the address is enrolled. The limit would become the very
oracle the identical wording closes. Q7 makes eight requests for a **withdrawn** address, which
never receives a code, and asserts that the limit fires anyway.

This did change behaviour, and the change is visible in the suite: the old P7 expected the previous
limit of 3 codes in 15 minutes and now expects 5 attempts. That is a deliberate loosening of the
number alongside a tightening of what it counts, because a person who mistypes their address once
should not burn a third of their allowance.

### R1 and R2, the bug I shipped an hour ago

`x-forwarded-for` grows from the left: every relay appends what it saw. So the first entry is
whatever the caller claimed and the last is what the nearest relay actually saw. **The version I
sent you read the first entry**, which made the limit worthless.

R1 feeds in `"1.2.3.4, 41.58.9.9"` and asserts the function reads `41.58.9.9`.

R2 is the real proof. It fires twenty requests, each with a **different invented first entry** and
the same real last entry, and asserts that the caller limit still catches them. Against the version
I sent, that test fails: twenty requests all get through.

### R3a to R3f, the backstop and its boundary

The ceiling is **25 codes an hour and 80 a day**, because Google allows this account 100 a day and
hitting Google's own limit stops all sending for up to 24 hours with no warning. Six tests:

- **R3a** pre-loads one short of the daily ceiling and asserts the next code still goes out. A
  limit that fires early is as much a fault as one that never fires.
- **R3b** then asks for one more and asserts it is refused.
- **R3f** does the same for the hourly ceiling, proving it bites on its own well inside the daily
  one, so one bad hour cannot eat the whole day in one go.
- **R3c** raises the numbers in `mail_limits` mid-test and asserts the refusal lifts immediately.
  That is what makes moving the mailer to an account with a bigger allowance one UPDATE rather than
  a new SQL file.
- **R3d** deletes the settings row and asserts the functions fall back to 25 and 80 rather than to
  no limit at all. "No limit" is the failure that empties the day's quota.
- **R3e** asserts nobody from a browser can read or raise the ceiling.

**R3a caught a real mistake in my own fixture.** The first version pre-loaded all 79 records at two
minutes ago, which trips the **hourly** ceiling of 25, not the daily one of 80. The test failed with
`codes queued=0` and the fixture was probing the wrong limit entirely. It now spreads them across
the past day. That is why R3f exists: the accident showed the hourly ceiling deserved a test of its
own.

R4 asks for another at the ceiling and asserts the reply is still the one shared sentence. Being
refused by the ceiling has to be indistinguishable from being sent a code, for the same reason the
rate limit does.

### S4 and S5, failing loudly on purpose

S4 calls the hook with no code in it and asserts that it returns an **error** rather than quietly
doing nothing. S5 does the same at the site ceiling.

Both are the opposite of what one would normally want from a hook. The reasoning: the hook runs
inside the moment the account is created, so returning an error makes the sign up fail and the
person sees it. A sign up that appears to work and sends no email is the exact fault this entire
file exists to remove, and reintroducing it in a new place would be a poor trade for a tidier log.

### S8, not mis-sending what is already queued

Every row in the outbox used to be a certificate code. S8 writes a row the old way, with nothing in
the new purpose column, and asserts it still reads as a certificate code, so nothing sitting in the
queue when this file runs is sent out with the wrong wording.

## Mistakes the suite caught, both mine

**Four tests failed after the fix with `permission denied for table sign_in_attempts`.** That was
not the code. My own fixtures were setting themselves up by writing to the attempt log while
connected as `anon`, and `anon` is deliberately not allowed near it. The functions write to it as
their own definer, which is why Q1 to Q5 passed throughout. The fixtures now build their starting
position as the owner and switch to `anon` for the call itself.

**R1 failed for the same reason**, because `sign_in_caller_ip()` is revoked from `anon` too.

That is the fifth time in this project that connecting as the real role has caught something a suite
run as the owner would have sailed straight past. It is the single most valuable convention here.

## No regressions

| Suite | Tests | Result |
| --- | --- | --- |
| Original file 10 suite | 43 | 43 passed, 0 failed |
| File 10 outside review suite | 36 | 36 passed, 0 failed |
| File 11 suite | 28 | 28 passed, 0 failed |
| File 12 suite | 51 | 51 passed, 0 failed |
| **Total** | **158** | **158 passed, 0 failed** |

One of the 28 needed changing, and it is worth saying why rather than quietly editing it. A file 11
test set itself up by deleting a question that an attempt had been given, to prove that marking an
attempt with nothing to mark is refused. File 12's new rule forbids exactly that delete, so the
fixture could no longer build its own starting position. It now inserts an attempt whose frozen
question list points at an identifier that was never a question, which is the same broken state a
pre-file-12 delete would have left. The thing being tested did not change, only how the broken state
is created.

## Safe to run twice, and the round trip

`12_email_and_health.sql` was applied to a finished database a second time. Clean, no errors,
nothing changed.

That mattered more than usual here, because this file **drops and recreates**
`mail_fetch_pending` rather than replacing it: PostgreSQL will not change the result shape of a live
function, and the function now returns one more column. Two consequences were checked:

- The drop and create are wrapped in a single transaction, so the function is never missing, not
  even for an instant.
- Step 0 accepts **either** shape, the three column one that is live today or the four column one
  this file leaves behind. Without that, a second run would stop at step 0 complaining about a
  database this very file had produced.

`12_undo.sql` was then applied and the file reapplied. The undo restored `mail_fetch_pending` to
exactly `TABLE(id uuid, to_email text, code_plain text)`, `request_certificate_code` still answered,
and the suite returned to 51 passed after the second application.

## What `12_verify.sql` reports

```
 01 an enrolled student with no certificate can now ask for a code (part 0) | yes
 02 the page that is live today still works unchanged (part 0)              | yes
 02b every caller gets the SAME reply, so the page is not an oracle         | yes
 02c the reply is the agreed wording                                        | yes
 02d the caller is read from the LAST x-forwarded-for entry, not the first  | yes
 02e there is a site wide ceiling that cannot be faked                      | yes
 02f nobody but the functions can reach the attempt log                     | yes
 02g the Send Email Hook function exists (part 1)                           | yes
 02h only Supabase Auth may call the hook, nobody from a browser            | yes
 02i the outbox records what kind of email each row is                      | yes
 03 the health token table exists and is locked down (part 2)               | yes
 04 the health token has actually been set (part 2)                         | NO, not yet
 05 the health check function exists (part 2)                               | yes
 06 there is somewhere to record that the mailer ran (part 2)               | yes
 07 the mailer records when it collects the post (part 2)                   | yes
 08 the mailer has called in at least once (part 2, the data)               | not yet
 09 a question a learner has been given cannot be deleted (part 5)          | yes
 10 no attempt points at a question that is gone (part 5, the data)         | yes
 11 no table grants TRUNCATE, REFERENCES or TRIGGER                         | yes
 12 a visitor who is not signed in holds no write privilege                 | yes
```

Two rows deliberately do not say yes straight away, and both are honest rather than broken.

**Row 04 says NO until you set the health token.** The file cannot invent it, because a secret
generated inside a committed file is not a secret. The row prints the exact statement to run.

**Row 08 says "not yet" until the mailer next collects.** On your live database that should flip
within a minute, because the mailer runs every minute. If it still says "not yet" an hour later, the
mailer is not running, which is precisely what the health check was built to reveal.

## The frontend

The four changed files type check cleanly under `tsc --strict` against React 18 types. That is a
check of the files, not of your build: I do not have the rest of your repository, so the imports
they share with it were stubbed. The Vercel preview is the real check.

## What is NOT tested here, and should be checked on the live project

**That `x-forwarded-for` actually arrives.** Everything above feeds the header in by hand, which
proves the function reads it correctly but not that Supabase passes it. Verify row 02d checks the
code is right, not that the data turns up. Only a real request through the website proves that, and
if it does not arrive the caller limit simply never fires, which is why the unfakeable site ceiling
exists rather than being an extra.

**That the hook is wired up.** The function is tested by calling it the way Supabase would. Whether
the dashboard is actually pointing at it is a setting, not code, and only a real sign up proves it.
