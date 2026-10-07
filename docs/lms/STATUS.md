# Data-Lead Academy: status

Last updated 6 October 2026, after file 10 was run on the live database.

## Where we are in one paragraph

The Academy is a database and nothing else. Seventeen tables, twenty four Academy functions,
twenty nine row level security policies and one view are live in the certification Supabase
project, and they have been checked object by object against a snapshot of the real database.
Not one page on the website calls any of them. The biggest remaining piece of work, the part a
learner would actually touch, has not been started.

**File 10 was run on the live database on 6 October 2026, and `10_verify.sql` answered yes on
all twenty rows.** Access now follows the two email lists, only the administrator publishes,
and the table permissions are tightened. Its three files have moved out of `not-yet-run/`
into `database/lms/`.

File 11 is written and tested but **not yet run**. It fixes a marking rule that could tell a
learner they had finished a quiz containing nothing, stops anything going live with an empty
set of questions, and does the storage housekeeping that the lost file 08 was meant to do.

## What the Academy is meant to be

A self paced course platform at **/lms** on dataleadafrica.com, selling single tool courses
rather than bundled bootcamps. Somebody buys STATA, or SQL, or Power BI on its own at around
NGN 10,000, works through it alone, and gets a certificate at the end.

A course holds modules; a module holds lessons. A video lesson plays a YouTube video inside the
page and cannot be skipped on a first pass: the server records which ten second slices of the
video it has actually seen, and the next lesson stays shut until coverage passes the lesson's
threshold. After the video comes a short set of questions. Pass those and the next lesson opens.

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
| Supabase free plan | Storage and egress have to stay modest. Video lives on YouTube, which keeps it out of Supabase entirely |
| No environment variables | Configuration sits in a single committed file, and only publishable keys ever appear in the browser |
| Two Supabase projects on the plan | The Academy adds none; it lives in the certification project. Note that the repository currently references three project URLs, which is worth checking |
| Must survive my absence | Nothing may depend on one person's memory. This file and `database/lms/README.md` exist for that reason |
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

## Known problems

| Problem | Severity |
| --- | --- |
| A newly enrolled bootcamp participant cannot sign in to the portal that is live today. `request_certificate_code` only mints a code for somebody who already holds a certificate, and it returns success either way, so the page shows no error and no email arrives | High |
| If the Apps Script mailer stops, codes keep being minted and are deleted unsent after an hour. Nothing alerts anybody, and a wrong token looks exactly like a healthy mailer with an empty queue | High |
| The mailer token has not been rotated | High |
| ~~`anon` and `authenticated` hold TRUNCATE on every `lms_` table~~ Fixed in file 10 version 2, step 9b. Not yet applied to the live database | Was medium |
| Whether pg_cron is turned on in the project is unknown to me. Without it the nightly sweep exists but is not scheduled, and has to be run by hand | Medium until checked |
| ~~File 10 version 2 is tested but has not been run~~ Run on 6 October 2026, verify answered yes on all twenty rows | Closed |
| File 11 is tested but has not been run. Until it is, a learner part way through a quiz whose questions get deleted is told they have finished, an empty set of questions can go live and strand learners at a lesson, and nothing clears watch slices | High |
| If `11_verify.sql` row 09 says NO, there is already a live set of questions with nothing in it, and learners cannot finish that lesson. File 11 reports these but will not change them | High if it fires |
| The Academy has no interface at all | Medium, and it is the largest piece of work |
| The certification schema existed nowhere but inside Supabase until this folder. There is still no committed schema for the certification tables themselves | Medium |
| Two sign in systems, two staff portals and two dashboards will exist on one site unless this is resolved | Medium |
| There is one administrator and no second | Medium |
| Unlisted YouTube links can be shared outside the platform by anybody who extracts one | Low |
| `feature/certification` on the remote does not contain the live learning portal. Diff it before merging it into anything | Low, until somebody merges it |

## The next five tasks

### 1. Check whether pg_cron is on, then run file 11

First run this one line in the SQL editor, because it decides whether the nightly clean-up
gets a schedule:

```sql
select count(*) as pg_cron_installed from pg_extension where extname = 'pg_cron';
```

If it returns 0, turn pg_cron on under Database, then Extensions, before going further. Then
run `11_housekeeping.sql`, then `11_verify.sql`.

**Done when:** file 11 has run with no red error; if its Step 6 warns about sets of questions
that are already live and empty, each has been given a question or deleted;
`11_verify.sql` answers yes on all seventeen rows except row 14, which may report that
pg_cron is off; and the three files have moved out of `not-yet-run/` into `database/lms/`.

### 2. Rotate the mailer token

Replace the shared secret that guards the email queue, in the `mailer_token` row and in the
Apps Script.

**Done when:** `mail_ping` returns OK with the new token, returns BAD TOKEN with the old one,
and one real sign in code arrives in an inbox after the change.

### 3. Fix the sign in deadlock for enrolled participants

Let somebody with an active enrolment request a code even though they hold no certificate yet.

**Done when:** a participant enrolled today, holding no certificate, receives a code and reaches
/my-learning; and somebody with no enrolment and no certificate still receives nothing, with the
page saying the same thing either way.

### 4. Appoint yourself administrator, then add the facilitators

Nothing in the website can do this, on purpose. In the SQL editor:

```sql
update lms_profiles set role = 'admin'
 where id = (select id from auth.users where email = 'you@dataleadafrica.com');
```

You must have signed up on the site first, so the account exists.

**Done when:** `select lms_my_role();` returns admin for your account, and
`select * from lms_add_facilitator('tutor@dataleadafrica.com','Their Name','why');`
returns ok.

### 5. Build the sign up and sign in pages for /lms

Email and password against Supabase Auth, with confirmation, calling `lms_sync_my_access()`
once after a successful sign in and showing the sentence it returns.

**Done when:** a new account can be created, confirmed by email and signed in on a Vercel
preview; an unconfirmed account sees the confirm message and no course access; a facilitator
email on the list arrives as a facilitator; and a bootcamp email on an active enrolment can open
a paid course.

## Standing rules

These are not tasks. They apply to every future change, and they are here so they survive
whoever is doing the work.

1. **Every SQL file that creates an `lms_` table must end by calling
   `lms_tidy_table_privileges()`.** Supabase grants every privilege on anything new in the
   public schema to both `anon` and `authenticated`, including TRUNCATE, which row level
   security never filters. The default privileges for the schema are deliberately left alone
   because the certification system shares it, so each new table has to be tidied as it is
   made.
2. **Every SQL file starts with a step 0 that checks the database is the one the file was
   written for, and changes nothing until every check has passed.**
3. **Every SQL file is safe to run twice**, and ships with a verify file and an undo file.
4. **Tests are written before the fix, shown failing, and shown passing afterwards.** They
   connect as real roles, never as the database owner, because a suite run as the owner
   bypasses row level security and passes for the wrong reason.
5. **Never delete data that something else reads to make a decision** until that decision has
   been moved onto something that is not being deleted. File 11 part B2 is the worked example.

## Glossary, written for a twelve year old

**Database.** A set of tables, like a stack of spreadsheets that know how to check each other.
Ours is held by a company called Supabase.

**Table.** One spreadsheet. It has columns, like Name and Email, and rows, one per thing.

**Column type.** What kind of thing is allowed in a column. `text` is words, `integer` is a
whole number, `boolean` is yes or no, `uuid` is a long unique code like
`3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90`, and `timestamptz` is a date and a time.

**Primary key.** The column that gives every row its own name, so no two rows can be confused.

**Foreign key.** A column that points at a row in another table. A lesson points at the module
it belongs to. The database refuses to point at something that is not there.

**Enum.** A column that may only hold one of a short list of words. Our `lms_role` may only be
learner, uploader or admin. Spelling it wrong is simply refused.

**Default.** What goes in a column when nobody says. A new course starts as a draft.

**Not null.** A column that must be filled in. Leaving it empty is refused.

**Index.** A shortcut that helps the database find rows quickly, like the index at the back of a
book.

**Unique.** A rule saying no two rows may hold the same value. No two courses may share a slug.

**Check.** A rule about what a value may be. A price may not be below zero.

**Row level security, RLS.** The rule about who may see or change which rows. Without it,
anybody who can reach the table can read all of it. With it, you see your own progress and
nobody else's.

**Policy.** One RLS rule, with a name. `p_opt_staff_only` is the rule that stops a learner
reading the answers.

**Privilege, or grant.** Permission to do a kind of thing to a whole table, like SELECT for
reading or UPDATE for changing. Privileges and policies work together: you need the privilege to
get through the door, and the policy decides which rows you may touch once inside.

**TRUNCATE.** Emptying a whole table in one go. This one ignores row level security entirely,
which is why we want to take it away.

**Function.** A small program stored inside the database. We put every rule that somebody could
cheat into a function, because the database runs it and the browser cannot change it.

**SECURITY DEFINER.** A function that runs with its author's permissions rather than the
caller's. It is how a learner can ask "am I allowed in" without being allowed to read the table
that holds the answer.

**Trigger.** A function the database runs by itself when something happens, like stamping the
time whenever a row changes.

**View.** A saved question that looks like a table. `lms_course_cards` is a view that counts the
modules and lessons of each course every time you look, so the numbers are never stale.

**Migration.** One file of instructions that changes the database. Ours are numbered so they run
in order.

**Schema.** The shape of the database: the tables, the columns and the rules. Not the data.

**Entitlement.** Our word for a row saying a person may open a course. One table holds them all,
whether the access was bought, given or earned by being on a bootcamp.

**Watch bucket.** One row saying "this person really did watch seconds 40 to 50 of this video".
The server writes them, not the browser, which is why dragging the bar forward does not fill
them.

**Row level security policy versus a privilege, in one line.** The privilege is the key to the
room; the policy decides which drawers you may open.

**Supabase Auth.** The part of Supabase that keeps email addresses and passwords. It hashes the
password, meaning it stores a scrambled version that cannot be turned back, so even we cannot
read it.

**Anon and authenticated.** The two names the database uses for visitors. `anon` is somebody who
has not signed in. `authenticated` is somebody who has.

**Service role.** A master key that ignores all the rules. It must never appear in the website
code, only on a server.

**Trigger, again, because file 11 leans on them.** Code the database runs by itself when a row
changes. File 11 uses three: one refuses to publish an empty set of questions, one works out
the final watched figure, and one throws away the slices and the finished lesson's checks.

**Vacuum.** Tidying up inside a table after rows are deleted. PostgreSQL does not hand the
space back to the computer straight away; it marks it reusable and puts the next rows there.
So a table that has had a lot deleted looks the same size until it is vacuumed, and that is
normal, not a fault.

**pg_cron.** An optional extra that lets the database run a job on a timetable, like at
02:42 every night. If it is switched off, the job still exists and can be run by hand.

**Branch.** A copy of the website's code where changes can be made safely without touching the
live version.

**Pull request.** A request to merge a branch into the live version, so somebody can look at the
changes first.
