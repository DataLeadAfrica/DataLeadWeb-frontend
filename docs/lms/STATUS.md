# Data-Lead Academy: status

Last updated 6 October 2026.

## Where we are in one paragraph

The Academy is a database and nothing else. Seventeen tables, twenty four Academy functions,
twenty nine row level security policies and one view are live in the certification Supabase
project, and they have been checked object by object against a snapshot of the real database.
Not one page on the website calls any of them. The biggest remaining piece of work, the part a
learner would actually touch, has not been started.

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

## Known problems

| Problem | Severity |
| --- | --- |
| A newly enrolled bootcamp participant cannot sign in to the portal that is live today. `request_certificate_code` only mints a code for somebody who already holds a certificate, and it returns success either way, so the page shows no error and no email arrives | High |
| If the Apps Script mailer stops, codes keep being minted and are deleted unsent after an hour. Nothing alerts anybody, and a wrong token looks exactly like a healthy mailer with an empty queue | High |
| The mailer token has not been rotated | High |
| `anon` and `authenticated` hold TRUNCATE on every `lms_` table. Row level security never filters TRUNCATE. It is not reachable through the normal API, but no role needs it | Medium |
| The Academy has no interface at all | Medium, and it is the largest piece of work |
| The certification schema existed nowhere but inside Supabase until this folder. There is still no committed schema for the certification tables themselves | Medium |
| Two sign in systems, two staff portals and two dashboards will exist on one site unless this is resolved | Medium |
| There is one administrator and no second | Medium |
| Unlisted YouTube links can be shared outside the platform by anybody who extracts one | Low |
| `feature/certification` on the remote does not contain the live learning portal. Diff it before merging it into anything | Low, until somebody merges it |

## The next five tasks

### 1. Run file 10 on the live database

Rename the staff role to facilitator and switch access over to the two email lists.

**Done when:** `10_roles_and_access.sql` has run with no red error, `10_verify.sql` returns ten
rows all answering yes, the three files have moved out of `not-yet-run/` into
`database/lms/`, and `database/lms/README.md` shows file 10 as run.

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

### 4. Take TRUNCATE away from anon and authenticated

**Done when:** a query of `information_schema.role_table_grants` for those two roles over the
`lms_` tables returns no TRUNCATE row, and the 43 test suite still passes.

### 5. Build the sign up and sign in pages for /lms

Email and password against Supabase Auth, with confirmation, calling `lms_sync_my_access()`
once after a successful sign in and showing the sentence it returns.

**Done when:** a new account can be created, confirmed by email and signed in on a Vercel
preview; an unconfirmed account sees the confirm message and no course access; a facilitator
email on the list arrives as a facilitator; and a bootcamp email on an active enrolment can open
a paid course.

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

**Branch.** A copy of the website's code where changes can be made safely without touching the
live version.

**Pull request.** A request to merge a branch into the live version, so somebody can look at the
changes first.
