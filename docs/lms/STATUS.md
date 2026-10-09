# Data-Lead Academy: status

Last updated 8 October 2026, after file 13 was run on the live database. **The database layer is
finished.** From here the work is the website.

## Where we are in one paragraph

The Academy is a database and nothing else. Seventeen tables, more than thirty Academy functions,
twenty nine row level security policies and one view are live in the certification Supabase
project, and they have been checked object by object against a snapshot of the real database. Not
one page on the website calls any of them. The biggest remaining piece of work, the part a learner
would actually touch, has not been started.

**File 10 was run on the live database on 6 October 2026**, and `10_verify.sql` answered yes on all
twenty rows. Access now follows the two email lists, only the administrator publishes, and the
table permissions are tightened.

**File 11 was run on the live database on 7 October 2026**, and `11_verify.sql` answered yes on all
seventeen rows. `lms_storage_report()` shows the whole database at **15 MB, which is 3 percent of
the 500 MB the free plan allows**. Storage is therefore not a constraint we are anywhere near, and
the housekeeping now keeps it that way as learners finish courses. Its three files have moved out of
`not-yet-run/` into `database/lms/`.

**File 12 was run on the live database on 7 October 2026**, and `12_verify.sql` answered yes on all
twenty one rows, including the health token. One fault showed up afterwards and is fixed: see the
first decisions block below, and re-run `12_email_and_health.sql` to pick it up. The **Send Email hook is switched on** in the
dashboard, pointing at `public.send_email_hook`. Its three files have moved out of `not-yet-run/`
into `database/lms/`.

So the sign in deadlock is fixed, the form gives the same reply to everybody, Academy email now
routes through the existing outbox and mailer, the health check exists, and a question a learner has
been given can no longer be hard deleted.

**What is left on email is the Apps Script side, and one piece of it is live and wrong.** The hook
is on, so Academy sign up codes are being written into the outbox now. The mailer script deployed
today is the old one, which does not read the new `purpose` column, so those codes go out worded
"Your Data-Lead Africa certificate code". Nothing is broken and nobody is locked out, but the
wording is wrong until `scripts/lms/mailer.gs` is pasted in. That is the next thing to do.

**File 13 was run on the live database on 8 October 2026**, and `13_verify.sql` answered yes on all
twelve rows, including row 11, which reports no course blocked for want of a programme. Finishing an
Academy course now issues a certificate through the course's programme, using the numbering the
staff console already uses, so `/verify/:number` works for it with no change. A learner cannot set
how long a video is, which is the number the non skippable rule is a percentage of.

**That completes the database.** Files 01 to 07, 10, 11, 12 and 13 are all applied, with 177 tests
behind them across five suites. Nothing else is waiting to be run.

## What the Academy is meant to be

A self paced course platform at **/lms** on dataleadafrica.com, selling single tool courses rather
than bundled bootcamps. Somebody buys STATA, or SQL, or Power BI on its own at around NGN 10,000,
works through it alone, and gets a certificate at the end.

A course holds modules; a module holds lessons. A video lesson plays a YouTube video inside the page
and cannot be skipped on a first pass: the server records which ten second slices of the video it
has actually seen, and the next lesson stays shut until coverage passes the lesson's threshold.
After the video comes a short set of questions. Pass those and the next lesson opens.

Access comes from one of three places, and one table decides it:

1. A confirmed email on an active bootcamp enrolment gets the whole catalogue at no cost.
2. Any course priced at zero is open to anybody with a confirmed account.
3. Everything else is bought one course at a time through Paystack.

## Constraints we work inside

| Constraint | What it means in practice |
| --- | --- |
| No terminal, GitHub website only | Every change arrives as a complete file to paste, never a patch or a diff |
| Claude cannot push | Files are handed over as downloads; a human uploads them |
| Never edit main directly | New branch, Vercel preview, test, then merge |
| Supabase free plan | Storage and egress have to stay modest. Video lives on YouTube, which keeps it out of Supabase entirely. Measured at 15 MB of 500 MB on 7 October 2026 |
| A free project pauses after about a week of no traffic | The daily alarm call in `scripts/lms/alarm.gs` is outside traffic, so it prevents this as a side effect |
| No environment variables | Configuration sits in a single committed file, and only publishable keys ever appear in the browser |
| Two Supabase projects on the plan | The Academy adds none; it lives in the certification project. Note that the repository currently references three project URLs, which is worth checking |
| Email must go through our own sender | Supabase's built-in service is two an hour, to the project team only. See `EMAIL-SETUP.md` |
| Must survive my absence | Nothing may depend on one person's memory. This file, `database/lms/README.md` and `EMAIL-SETUP.md` exist for that reason |
| Plain CSS, one file per component | No Tailwind |

## Decisions log

| Decision | Why |
| --- | --- |
| Video on YouTube, unlisted, played in the page | Google storage is already paid for, and it keeps video out of Supabase egress |
| A provider column plus a reference column, never a full URL | The host can change without a migration |
| The non skippable rule is measured on the server, in ten second slices | The browser belongs to the learner, so anything enforced there can be bypassed. Server recorded coverage is the only version that means anything |
| Slice size and required coverage are stored per lesson | Changing them later does not silently invalidate slices already recorded |
| Unlock and marking are database functions, not component logic | One place to change, and a rule the browser cannot route around |
| One table, `lms_entitlements`, decides all access | Orders and enrolments are reasons, not grants. A null course means the whole catalogue, so a bootcamp student needs one row rather than one per course |
| Money is an integer in kobo | Never a float, never a decimal string |
| Free means `price_kobo = 0`, not a separate flag | One source of truth |
| `lms_payment_events` with provider plus event id unique | Paystack sends the same event more than once, and the unique constraint is what makes a repeat harmless instead of a double grant |
| Counts and hours are never stored | They are counted from rows in `lms_course_cards`, so a typed number can never disagree with reality |
| An Academy course carries a `programme_id` | The existing certificate numbering and the /verify page keep working with no change |
| Every Academy table starts with `lms_` | Six names would otherwise have collided with the certification tables |
| Supabase Auth, email and password, confirmation on | Every right hangs on a proven email address, so confirmation has to be real |
| The Student ID box was scrapped | Nothing typed in means nothing to guess at and nothing to leak |
| Rights follow from whether a confirmed email is on a list, checked at every sign in, in both directions | When somebody leaves, taking them off the list is the whole job |
| Facilitators build, only the administrator publishes | Nothing reaches a learner without a second pair of eyes |
| Administrator can only be granted by a statement in the SQL editor | If the website could do it, that would be the way in. It doubles as the recovery route |
| A lesson check reports counts only, never a score | It exists to make the lesson stick, not to judge anybody |
| `is_correct` never leaves the server, and marking happens in a function | The answer key is not in the page to be read |
| The served questions are frozen on the attempt row | Marking cannot be gamed by editing the question bank mid attempt |
| Supabase, not Google Sheets, holds the data | A Sheet has one file level permission, no password hashing, no transactions, and an Apps Script quota a cohort of forty would exceed |
| The Sheets archive was deferred | Deleting spent watch slices solves the storage worry without a second system to keep alive |
| Tests connect as real roles and assert the denials | A policy suite where everything passes first time usually means the tests are not connecting as the right role |

### Added at version 2, after the outside review of 6 October 2026

| Decision | Why |
| --- | --- |
| A bootcamp pass can be renewed, not only granted and revoked | Version 1 left the expiry date alone when a pass already existed, so a student returning for a second cohort held a pass whose date had passed, could not be given a new one because only one live pass is allowed, and was told nothing had changed. The same happened whenever a cohort was extended |
| The renew only writes when the date actually differs | So the check is cheap enough to run on every page open, not just at sign in |
| Seven guard triggers, not wider policies | A policy can say which rows you may touch. It cannot say which columns, and it cannot say "only while this is still a draft". Publishing, pricing, deleting and editing live material are exactly those two shapes, so they are triggers |
| A session with nobody signed in is trusted by the guards | That is the Supabase SQL editor, which only the administrator can reach, and the nightly sweep. Without the exception nothing could be fixed by hand |
| Importing questions retires them instead of deleting them | Deleting broke the frozen question list on a part finished attempt, so a learner mid attempt was marked out of nothing and told they had passed, and past attempts lost the questions they were marked against |
| New questions are numbered above the highest position already in use | Position is unique per quiz and retired questions keep theirs, so new ones must not collide |
| A live set of questions can only be changed by the administrator | Changing questions under somebody who is sitting them is not a small thing |
| A nightly sweep, as well as the check at sign in | Supabase keeps people signed in for weeks, so a withdrawn student would otherwise keep free access until they happened to sign in again |
| The sweep is scheduled only if pg_cron is installed, and says so if not | The file cannot turn an extension on, and failing silently would be worse than a notice |
| TRUNCATE, REFERENCES and TRIGGER taken away from everyone on Academy tables | Nobody needs them, and row level security never filters TRUNCATE at all |
| A visitor who is not signed in keeps SELECT and loses every write | A visitor never writes. Reading is what the shop window needs |
| Default privileges for the whole public schema left alone | The certification system shares that schema. The cost is that a new Academy table arrives with the wide default, so `lms_tidy_table_privileges()` exists to tidy it |
| The undo does not put TRUNCATE back | Restoring a flaw is not undoing. There is a commented block in the undo file for anyone who insists |

### Added at file 11, 6 October 2026

| Decision | Why |
| --- | --- |
| An attempt with nothing to mark is left in progress and refused, not failed | Zero right out of zero read as "all of them", so a lesson check told the learner "All 0 correct. On you go." while stamping the attempt as failed and using up one of their tries |
| The pass test itself requires that marks were on offer | Belt and braces. Even if something else goes wrong, no marks can never be a pass |
| An empty set of questions blocks its whole course from publishing, not just itself | A learner cannot start an empty set, and a lesson is not finished until its questions are passed, so one empty set strands them at that lesson forever |
| That blocker counts DRAFT empty sets too | The literal rule asked for, and it forces the tidy-up before a paid course goes live. The reason names the offending sets so nobody has to guess |
| The empty-set rule applies to the administrator as well | An empty live quiz is a mistake whoever makes it. This is the one guard with no administrator exception |
| An already-live empty set is reported, never fixed automatically | The only automatic fixes would be unpublishing content learners can see, or inventing questions |
| Watch slices are deleted when a lesson is completed, by a trigger, with the coverage figure kept on the progress row | They are the bulk of the data and serve no purpose after completion. A trigger needs no scheduler and cannot drift |
| The lesson check pass was moved onto the progress row BEFORE any attempt was deleted, and the completion rule switched to read it | Completion used to be decided by looking for a passed attempt. Deleting attempts first would have locked learners out of lessons they had already finished, with no way back but a backup |
| Chosen over keeping the latest passed attempt | Keeping one attempt would have left the completion rule still reading the attempts table, so the trap would still be there for whoever next writes a cleanup. This removes the trap instead of working around it |
| Module quiz attempts are never deleted | They are the real assessment record. Only the light lesson checks go |
| The ninety day prune works per learner per lesson, on the newest slice | So somebody slowly working through a long video does not lose the beginning while they are still going |
| The storage report allows a session with no signed in user | So it can be run in the SQL editor. A signed in learner is refused |

### Added at file 12, 7 October 2026

| Decision | Why |
| --- | --- |
| `request_certificate_code` now opens for an active enrolment as well as a certificate | Holding a certificate is the END of the journey and the portal is needed in the MIDDLE of it. Every current cohort participant was locked out, and the function answered success either way, so the page showed no error and nothing recorded that a person had been turned away |
| The gate was widened, not removed | A stranger, a withdrawn student and somebody holding only a revoked certificate still get nothing, the form still answers identically whoever asks, and the three in fifteen minutes limit still applies. Five tests assert exactly that, because widening a gate is the change most likely to widen it to everybody |
| The undo file deliberately does NOT revert the sign in fix | Putting the old version back would lock out every enrolled participant with no certificate, which is the whole fault. The undo says so and carries a commented query counting who it would shut out |
| ~~Custom SMTP through Google Workspace, by app password on an existing licensed account with `no-reply@` as an alias~~ **Superseded the same day:** email goes through the Send Email Hook and the existing Apps Script mailer instead, so there is no SMTP at all. Kept here because the reasoning against the relay still holds if SMTP is ever revisited | The Workspace SMTP relay normally locks to a list of sending IP addresses, and Supabase gives no fixed outbound address on the free plan, so that route either fails or breaks silently when their infrastructure moves. Its authenticated route needs credentials anyway. An app password also fails better: one revocation on one account, nothing else touched. The alias avoids paying for a licence |
| ~~`no-reply@dataleadafrica.com` rather than `academy@`, forwarded to a real mailbox~~ **Superseded:** the sender is `datalead.a.info@gmail.com`. The point about `academy@` staying a mailbox a learner can write to still stands | `academy@` should stay a mailbox a learner can write to. A machine sender should say so in its name. Forwarding it stops it being a dead end, because people reply regardless |
| The Auth email rate limit is set to 150 an hour, not removed | Supabase now imposes its own 30 an hour once custom SMTP is on, which a launch day would hit. 150 is well inside Gmail's daily allowance while still capping a runaway loop before it empties the quota |
| A hashed token guards the health check, in the same pattern as `mailer_token` | The caller is a Google script, not a signed in person, so it cannot prove who it is in the usual way. Only the scrambled form is stored, so reading the table tells you nothing |
| A wrong token answers with one row saying so, rather than simply refusing | A wrong token means the alarm is blind, and blindness should be noisy. The alarm script treats that row as an alarm in its own right |
| A signed in non-administrator is refused whatever token they hold | So a learner who somehow got hold of the token still cannot read how many people signed up yesterday |
| `system_health` returns an `OVERALL` row carrying the worst severity found | The alarm script then needs to read one line to decide whether to email, rather than understanding all five checks |
| One line was added to `mail_fetch_pending` and the rest copied letter for letter | It is the function the live sign in depends on. Step 0 checks the exact signature and result shape before replacing anything, and stops without changing a thing if they differ |
| The alarm sends one "all good" note every Monday as well as alarms | An alarm that only speaks when something is wrong is indistinguishable from an alarm that has died, and you would find out which by having an outage nobody reported. One email a week is the price of knowing it is alive |
| The alarm script is owned by a Workspace account with edit access shared to a second person, never a personal Gmail | A monitoring script owned by one individual dies quietly with that individual's login |
| The health token lives in Script Properties, never in the code or a Sheet | Code gets copied and pasted into chats. Sheets get shared by link and links get forwarded |
| The daily alarm call doubles as traffic that stops the free project pausing | A paused project is woken by hand, and you would discover the need when a learner could not sign in. One outside call a day removes that failure as a side effect of monitoring |
| Hard deleting a question an attempt has been given is refused, with no administrator exception | The damage is not to a setting that can be put back. It is to a person's record of what they were asked, and no authority can reconstruct that. Retiring achieves everything deleting would except the destruction, and the error message says so |
| The mailer token is rotated with a deliberate short gap rather than a dual-token scheme | Codes are written to the outbox the instant they are asked for, so during the gap they queue rather than vanish, and go out on the next collection. An uncollected code is only deleted after an hour, so finishing inside the hour costs nobody anything. Changing `mailer_token_ok` to accept two tokens is not worth it for a one minute window |

### Added at file 13, 8 October 2026

| Decision | Why |
| --- | --- |
| A certificate is issued by calling `make_certificate_number`, not by a second copy of the numbering | There should be exactly one place in the system that decides what a certificate number looks like. The staff console and the bootcamp assessment already call it |
| An Academy certificate is the same kind of row as every other one | Same table, same numbering, same public check page, issued through the course's programme. `/verify/:number` needed no change at all |
| Claiming twice returns the same number | The page may call it on every visit to the last lesson. It looks for an existing certificate first |
| A withdrawn certificate is never quietly reissued | Withdrawing one is a deliberate act by a person, usually for a serious reason. A function that silently reversed it would make the staff withdraw button a lie. It stops and says to get in touch |
| Lesson checks are not counted towards finishing | A lesson is not marked complete until its check is passed, so they are already counted once. Counting them twice would strand a learner who passed a check before a rule changed |
| **A course must have a programme before it can be published** | Without one there is nothing to issue a certificate against, so a learner would finish a paid course and find there is none. Better to refuse at publishing time. Three older test fixtures failed when this landed, correctly: they predated the rule and were given a programme |
| `lms_set_lesson_duration` is the only way a page may correct a video's length, and it refuses anybody who is not staff | Coverage is a percentage of `duration_seconds`, so whoever writes that number controls the non skippable rule. Set a two hour video to 10 seconds and one slice is the whole course |
| That check is named in the file as the single point of failure, and guarded by two tests | The function is SECURITY DEFINER, so the ordinary access rules do not apply to it. If the check is ever removed nothing visible breaks: videos still play, the bar still fills, and the rule quietly stops meaning anything. Tests U2 and U3 must never be deleted |
| The undo file does NOT remove certificates already issued | Somebody finished a course and was given a qualification, and the /verify link may already be with an employer. Taking it back because we are rolling back code would be dishonest. Withdrawing one is the staff console's job, which records a reason |
| The publish checklist names the lessons that are not filled in | An attempt to split "has its video" into two items found that the table requires provider, reference and length together or all three empty, so the two would always fire together. What was missing was which lessons |

### Fixed after the first live alarm, 7 October 2026

| Decision | Why |
| --- | --- |
| `delete from _h` became `delete from _h where true` in `system_health` | Supabase refuses any delete or update without a where clause on anything arriving through the API, as error 21000. The bare delete made every health check return 400, so the alarm reported the database as unreachable about an hour after file 12 went live. Nothing else was affected: `system_health` only reads, and nothing a learner does depends on it |
| A static test now checks every stored function for a bare delete or update | The local harness has no such protection, so the suite could not reproduce it by calling the function: it passed locally and failed on the live site. The static check reads the function bodies instead. It is weaker than a live reproduction and catches the whole class before it ships |
| The alarm now tells an outage apart from a broken call | It reported "database unreachable" for a 400 that proved the database was up and answering. A wrong diagnosis sends somebody hunting a fault that is not there. It now distinguishes nothing answering, a refused key, a server error, and a call that failed, and says plainly when learner facing things are probably unaffected |

### Revised at file 12 after the outside review of 7 October 2026

| Decision | Why |
| --- | --- |
| **Reversed:** the form does NOT tell a person they are not enrolled. One identical sentence for every outcome | An earlier draft told them, which was friendlier and wrong. The moment the reply differs, anybody can type addresses in and learn who is on a cohort. On the certificate claim page it is worse, because there the gate is holding a certificate, so an honest reply would answer "has this person graduated?" |
| The agreed wording is honest without being an oracle | "If you are enrolled, your code arrives within 5 minutes. Nothing yet? Check spam or contact us." It tells the person what to expect and what to do, and nothing about themselves. The person who most needed telling, the one not enrolled, is told to contact us |
| The hidden status is identical too, not just the sentence | The browser receives the whole answer and anybody can read it in developer tools, so a status that differed would leak exactly what the wording hides. Every outcome reads 'accepted' |
| The rate limit counts ATTEMPTS, not codes | If it counted codes, hitting the limit could only happen to an address being sent codes, so hitting it would prove the address is enrolled. The limit would become the oracle the wording closes. Counting attempts makes it fire the same way for everybody |
| Accepted cost: a rate limited learner is told a code is coming when it is not | The same shape as the original deadlock, so it is not glossed over. Two things make it acceptable: the sentence tells them to contact us, which the original did not, and the health check now reports both counters so it is visible rather than waiting for a complaint |
| **Bug fixed:** the caller is read from the LAST x-forwarded-for entry, not the first | The list grows from the left, so the first entry is whatever the caller claimed and the last is what the nearest proxy saw. The version shipped an hour earlier read the first, which made the limit worthless: a different invented header each request and it never bites. Test R2 fires twenty spoofed requests and proves it now catches them |
| A site wide ceiling, held in the `mail_limits` table rather than in code, as the backstop | A header is a claim, not a fact, and we do not control the proxy chain in front of Supabase. The ceiling counts rows the server wrote, so nothing a caller sends can reach it |
| Accepted cost: a flood can use the ceiling up and real learners then wait | The lesser of two harms. The alternative is spending the day's Gmail allowance, and Google stops the account sending for a full 24 hours when that runs out. An hour of waiting beats a day of silence |
| The attempt log stores a hash of the address, never the address, and keeps the network address 24 hours | Counting works just as well on a hash. The only purpose is abuse prevention, so the retention is as short as that purpose allows |
| **Reversed:** the Send Email Hook is a Postgres function, not an Apps Script HTTP endpoint | Three separate fatal problems with the endpoint: Apps Script doPost cannot read request headers so it cannot verify the signature that proves the call came from Supabase, which makes it a way for a stranger to make the site email anybody; an HTTP hook must answer within 5 seconds; and an Apps Script web app answers with a redirect a webhook caller may read as failure |
| The hook writes into the existing mail_outbox | One sender, one script, one place to change wording, and the file 12 alarm watches Academy email for free because it watches the outbox. A learner waits under 2 minutes, because the mailer trigger runs every minute |
| mail_outbox gained a purpose column and mail_fetch_pending returns it | Every row used to be a certificate code, so the mailer could assume the wording. Without this a person confirming a new Academy account receives an email about a certificate |
| A row with no purpose is treated as a certificate code | So nothing already sitting in the queue when file 12 runs is sent out worded wrongly |
| mail_fetch_pending is dropped and recreated inside one transaction, and step 0 accepts either shape | PostgreSQL will not change the result shape of a live function. The transaction means it is never missing even for an instant; accepting both shapes is what keeps the file safe to run twice |
| The hook returns an error rather than failing quietly | It runs inside the moment the account is created, so an error makes the sign up fail and the person sees it. A sign up that appears to work and sends no email is the exact fault this file exists to remove |
| Sender is datalead.a.info@gmail.com | Asked for directly. Apps Script always sends as the account that owns the script, so if that project is owned by this address there is nothing to set up; if not, it has to be added under Send mail as. The script works out which and `checkSenderReady()` reports it, because without the verification every email silently goes out from the owning account and you would find out from a learner |
| A gmail.com sender means SPF, DKIM and DMARC are not needed for these emails | Those records say which servers may send as OUR domain. Mail from a gmail.com address is not sent as our domain, and Google already signs gmail.com. This removes the slowest step, the DNS wait, from going live. The cost is a slightly weaker signal to spam filters, since nothing ties the sender to the site, which the test checklist is there to confirm rather than assume |
| `checkSenderReady()` prints the real daily allowance rather than assuming it | That number is the ceiling on how many people can sign in in a day, and it is too important to guess at |
| **Measured 7 October: 100 emails a day.** The ceiling is therefore 25 an hour and 80 a day | Google's limit for a free gmail.com account through Apps Script. Ours sits under it deliberately: Google's own limit stops ALL sending for up to 24 hours with no warning, whereas ours shows in the health check. The 20 left over are for the daily alarm, manual tests and retries |
| The two numbers live in a table, not in the code, and fall back to 25 and 80 if the row is deleted | The right number depends on which Google account owns the mailer script, which can change without the database changing, so raising it should be one UPDATE rather than a new SQL file. Falling back to a limit rather than to none matters because "no limit" is the failure that empties the day's quota |
| **Open constraint: 80 a day covers every email the site sends.** A cohort of 40 signing in once is half of it in a morning | The way out keeps the sender: the allowance follows the account that OWNS the script, not the address it sends AS. Owning the mailer with the paid Workspace account and adding datalead.a.info@gmail.com under Send mail as gives 1,500 a day with the same sender. Then `update mail_limits set per_hour = 200, per_day = 1200 where id = 1;` |
| The mailer token moved from the script body into Script Properties | The code then gets shared without the secret, which is how it reached a chat message in the first place |
| request_certificate_code keeps its name, argument and boolean result as a wrapper | So nothing has to be deployed on the day the SQL runs. The certificate claim page in particular keeps working untouched, and it must stay vague because there the answer reveals who has graduated |

## Known problems

| Problem | Severity |
| --- | --- |
| ~~Supabase's built-in Auth email sends two messages an hour, and only to the project team~~ Solved by the Send Email Hook, applied and switched on 7 October 2026 | Closed |
| Whether `x-forwarded-for` actually reaches the database on this project is untested. Every test feeds it in by hand, which proves the function reads it, not that Supabase passes it. If it does not arrive the caller limit never fires, which is why the site wide ceiling exists rather than being an extra | Low, because the ceiling does not depend on it |
| ~~A newly enrolled bootcamp participant cannot sign in to the portal that is live today~~ Fixed in file 12 part 0, applied 7 October 2026 | Closed |
| ~~If the Apps Script mailer stops, codes keep being minted and are deleted unsent after an hour, and nothing alerts anybody~~ `system_health` is live and the token is set. The alarm script still has to be put into Apps Script with a daily trigger | Medium until the alarm is live |
| The mailer token has not been rotated, and it is written in the body of the Apps Script. The procedure is in `EMAIL-SETUP.md` part 4, and the new `mailer.gs` moves it to Script Properties | High |
| Codes sit in `mail_outbox` in plain text until collected, for up to an hour. That was already true of bootcamp codes and is now true of Academy sign up codes too. Anybody holding the mailer token can read them, which is why rotating it matters | Medium, and it is the reason the token rotation is high |
| ~~`anon` and `authenticated` hold TRUNCATE on every `lms_` table~~ Fixed in file 10 version 2, step 9b. Applied 6 October 2026 | Closed |
| ~~File 10 version 2 is tested but has not been run~~ Run 6 October 2026, verify answered yes on all twenty rows | Closed |
| ~~File 11 is tested but has not been run~~ Run 7 October 2026, verify answered yes on all seventeen rows | Closed |
| ~~Storage is a worry on the free plan~~ Measured at 15 MB of 500 MB after file 11, and the housekeeping keeps finished learners small. Watch it, do not worry about it | Closed, now monitored by `system_health` |
| Whether pg_cron is turned on in the project is unknown to me. Without it the nightly sweep and the ninety day prune exist but are not scheduled, and have to be run by hand. `11_verify.sql` row 14 and the `scheduled jobs` row of `system_health` both report it | Medium until checked |
| The Send Email hook is on but the deployed mailer script is the old one, so Academy sign up codes go out worded as certificate codes. Nothing is broken; the wording is wrong until `mailer.gs` is pasted in | **High, and it is live right now** |
| The daily email allowance on the account that owns the mailer is 100, measured 7 October. That covers every email the site sends, so a cohort of 40 signing in once is nearly half of it. Owning the script with the paid Workspace account lifts it to 1500 with the same sender | Medium, and it becomes high at launch |
| An unconfirmed sign up count of five or more in a day is a warning from `system_health`, and the most likely cause is that the confirmation emails are not arriving | Watch it after launch |
| ~~The Academy has no interface at all~~ The account pages and the design system are built, on the design concept, with the watch tape ready for Phase 4 | Closed for Phase 2, Phases 3 to 6 remain |
| ~~**Phase 4 needs a read only function for minutes watched per day.** The This week tile in the design concept shows a seven bar chart of how long the learner watched on each day of this week. Nothing in the database answers that today: `lms_watch_buckets` holds the ten second buckets, but there is no function that groups them by day for the signed in learner, and a page must not be allowed to read the raw buckets. It has to be built in Phase 4 as a `SECURITY DEFINER` function returning seven rows for the caller and nobody else, with tests proving one learner cannot see another's. Until it exists the tile cannot be built, and it must not be faked with made up numbers~~ Built in file 15, but **not** from `lms_watch_buckets`: `lms_progress_tidy_up` deletes those the moment a lesson is completed, so the chart would have emptied itself as a learner worked. It is a new table, `lms_watch_days`, written only by `lms_record_watch`, read by `lms_my_week()` | Closed |
| The certification schema existed nowhere but inside Supabase until this folder. There is still no committed schema for the certification tables themselves | Medium |
| Two sign in systems, two staff portals and two dashboards will exist on one site unless this is resolved | Medium |
| There is one administrator and no second | Medium |
| The alarm script will be owned by one Google account. Share edit access with a second person as soon as it exists | Medium |
| **`main` holds an old duplicate folder, `DataLeadWeb-frontend/`, inside the repository.** Three files: `src/pages/Index/IndexMap.tsx`, `page.tsx` and `page.css`, about 100 KB. Nothing imports them, no config references them, and Vite does not build them, so they are harmless today. They are a trap for the next person, who may edit the wrong `Index/page.tsx`. **Remove them in a separate small pull request after launch**, on their own, so the diff is obviously a deletion and nothing else | Low, and it is a tidy up, not a fix |
| **`database/lms/not-yet-run/` on `main` still holds `10_roles_and_access.sql`, `10_undo.sql` and `10_verify.sql`.** File 10 was run on 6 October and its three files now live at the top of `database/lms/`, so these are stale copies sitting in a folder whose name says they have not been run. Delete those three files when the Academy branch is merged | Medium, because the folder name is now untrue |
| **The site's main JavaScript bundle is 1.17 MB, 354 KB compressed, because every page outside the Academy is loaded at once.** Somebody arriving on one blog post downloads every other page of the site before they can read it, which on a phone on a slow connection is the difference between a page that arrives and a reader who leaves. The Academy's seven pages are already loaded one at a time; doing the same to the other route groups would make the whole site faster and is a mechanical change. **A separate pull request after launch**, on its own, because it touches the router and nothing else, so a problem is easy to spot and easy to undo | Medium, and it affects every visitor, not only the Academy |
| ~~A course page answered 404 and "do not list this" whenever Supabase was slow, down or paused~~ Fixed in the Phase 3 review round. A 404 is answered only when Supabase replies and says there is no such course; any failure serves the ordinary page with status 200 and a thirty second cache. Four tests, one per way of failing | Closed, and it would have been severe: the free plan pauses after a week without visitors |
| ~~Tags were built from the host the request arrived on, so the vercel.app address published canonicals naming a second copy of the site~~ Fixed. `SITE_ORIGIN` is one line in `api/_seo-rules.js` and everything imports it, with a test that fails if any file grows its own copy | Closed |
| **The primary address is `https://dataleadafrica.com`, the bare one**, confirmed 8 October 2026. It is written in one place, `api/_seo-rules.js`, plus the `Sitemap:` line of `public/robots.txt`, which is a plain file and cannot import it. If it ever changes, those are the two lines | Settled, recorded so nobody has to work it out again |
| ~~A lesson check locked the lesson, and the whole course, after twenty wrong answers, for ever~~ Fixed in file 15. A check now has no try limit at all | Closed, and it was severe: reachable by an ordinary learner on an ordinary bad day, with no message and no way out but hand written SQL |
| ~~A module quiz shut the certificate away for ever after three failed tries~~ Fixed in file 15. It reopens 24 hours after the last try, with a fresh set | Closed, same severity |
| ~~`lms_attempt_marks` revealed right and wrong per question on a module quiz, which is solvable by elimination across three tries, and hid the explanation exactly when the answer was wrong~~ Fixed in file 15 | Closed |
| ~~Resume sent a learner to the furthest point they ever reached rather than where they stopped~~ Fixed in file 15 | Closed |
| **`10_undo.sql`, `11_undo.sql`, `13_undo.sql` and `14_undo.sql` do not actually refuse when run through psql.** Each one guards itself with a `raise exception` inside a `do $$` block. In the Supabase SQL editor the whole script is one transaction, so the exception rolls everything back and the guard works, which is where you use them. Run through psql without `ON_ERROR_STOP`, psql prints the refusal and then runs every statement after it anyway, undoing the file the guard was protecting. `15_undo.sql` is wrapped in an explicit `begin; ... commit;` and refuses either way. **Add the same two lines to the other four** in a small pull request after launch | Low while the SQL editor is the only way these are run, and it is. Worth fixing because the next person may not know that |
| **The daily watch table, `lms_watch_days`, is the only record of minutes watched per day and nothing rebuilds it.** The slices it is counted from are deleted as lessons are finished, by design, so a lost `lms_watch_days` row cannot be recovered from anything. `15_undo.sql` deliberately never drops the table for that reason | Low on its own, and another reason the database backup below matters |
| ~~A lesson could not be finished above 1x: the player sent one slice per ten seconds of WALL time rather than of video, so at 1.5x every third was never recorded~~ Fixed in the Phase 4 review round. The arithmetic is in `src/pages/Academy/Learn/Player/slices.js` and `tests/watch-slices.test.mjs` plays whole lessons through it at every speed | Closed, and it was invisible to every other kind of test: only playing a lesson to the end finds it |
| ~~The offline queue deleted slices the database had throttled, because a throttled `lms_record_watch` answers normally rather than failing~~ Fixed in the same round. The queue keeps to the database's rate | Closed, and it was worse than the bug above: it lost exactly the watching the queue exists to protect |
| **`database/lms/14_public_catalogue.sql` has still not been run on the live database.** It is the one that closes the two security leaks, and file 15 refuses to apply without it. `docs/lms/PHASE-5-TEST.md` opens with the order to run them in | **High until it is run.** Until then a stranger holding the site's publishable key can list every paid video reference and read every draft course |
| Unlisted YouTube links can be shared outside the platform by anybody who extracts one | Low |
| `feature/certification` on the remote does not contain the live learning portal. Diff it before merging it into anything | Low, until somebody merges it |
| **There is no backup of this database anywhere.** The Supabase free plan has no automated backups at all; their own documentation tells free projects to export regularly and keep an off-site copy. The Google Sheets archive that was once planned as file 09 was deferred and never built. So participants, certificates and enrolments exist in exactly one place | **High. It is the largest unmanaged risk in the project** |

## The next five tasks

**The database layer is finished.** Everything below is either a one-off safety task or the website.

### 1. Back up the four certification tables

There is no backup of this database anywhere, and the Supabase free plan provides none. Export
`participants`, `certificates`, `participant_enrolments` and `programmes` to CSV from the Table
Editor and put them in Drive.

**Done when:** four CSV files exist somewhere other than Supabase, dated.

### 2. Decide the real backup

Supabase Pro at about 25 US dollars a month gives daily backups with 7 days of retention, and also
removes the project pausing and the 500 MB limit. The alternative is building the Google export as a
further file. A backup somebody has to remember to take is not a backup.

**Done when:** either Pro is on, or the export runs on a schedule.

### 3. Upload everything to GitHub

The database now contains files 10 to 13. The repository is the only written record of what that
means, and some of it has not been uploaded yet.

**Done when:** `database/lms/` on main holds files 01 to 13 with their verify and undo files, and
`not-yet-run/` is empty.

### 4. Decide how an Academy course gets its programme

Either point every course at one of the four existing programmes, which makes the certificate say
"Data Analytics Bootcamp" rather than "STATA", or create one programme row per course. The second is
the recommendation. This is a data decision, not a code one: file 13 works either way.

**Done when:** the first Academy course has a `programme_id` and `13_verify.sql` row 11 still says
"yes, none".

### 5. Build the sign up and sign in pages for /lms

The first real slice of the website. `docs/lms/FRONTEND-MAP.md` section 5 has the page plan.

**Done when:** a new account can be created, confirmed by code and signed in on a Vercel preview; an
unconfirmed account sees the confirm message and no course access; and a bootcamp email on an active
enrolment can open a paid course.

## Standing rules

These are not tasks. They apply to every future change, and they are here so they survive whoever
is doing the work.

1. **Every SQL file that creates an `lms_` table must end by calling
   `lms_tidy_table_privileges()`.** Supabase grants every privilege on anything new in the public
   schema to both `anon` and `authenticated`, including TRUNCATE, which row level security never
   filters. The default privileges for the schema are deliberately left alone because the
   certification system shares it, so each new table has to be tidied as it is made.
2. **Every SQL file starts with a step 0 that checks the database is the one the file was written
   for, and changes nothing until every check has passed.** When a file replaces an existing
   function, step 0 also checks that function's exact arguments and result shape, and stops rather
   than overwriting something it does not recognise.
3. **Every SQL file is safe to run twice**, and ships with a verify file and an undo file.
4. **Tests are written before the fix, shown failing, and shown passing afterwards.** They connect
   as real roles, never as the database owner, because a suite run as the owner bypasses row level
   security and passes for the wrong reason.
5. **Never delete data that something else reads to make a decision** until that decision has been
   moved onto something that is not being deleted. File 11 part B2 is the worked example.
6. **No secret is ever generated inside a committed SQL file, and none is ever written into code.**
   Tokens are set by a statement you run by hand, stored only as a hash, and held on the calling
   side in Script Properties. A secret inside a committed file is not a secret.
7. **Anything that can fail silently gets a health check row.** The mailer failing invisibly cost
   this project a known-high problem for weeks. If a new moving part could stop without anybody
   noticing, add it to `system_health` in the same change that adds the part.
8. **An undo file restores the previous state except where the previous state was the fault.** Then
   it says so in a comment at the top, and gives a query that shows who a full revert would harm.

## Glossary, written for a twelve year old

**Database.** A set of tables, like a stack of spreadsheets that know how to check each other. Ours
is held by a company called Supabase.

**Table.** One spreadsheet. It has columns, like Name and Email, and rows, one per thing.

**Column type.** What kind of thing is allowed in a column. `text` is words, `integer` is a whole
number, `boolean` is yes or no, `uuid` is a long unique code like
`3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90`, and `timestamptz` is a date and a time.

**Primary key.** The column that gives every row its own name, so no two rows can be confused.

**Foreign key.** A column that points at a row in another table. A lesson points at the module it
belongs to. The database refuses to point at something that is not there.

**Enum.** A column that may only hold one of a short list of words. Our `lms_role` may only be
learner, facilitator or admin. Spelling it wrong is simply refused.

**Default.** What goes in a column when nobody says. A new course starts as a draft.

**Not null.** A column that must be filled in. Leaving it empty is refused.

**Index.** A shortcut that helps the database find rows quickly, like the index at the back of a
book.

**Unique.** A rule saying no two rows may hold the same value. No two courses may share a slug.

**Check.** A rule about what a value may be. A price may not be below zero.

**Row level security, RLS.** The rule about who may see or change which rows. Without it, anybody
who can reach the table can read all of it. With it, you see your own progress and nobody else's.

**Policy.** One RLS rule, with a name. `p_opt_staff_only` is the rule that stops a learner reading
the answers.

**Privilege, or grant.** Permission to do a kind of thing to a whole table, like SELECT for reading
or UPDATE for changing. Privileges and policies work together: you need the privilege to get through
the door, and the policy decides which rows you may touch once inside.

**TRUNCATE.** Emptying a whole table in one go. This one ignores row level security entirely, which
is why we want to take it away.

**Function.** A small program stored inside the database. We put every rule that somebody could
cheat into a function, because the database runs it and the browser cannot change it.

**SECURITY DEFINER.** A function that runs with its author's permissions rather than the caller's.
It is how a learner can ask "am I allowed in" without being allowed to read the table that holds the
answer.

**Trigger.** A function the database runs by itself when something happens, like stamping the time
whenever a row changes, or refusing a delete.

**View.** A saved question that looks like a table. `lms_course_cards` is a view that counts the
modules and lessons of each course every time you look, so the numbers are never stale.

**Migration.** One file of instructions that changes the database. Ours are numbered so they run in
order.

**Schema.** The shape of the database: the tables, the columns and the rules. Not the data.

**Entitlement.** Our word for a row saying a person may open a course. One table holds them all,
whether the access was bought, given or earned by being on a bootcamp.

**Watch bucket.** One row saying "this person really did watch seconds 40 to 50 of this video". The
server writes them, not the browser, which is why dragging the bar forward does not fill them.

**Supabase Auth.** The part of Supabase that keeps email addresses and passwords. It hashes the
password, meaning it stores a scrambled version that cannot be turned back, so even we cannot read
it.

**Anon and authenticated.** The two names the database uses for visitors. `anon` is somebody who has
not signed in. `authenticated` is somebody who has.

**Service role.** A master key that ignores all the rules. It must never appear in the website code,
only on a server.

**Vacuum.** Tidying up inside a table after rows are deleted. PostgreSQL does not hand the space
back to the computer straight away; it marks it reusable and puts the next rows there. So a table
that has had a lot deleted looks the same size until it is vacuumed, and that is normal, not a fault.

**pg_cron.** An optional extra that lets the database run a job on a timetable, like at 02:42 every
night. If it is switched off, the job still exists and can be run by hand.

**SMTP.** The language email servers speak to each other. Telling Supabase our SMTP details means
telling it to hand its emails to Google to post, instead of posting them itself.

**App password.** A long password Google makes for one program to use, instead of your real one. If
it leaks you cancel that one and nothing else is affected, and it cannot be used to sign in as you
in a browser.

**SPF, DKIM and DMARC.** Three notes you leave in the public directory for your domain name. SPF
says which servers are allowed to send email as you. DKIM lets the receiver check the email was not
altered on the way. DMARC says what to do when the first two fail, and asks for reports. Without
them your email often lands in spam, and without DMARC you never find out that it did.

**Token.** A long password used by a program rather than a person. Ours are stored scrambled, so the
database can check one without ever holding the real thing.

**Hash.** A scrambled version of something that cannot be turned back. You can check whether two
things match by scrambling both, but you cannot read the original out of the scramble.

**Health check.** One question you can ask the system that answers "is anything wrong", so a problem
does not wait for a person to stumble over it.

**Heartbeat.** A note a program leaves saying "I was alive at this time". Silence then means
something, instead of meaning nothing.

**Branch.** A copy of the website's code where changes can be made safely without touching the live
version.

**Pull request.** A request to merge a branch into the live version, so somebody can look at the
changes first.
