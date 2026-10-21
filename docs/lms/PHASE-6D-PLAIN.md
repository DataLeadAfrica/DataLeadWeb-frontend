# Phase 6D in plain English

Sign up stops sending a code, and a separate email check takes over the job that code was really doing.

## What changed, and why it is not just a convenience

Signing up used to end with a six digit code in your email. Type it in and you were through. That
code was doing two jobs at once, and only one of them was about convenience.

The second job was proof. A typed email address proves nothing: anybody can type anybody's. The
code proved the person signing up could actually read that inbox. Three things in the Academy hang
off that proof:

- **staff access**, because a facilitator is appointed by email address
- **your certificates**, because an Academy account is joined to a certification record by matching
  the address
- **bootcamp access**, which comes through that same join

So dropping the code without replacing the proof would mean that anybody who typed a facilitator's
address got the control room, and anybody who typed a certified person's address got their
certificates. Not as a clever attack: on the first sign in, automatically.

## What replaces it

Sign up is now instant. No code, no waiting, no email. You see a page saying your registration is
complete and you can sign in.

The proof moved to its own place. On My learning there is a card offering to confirm your email
address, for everybody who has not done it. Ask for a code, type it in, and the three things above
unlock straight away.

**The card looks the same for everybody.** That is deliberate. If it only appeared for people who
had something waiting, the card itself would tell a stranger that an address was on the staff list
or had certificates against it.

## Why the proof is our own column now

Supabase has a column saying whether an address was confirmed. With "Confirm email" turned off, it
fills that column in the instant the account is made, for everybody. It stops meaning anything.

So the Academy keeps its own: `lms_profiles.email_verified_at`, which nothing sets except somebody
typing a correct code. Eleven places used to read Supabase's column. Five now read ours, and six
are deliberately left alone, each for a reason written down in the file.

## The one thing to be careful about

**File 19 must be run while "Confirm email" is still on.** It copies Supabase's answer into our
column for every account that already exists, and those answers are only true while the setting is
still making people prove the address.

The file records the moment it first ran and never backfills an account made after that, so running
it again later is safe. But running it for the first time after the setting is off would mark
everybody proven when nobody proved anything.

The order is in `PHASE-6D-RUN-ORDER.md` and it matters: run the file, merge, then turn the setting
off.

## What each check in 19_verify_EDITOR.sql means

Fourteen rows. The Editor copy says only "check 1", "check 2" and so on, for the reason set out in
`scripts/lms/make-editor-sql.mjs`, so this is where to look when one says NO.

**Row 4 is the one that matters.** It is the whole reason the file exists.

| # | What it checks | What a NO means |
|---|---|---|
| 1 | There is a column of our own for a proven address | Everything else depends on this. Without it nothing can tell a proven address from one that was merely typed. |
| 2 | The backfill has run, and recorded when | The recorded moment is what stops a later run marking people proven who never proved anything. |
| 3 | Nobody who signed up after the backfill is marked proven by it | The guard failed, and somebody is proven because a file ran twice rather than because they typed a code. |
| 4 | The access sync no longer trusts the address somebody typed | **The important one.** This single gate covers staff access, the certification link and bootcamp access. A NO means somebody signing up with an appointed facilitator's address is handed the control room on their first sign in. |
| 5 | Nor does the bootcamp claim, the new account trigger or the facilitator appointment | The same fault by three other doors. |
| 6 | A person can ask for a code | Without it nobody can prove an address at all, so bootcamp access, staff access and certificates never arrive. |
| 7 | And type it in | The other half of the same thing. |
| 8 | Only a signed in caller may use either one | A signed out caller must not be able to make the site send email, nor prove an address that is not theirs. |
| 9 | The codes are hashed, never kept as typed | A NO means anybody able to read one stored row can sign in as whoever has a code waiting. |
| 10 | Nobody can read the stored codes in a browser | The hash is useless to a learner and the try count is something they could otherwise watch. |
| 11 | A wrong code is counted, and five of them end it | A six digit code with no try limit is guessed in an afternoon. |
| 12 | Passing the check runs the access sync at once | Without it somebody types a correct code and nothing visibly happens until they sign out and back in. |
| 13 | The log keeps a note of the check and not of the code | An administrator reading the log must not come away holding a way to open somebody else's account. |
| 14 | The answers a person gave at sign up still reach their profile | This trigger is deliberately left reading Supabase's own column, because it grants nothing and moving it would leave the disability answer sitting in the account token until somebody typed a code. |
| 15 | Only an administrator can look up a certification record | It searches the certification register, which is a list of real people and their addresses. A facilitator sees no learner names at all and must not reach it. |
| 16 | Joining a record by hand is an administrator decision, with a reason | This hands somebody the certificates of a named person, so it belongs to an administrator and the reason belongs in the log. |
| 17 | And it cannot take one already joined to another account | The unique index refuses it anyway, so a NO means an administrator gets a constraint violation instead of a sentence. |
| 18 | A facilitator cannot rewrite the chapters of somebody else's lesson | Nothing to do with email. It rides along because it was found while 6D was being built and it is a live hole, not a future one. The chapter saver asks "are you staff" and never "is this lesson yours", and it had been handed to every signed in account, so one facilitator could overwrite the chapter list of a published course belonging to another. It is only ever meant to be reached through the lesson save, which does check ownership. |
| 19 | And the backfill mark cannot be emptied by a visitor | Supabase hands anon and authenticated every privilege on anything newly created, so this table arrived unlocked and a signed out visitor could empty it. Emptying it shows nobody anything; what it does is remove the only thing stopping a later run of file 19 from marking every address typed since as proven. Dr Ayoola found it by truncating the table as anon. Row level security is now on with no policy and the grants are taken back, which also turns `12_verify` rows 11 and 12 back to yes. |

### If row 4 says NO

Stop, and do not turn "Confirm email" off, or turn it back on if it is already off. A NO there means
the gate is still trusting a typed address, and the setting is the only thing standing between that
and somebody helping themselves to staff access.

## What each check in 20_verify_EDITOR.sql means

Six rows, about a fault that was live: nothing in the control room ever created a lesson check, so
no course built there could be published at all.

| # | What it checks | What a NO means |
|---|---|---|
| 1 | Making a video lesson also makes its check | Every lesson built in the builder has no check. The Questions page has no id to give its editor, writing a question answers "invalid input syntax for type uuid", and publish check 7 can never pass. No course can go live. |
| 2 | No video lesson is sitting without one | These are lessons made before file 20. Each is a course that cannot be published until somebody notices why. |
| 3 | A lesson check belongs to its lesson and to nothing else | The table allows exactly one owner, so a row with two is refused on the way in. A NO would mean that rule itself has gone. |
| 4 | Adding a set of questions asks whose course it is | `lms_create_quiz` used to ask only whether the caller was staff, so a facilitator could attach questions to any lesson in anybody's course. |
| 5 | And nothing signed in is granted it | Revoking from `authenticated` and `anon` is not enough on its own: a function is executable by `PUBLIC` from the moment it is created, so the grant survives through that unless `PUBLIC` is named too. |
| 6 | A lesson that is not a video is left alone | A check on a reading lesson is a row nobody looks at, since check 7 only asks about video lessons. |

### What a facilitator still has to do

File 20 gives the lesson its check. It does not write the questions. Check 7 wants a check **with
at least one question in it**, so the path is still: make the lesson, open Questions, write one.
What changed is that the page now works at all.


## Joining a certification record by hand

Almost nobody needs this. An Academy account is joined to a certification record by **matching the
email address**, once that address has been proven, and that covers everybody who signed up with
the address their certificate is under.

The case it does not cover is somebody whose certificate is under an old work address. For that,
an administrator opens the learner in the control room, finds the record by name or address, gives
a reason, and joins the two.

Three things about it are deliberate:

- **Administrators only.** A facilitator never sees a learner's name or address, and this searches
  a register of real people.
- **A reason is required.** "Why does this person have those certificates" is a question that gets
  asked later, and the answer belongs in the log rather than in somebody's memory.
- **It refuses a record already joined to another account.** The database would refuse it anyway,
  through the unique index. Refusing it in the function means an administrator gets a sentence
  instead of a constraint violation, and the search marks those records before they are picked.

## What each check in 21_verify_EDITOR.sql means

Eleven rows, about who is allowed to call what. A function in Postgres is executable by `PUBLIC`
from the moment it is created, so a fresh build of files 01 to 20 left 47 of our own `lms_`
functions callable by a signed out visitor. Three of them mattered.

The first four rows check the fix. **Rows 5, 6, 7 and 9 check that the fix did not go too far**,
and every one of them was a real near miss while the file was being written. If somebody later
reaches for a tidy sweep over the whole schema, those four rows are what say no.

| # | What it checks | What a NO means |
|---|---|---|
| 1 | The three that were open to anybody are shut | The reason the file exists. `lms_link_participant` joins an account to somebody's certification record by email and asks nothing about who called it, which is how Dr Ayoola joined himself to another person's record as a plain learner. `lms_grant_free_courses` hands free courses to any account id. `lms_storage_report` reads row counts and sizes for a visitor. Live has all three shut by hand, so a NO means a rebuild reopened them. |
| 2 | And the chapter saver is still shut to everybody | The same question row 18 of the file 19 checks asks. It asks whether you are staff and never whether the lesson is yours, so one facilitator could rewrite the chapters of another person's published course. |
| 3 | Nothing can call the fourteen that nothing calls | Nothing in the pages or the scripts calls any of these. Each is reached by a security definer function, which calls it as its own owner and needs no grant, or by nothing at all. |
| 4 | The eight a learner needs are shut to the signed out, and only those | A NO means either a visitor still holds one, or the fix went too far and a signed in learner has lost one they need. That second half caught a real fault: `lms_sync_my_access` had no grant of its own and was reached only through `PUBLIC`, so revoking `PUBLIC` took it from learners too, and the Academy calls it on every sign in. |
| 5 | The five policy helpers are untouched | A guard against an overzealous fix, not against an attacker. These five are named inside 36 row level security policies across 27 tables, and a policy runs its functions as whoever is querying. Revoking `lms_is_admin` alone was enough to stop a learner reading their own profile. A NO here means the Academy is down for everybody. |
| 6 | And so are the five a signed out page really does call | `lms_my_path` is the one worth knowing about: reading the code suggested a session was always needed, and a real browser showed the path page asking for it with no session at all. A NO means the catalogue, a course page or a path page is broken for visitors. |
| 7 | The FAQ validator is untouched | A CHECK constraint is evaluated as whoever is querying, exactly like a policy, and `lms_courses` has one that calls this. With it revoked, a facilitator editing their own course was told permission denied. It takes a jsonb and answers true or false, reaching no data, so shutting it was never worth anything. |
| 8 | Nothing outside the allow list is executable by a visitor | The row that keeps working. The others check a list of known mistakes; this one fails on a function added next year and left with its default grant, without anybody having to remember to add a check. Underneath the table it prints the names of whatever it found. |
| 9 | The certification system was not touched | The mailer is a Google Apps Script with no account of its own: it arrives as a visitor and proves itself with a token. The staff console, the participant portal and the blog work the same way, and most of their functions are not in this repository, so no local test would notice them breaking. A NO means a sweep caught something it should not have. |
| 10 | Every function that takes a person asks whether you are an administrator | Eight security definer `lms_` functions accept an account id or an email address and can be reached by a signed in browser. Every one asks `lms_is_admin()` first. A NO means one of them will act on whatever person it is handed, for whoever asked. |
| 11 | And the four that ask nothing cannot be reached at all | The other side of row 10. These four take an account id and check nothing about who is asking, which is exactly why no browser may reach them. Two are reached by the new account trigger and two by the access sync, all security definer. |

### The allow list, in plain words

After file 21, a signed out visitor may execute 26 of our `lms_` functions and no others: the five
policy helpers, the five a signed out page really calls, the one FAQ validator a CHECK constraint
needs, and fifteen trigger functions. Trigger functions are left alone deliberately. A trigger
fires through the trigger mechanism rather than through a grant, so execute on one does nothing for
a browser, and revoking them would buy nothing for the risk.
