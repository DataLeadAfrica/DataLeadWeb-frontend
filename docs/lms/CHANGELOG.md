# CHANGELOG

One cumulative package. Every phase adds to it, and this file says what each phase changed.

Everything sits at its real path in the repository, so the package can be laid on top of `main` as
it is.

From round 2 onwards the packages hold ONLY the files that differ from `main`, not a cumulative
copy of everything, because this is now a change to a live site. Each entry says which base it was
laid on.

There is ONE changelog for the Academy and it is this file. An earlier `academy-6a` package carried
a second copy of its own; that copy is gone and its entry is below.

---

## PHASE 6B, ROUND 2, 14 October 2026. Big Sam's eight, and a correction about the SQL Editor

Laid on `881d0d9`, replacing the first `academy-6b` package. Nothing from that package had been
uploaded or run, so this one stands in its place rather than following it.

Big Sam found eight things. Two of them would have stopped the control room working at all, and
both got past every test I had. The pattern in both is the same and worth saying plainly: I tested
the thing I had built against a model of the database and a model of the browser, and neither model
was the real one.

### The two serious ones

**On a phone the control room could not be used at all.** Below 1100px the side menu filled the
screen, stuck, and the page underneath was never seen. The rule that hides it was written before the
rule that shows it, both were one class strong, and in a tie the later rule wins.

My own check for this passed, and that is the part worth keeping in mind: I had tested that nothing
scrolls sideways. A panel lying ON TOP of the page does not make the page any wider, so a covered
page and a correct page look identical to that test. The screenshots missed it too, because a
full page screenshot stretches the window to the height of the document, and a `100vh` sticky panel
in a window that tall no longer covers anything.

Fixed by stating the small screen rules after the main ones and making them stronger, so moving a
block cannot bring it back. Then I wrote a scanner that walks the file tracking which media query
each rule sits in, and it found the same mistake twice more:

- `.stu__findsmall`, the search button that replaces the command bar on a phone, was hidden by its
  own base rule. There was no way to reach the command bar on a phone at all. Big Sam had not
  reported this one.
- `.stu__tab`, which is item 7 below, turned out to be the same family of fault rather than a
  one-off size slip.

**Certificates and Health failed on the live database.** They read `ct.revoked_at` and
`mail_outbox.sent_at`. Neither column exists: the columns are `revoked` and `sent`, both booleans.

`database/lms/schema-snapshot.md` has been in this repository since 6 October and says so. I did
not read it.

I first wrote here that I had built against a local stand in which had the columns I expected. I
then checked, and that was not true either: the local harness says `revoked boolean` and
`sent boolean`, exactly like the real database. The model was right and I still got it wrong, which
leaves only one explanation, and it is the plain one below.

They got past 65 database tests because PL/pgSQL resolves a column name only when a function RUNS,
and every test I had written was about a refusal, which raises before it reaches the read. Two new
kinds of test now cover this, because one of them would not have been enough:

- `file_17_tests.sql` section 17 calls every read function in file 17, as an administrator and then
  as a facilitator. A wrong column name now fails. The file runs 71 checks, up from 65.
- `tests/control-room.test.mjs` resolves every aliased column read in file 17 against the snapshot.
  It is scoped to the tables the snapshot marks as predating the Academy, because the snapshot says
  of itself that it was taken before file 10 was run and its `lms_` sections are therefore missing
  every column files 10 to 17 add.

That second test was wrong three times before it was right, and each way of being wrong is the kind
that leaves a test looking like a clean bill of health:

1. It read the comments as well as the code, and matched the comment explaining the `revoked_at`
   bug. That is the third time a scanner of mine has found my own prose about a bug.
2. It assumed one alias means one table for the whole file. `pr` is `lms_profiles` in four places
   and `programmes` in one.
3. It resolved each alias from the nearest binding ABOVE the read. In SQL the select list is
   written above the from clause, so a column is routinely read before the join that binds it.

It now resolves aliases per statement, which is the unit Postgres itself resolves names in, and it
fails if it finds fewer than twelve reads to check, so a regex that quietly matches nothing fails
rather than passing.

### The other six

| | |
|---|---|
| An administrator could demote the other administrator | `lms_set_staff_role` refused the value `admin` and refused changing your own role, but not changing somebody who already was one. It now refuses when the target is an administrator, with a message saying administrators are made and removed in Supabase. Verify row 41 and a new test. |
| The undo left functions behind | Reported as three. It was six functions, plus `lms_save_popup` dropped with thirteen arguments when it has fourteen, which matches nothing and fails silently. I derived the list off file 17 rather than trusting the count, and a test now reads every function file 17 creates and fails if the undo does not drop each one. |
| "New learners" counted staff | It counted every row in `auth.users`, so it included staff and sign ups that were never confirmed. On Big Sam's database it said 2 when both accounts were administrators and there were no learners at all. It now counts confirmed accounts whose role is `learner`. Section 19 of the test file makes three accounts of known kinds (a confirmed learner this week, one who never confirmed, one from a month ago) and checks the number goes up by exactly one. It is measured as a CHANGE rather than an absolute, because earlier sections make learners of their own and a test expecting 1 fails for the wrong reason. A test that read the source for the word "learner" would have passed whatever the count came out as, which is why there is a behaviour check for this one and not a source assertion. |
| "BUILT BY SOMEBODY" | The builder header said that whenever `created_by` was empty, which is every course that already exists. The "built by" part is left out when there is no name. |
| The "More" tab was bigger than the other four | `academy.css` has `.acad :where(button, input) { font: inherit }`. `:where()` contributes no specificity, so that rule is one class strong, exactly like a bare `.stu__tab`, and a tie is settled by whichever stylesheet the bundler happened to put first. Four tabs are links and the fifth is a button, so the button inherited the body size. The tab rule is now stronger than the tie. |
| What `show-test-course.sql` does after file 17 | Measured on a real build rather than reasoned about: it is refused. Publishing now runs the nine checks and the Phase 4 test course fails three of them (no lesson checks, no certificate programme, no exam). That is the checks working. Written at the top of the file and in the run order, with the two honest ways round it. |

### The correction about the SQL Editor

Big Sam's earlier explanation of why `16_verify.sql` failed in the Supabase SQL Editor was that it
had semicolons inside string literals. That was wrong, and by the time he said so I had written it
into a test comment, a file header and two docs as though it were established.

What actually happened: taking every semicolon out did not fix it, and nor did removing every
comment. What ran was a version with short labels only, an empty explanation column and no prose.
The best guess now, and it is a guess, is that the Editor scans the text for a table name after
words like `from`, `into`, `join`, `update` and `table`, finds one inside an explanation string like
"from the courses table", and asks Postgres about a table called "the".

So:

- Every place that stated the semicolon cause as fact now says it is a guess, and says what was
  actually tried. That includes the retraction written into the first commit's entry below.
- The semicolon rule stays, because it costs nothing and might be right.
- `tests/sql-editor-safe.test.mjs` also fails now on `from`, `into`, `join`, `update` or `table`
  followed by a word inside a string literal in any verify file. Strings containing `%` are exempt,
  because those are LIKE patterns rather than prose. Files numbered 16 and below are grandfathered,
  so the rule binds what I write from here rather than rewriting history.
- `database/lms/17_verify_EDITOR.sql` is new and is **the one Big Sam runs**. Labels `check 1` to
  `check 41`, an empty note column, no comments at all. It is GENERATED from `17_verify.sql` rather
  than typed, so the two cannot drift, and a test asserts they hold the same check numbers.
- The 41 explanations live in `docs/lms/PHASE-6B-PLAIN.md`, one row per check number, which is
  where to look when a row says NO.

## PHASE 6B, 14 October 2026. The control room

The staff side of the Academy, at `/lms/studio`. Part A is `database/lms/17_control_room.sql`, Part
B is the thirteen pages on it.

Laid on `main` at `881d0d9`, on branch `academy-6b`, which already carries the first commit above.
No new dependency. The launch switch is untouched and still `false`.

**Nothing a learner sees changes.** File 17 adds staff functions and three columns to
`lms_courses`. The one existing behaviour it alters is what a live course lets you edit, and that
is loosened rather than tightened: words may now be fixed without taking the course down.

### Part A, file 17

| | |
|---|---|
| 1 | Course workflow. Create a course and it is born with its programme, its first module and an empty course exam, because a course missing any of those cannot be published and nobody can see why. Four states: draft, ready for review, published, archived. `lms_publish_checks` returns the nine checks, each with a fix-it target. |
| 2 | Course details: areas in order, recommend next, outcomes, audience, prerequisites, FAQ, and price behind its own administrators-only function. |
| 3 | Question banks: write, edit, retire. Paste from a sheet, judged row by row. Options and answers frozen once anybody has been served the question. |
| 4 | Learners, administrators only, every route. The list with five filters, the record through file 16's logged function, lift the wait, give and remove access with a reason. |
| 5 | Paths: create, order, certificate name. Publishing stays file 16's `lms_publish_path`. |
| 6 | Areas and tools, with counts. |
| 7 | Reports: active days, the funnel, per-lesson finishing, the hardest questions, and "Who our learners are" through file 16's suppression. |
| 8 | Certificates, searchable. Revoking stays in the Certificate console. |
| 9 | Popups: create as a draft, start, stop. One live at a time, enforced in the same statement. |
| 10 | Site settings, live with no release. |
| 11 | Health, the biggest tables, and an activity log nobody can edit. |
| 12 | Permissions: 47 functions revoked from everybody, granted back to signed in callers one name at a time, and **none to anon**. |

### Three decisions worth the space

**`lms_course_blockers` was left exactly as file 11 wrote it, and the nine checks got a new name.**
File 11's step 0 looks up that function's exact signature and refuses to run if it has changed.
Widening it to carry a fix-it target would have made file 11 unrunnable on this database for ever,
and nobody would have found that until the day they needed it. So the richer list is
`lms_publish_checks`, verify row 7 checks the old one is untouched, and file 11 was run again after
file 17 to prove it. The same call as `areaIconKey` against `areaKey` in the first commit: when a
name already carries a contract, add a name rather than redefine one.

**Check 7 would have deadlocked every facilitator.** File 10 says only an administrator may publish
a set of questions, which matches the brief. But if check 7 demanded *published* lesson checks, a
facilitator could never reach nine green ticks, because the last thing in their way would be an
action they are not allowed to take. So check 7 counts a check that exists and has a question in
it, and publishing the course publishes its checks. One deliberate act rather than fourteen.

**"Ready for review" is not a new enum value.** Postgres will let you add one inside a transaction
but not USE it until that transaction commits, and file 17 is one transaction that then writes
functions comparing against it. It is also the truer description: being sent is an event with a
sender, a time and a note, which is three columns an enum value cannot hold.

### Four things found by building it

**1. Nothing could publish a lesson check at all.** `lms_publish_exam` reads `serve_count`, which is
always null for a lesson check, and raises "No such exam". The table is behind RLS so no browser can
do it directly. A course could be built right up to the last check and stop there with nothing
explaining what to do next. Found only by writing the test that builds a whole course end to end;
every piece worked on its own.

**2. `lms_give_access` silently did nothing, while the log said it worked.** There is a partial
unique index allowing one live grant per learner per course, so giving a scholarship to somebody who
already held the free grant was a no-op, and the log line went in regardless. A silent no-op is
recoverable; a log that lies is what you later make decisions from. It upserts now, and the log
carries the old source.

**3. Two of my own permission tests were proving nothing.** psql connects as the table owner, and
row level security does not apply to an owner unless the table forces it, which ours do not. One
returned 0 and looked like a pass only because the table was empty; the other returned 32 and caught
it. Both now run under `set local role authenticated`, and under that a learner reads 0 exam
questions and 0 options.

**4. I overwrote the blog studio's stylesheet.** The control room was written into
`src/pages/Studio`, which is the blog tool's folder, and `studio.css` was replaced. Caught before
delivery by the lint run naming a file I had not written. Restored from git, and the control room
moved to `src/pages/Academy/Studio/` with its own `control-room.css`. Nothing of the blog studio is
in this package.

### Part B, the thirteen pages

Overview with the needs-you queue, Courses, the Course builder with its three steps and publish
panel, Checks and exams with the paste drawer, Learning paths, Areas and tools, Learners and the
learner drawer, Staff, Certificates, Reports, Site settings, Popups, Health and activity, plus the
command bar on Ctrl K and the phone tabs.

**The role is asked for, never read from the session.** A token says who somebody is and keeps
saying it for an hour; somebody taken off the staff list at 10:00 would still hold an
administrator's token at 10:30. Every page asks the database, and every page is refused again
underneath that.

**An administrator-only item is absent from the rail, not greyed out.** A disabled control tells
somebody what they are missing and invites them to ask why, about a page they were never meant to
see.

**The control room has no site header.** It is a full height tool: the rail is sticky at
`calc(100vh - 60px)` and the top bar at zero, and both assume they own the window. With the site
header above, the rail started 90 pixels down and ran 90 off the bottom. `SiteChrome` hides the
header and footer on `/lms/studio` only; every other page, including the blog studio, is unchanged.

### What passes

`npm test` runs **264**, all passing, of which 21 are the new `tests/control-room.test.mjs`.
`npm run build` is clean and lint is unchanged from `main`.

The database matrix on a fresh 01 to 16 build: **34 NO before file 17 with no Postgres error, three
runs of file 17 in a row clean, 40 of 40 yes after, 65 of 65 behaviour checks pass**, undo clean,
file 17 applies again afterwards. And the two that matter for not breaking what was there: file 16's
verify still says 57 of 57, and **file 11 still runs**.

In Chromium, eleven pages at 1440, 1100 and 390, in both roles: nothing scrolls sideways, the tables
scroll rather than clip, a facilitator is refused all six administrator pages and shown the five
they should see, and a suppressed group in a report draws no bar.

---

## PHASE 6B, FIRST COMMIT, 14 October 2026. The copy, and a rule for every SQL file

Laid on `main` at `881d0d9`, which is 6A merged. This is the copy Big Sam asked to carry into 6B
rather than open another 6A round, plus the SQL Editor rule and the test that enforces it. The
control room itself comes next, on its own brief.

No new dependency. The launch switch is untouched and still `false`.

### The semicolon rule

`16_verify.sql` failed in the Supabase SQL Editor with:

```
relation "the" does not exist
```

The same file ran cleanly in psql and cleanly through node-postgres. The Editor splits a script on
semicolons before sending it, to find where the last statement begins, and its splitter does not
know that a semicolon inside `'...'` is just a character. Two literals held one, so a statement was
cut in half and Postgres was handed the tail of an English sentence. The word it tripped on was
"the". The error names nothing real, which is what makes it expensive.

Big Sam found and fixed both. This package carries the same two fixes, made independently and
checked against his description, plus **two more of the same bug that nobody had hit yet**:

| File | Was | Now |
|---|---|---|
| `16_verify.sql` row 39 | the LIKE pattern ended `...(p_user);%'` | `...(p_user)_%'`, and `_` matches any single character |
| `16_verify.sql` row 43 | "Run it by hand with: select lms_prune_unconfirmed_signups();" | the same sentence without the semicolon |
| `12_verify.sql` row at line 96 | "if NO: select lms_set_health_token('...');" | the same without it |
| `16_restructure.sql` line 115 | a `comment on table` reading "...drawing on a chip; the drawings themselves..." | "...on a chip, and the drawings themselves..." |
| `show-test-course.sql` line 21 | a `--` comment ending in a semicolon | the same without it |

The last two matter less and are fixed anyway. `16_restructure.sql` has run in the Editor three
times without trouble, because a bad split only bites when the stray semicolon falls inside the
LAST statement, and that file's happened not to. That is luck, not safety: it changes the next time
anybody appends to the file.

**`tests/sql-editor-safe.test.mjs`** walks every `.sql` file in the repository character by
character, tracking whether it is in code, a string, a `--` comment, a `/* */` comment or a `$$`
body, and reports every semicolon that is not at statement level. Five of its eight checks test the
detector itself before it is trusted with the real files, including that it is not fooled by `''`
inside a string or by an apostrophe inside a comment.

### What the rule is, and what the evidence says

Big Sam asked for "never a semicolon inside a string literal or a comment". The first version of
the test enforced both, and it then reported **135 semicolons sitting in `--` comments across files
01 to 16**. Every one of those files has been run in the Editor, most more than once, and none has
ever failed on account of a comment. That is evidence the Editor strips comments before it splits,
which is the ordinary way to build such a splitter.

So the test is in two halves:

- **A semicolon in a string literal is refused in every file.** That is the one that demonstrably
  breaks, and all four are now fixed.
- **A semicolon in a comment is refused in every file written from file 17 onwards.** The files
  that already exist are grandfathered by name, in a list a third test proves can never gain a file
  numbered above 16. Rewriting 135 lines of comment in files already applied to the live database
  would be a large change that fixes nothing, and a large change that fixes nothing is how a real
  mistake gets lost in a diff. Any of them can come off the list the day somebody wants to tidy it,
  and the test will say where the work is.

`database/lms/tests/` is skipped by the comment half: those files make a learner, sit an exam and
roll the lot back, so they run on a local Postgres through psql and never go near the Editor. The
string half still covers them, because that costs nothing.

### The four copy items

| | |
|---|---|
| 1 | The closing dark band: **"Start with one skill this week."** |
| 2 | The sign up page's left column: **"Learn one skill at a time."** |
| 3 | The landing lead paragraph: "in the tools **and skills** data professionals use every day". This one is copy only, with no database change, because `lms_settings.subhead` defaults to an empty string and the page falls back to the sentence in `api/_seo-rules.js`. Unlike the headline in round 3, there is nothing in the database holding the old wording. |
| 4 | The goal chips above the rail now have their own icons for Databases and Research skills, instead of the four pane fallback. |

### Why item 4 needed a second map rather than one more entry

The chips took their icon from `areaKey`, which is the map that decides which picture is **painted**
on a course cover. Every key it can return needs an entry in `ART` and in `AREA_PAINT`, and there
are four of those. Adding Databases to it would have sent `ART["db"]` looking for a drawing that
does not exist, and taken the covers down to fix an icon.

So there is now `areaIconKey`, with all seven areas, used by the goal chips and the catalogue's area
filter. `areaKey` keeps meaning "what to paint" and keeps its four. The two are allowed to disagree:
an area can have a chip icon long before anybody draws it a cover, and Databases is exactly that
case. A test asserts `areaIconKey("Databases") === "db"` and `areaKey("Databases") === "x"`, so
neither can quietly become the other.

The mapping now exists twice, in `lms_areas.icon_key` and in `_cover-art.js`, because the landing
picker reads it from the database while the chips and the filter only have the course's area NAME to
go on. A test reads the seven seeded rows out of `16_restructure.sql` and fails if the two stop
agreeing, and checks each key has a drawing in `GoalIcon`.

### One thing left alone

Under "What do you want to do?", the four original chips read as goals: "Analyse data", "Build
dashboards", "Collect clean data", "Start coding". The three new areas have no goal wording, so
their chips read "Databases", "Qualitative" and "Research skills", which sits oddly under that
question. Three short phrases would fix it and they are Big Sam's words to choose, not mine.

### What passes

`npm test` runs **243**, all passing. `npm run build` is clean and lint is unchanged from `main`.

`16_verify.sql` after the correction, on a fresh 01 to 15 build: **52 NO before file 16 with no
error, 57 of 57 yes after**, which is what it said before. Row 39's pattern was mutation checked:
with the strip call in place it says yes, and with the call removed it says NO, so replacing the
semicolon with `_` has not turned a real check into one that always passes.

---

## ACADEMY 6A, ROUND 3, 13 October 2026. Big Sam's six

Laid on `main` at `de0c998`, which adds a timesheet change outside the Academy and touches none of
this package's files. Round 2 of 6A was approved; this is the six fixes from the review of it.

### 1. The nightly prune never deleted a real sign up

`lms_prune_unconfirmed_signups` kept any account whose profile had a name on it. The name is copied
off the sign up metadata by `lms_handle_new_user`, and the form will not submit without one, so
**every real account has a name from the moment it exists**. The test meant "keep anything a real
person made", which is the exact opposite of what the function is for. Of Big Sam's four accounts,
only the nameless one was ever deleted.

What that costs is not disk space. An unconfirmed account still holds the whole About you form in
`user_metadata`, because the answers only move into `lms_learner_profiles` when the email is
confirmed. Disability detail is in there. So the job was keeping sensitive personal data
indefinitely, with nobody's consent completed, which is the thing the 24 hour rule exists to stop
and which the NDPA 2023 does not allow.

The name is gone from the test. What keeps an account now is a phone number, a role above learner,
a participant link, an entitlement whose source is not `free`, an attempt, progress, a watch record,
About you answers or a certificate. All three profile conditions are things a trigger cannot do, so
each one really does mean a human touched the account.

Big Sam's case is now check 10e of `file_16_tests.sql`, with 10f as its control: an account that got
as far as typing a phone number must still be kept, or 10e could pass by deleting everything. 10h
and verify row 56 both read the function's own source and fail if the name comes back. That is also
why the function's comments no longer spell the column: the first version of this fix set off its
own check, which is the second time this round that `pg_get_functiondef` has matched my own prose.

### 2 to 6

| | |
|---|---|
| 2 | The landing page's **How it works** card said "a short quiz after each module". There are none. It now reads "A quick check after each lesson, and one exam at the end of the course, so you know it stuck", and the heading is **Watch, check, certify** rather than "Three steps, every lesson", because the certificate comes once per course. |
| 3 | After the FIRST failed exam the result offered only "Back to the course", so a learner with a try left was not told. It now offers **Try again**, which opens the rules, where the button already reads "Start my last try". It goes to the rules rather than straight into the questions: a second try begun by accident is a try spent. After the second fail the state is `waiting` rather than `open`, so nothing is offered, which is deliberate: a button that will not work for 24 hours is worse than no button. |
| 4 | The **path banner** came from `getPaths`, a second read, while `lms_public_landing` already returns the path. It now comes from the landing call. `getPaths` is gone from the page. |
| 5 | **Databases, Qualitative and Research skills** were all falling through to the four pane fallback, so three of the seven areas looked identical. They now have the concept's shapes: a cylinder, a speech bubble with lines, and a page with a folded corner. A test reads the seven seeded `icon_key` values out of file 16 and fails if any of them has no drawing. |
| 6 | **Step 17** sets `lms_settings.headline` to "Learn one skill at a time.", and only where it still equals file 02's default exactly, so a headline staff have written is never overwritten and the step is safe to run twice. The column default moves with it, and the undo puts both back the same way. Verify row 57. |

### What fix 4 costs, written down rather than discovered

`lms_public_landing` returns ONE path, the featured one. `getPaths` returned every published path,
and the compact cards that listed any OTHER paths below the banner have gone with it. Nothing
visible changes today, because there is one path. If a second is ever built and should show there,
the fix belongs in the database rather than in the page: have `lms_public_landing` return the rest
alongside the featured one.

### Still says tool, and left alone on purpose

The closing dark band reads "Start with one tool this week." It is hardcoded, not from
`lms_settings`, and it was not in the six. It is not wrong, but it now sits two screens under a
headline that says skill. Say the word and it changes.

### What passes

`npm test` runs **233**, all passing. `npm run build` is clean and lint is unchanged from `main`.

The database matrix on a fresh 01 to 15 build: 52 NO before file 16 with no Postgres error, three
runs of file 16 in a row with no error, **57 of 57 yes** after, **55 of 55** checks in
`file_16_tests.sql`, undo clean and the headline put back, file 16 runs again after the undo, 57 yes
again.

---

## ACADEMY 6A, 13 October 2026. The restructure, and the learner pages on it

Big Sam reshaped the Academy. Part A is the database under that shape. Part B is the thirteen
learner pages that sit on it. Part C is the tests. They come in together, because half of each is
useless without the other half.

Laid on `main` at `422aa9f` (PR #63, Phase 5 round 2). New branch `academy-6a` from `main`, in by
PR. Nothing is edited on `main`.

**Nobody is sent to the Academy yet.** `ACADEMY_PUBLIC` stays `false`. This package does not touch
it, and it does not touch `vercel.json`.

No new dependency.

### Part A, the database: file 16

One file, `database/lms/16_restructure.sql`, in one transaction, safe to run twice, with
`16_undo.sql` and `16_verify.sql` beside it. `docs/lms/ACADEMY-6A-RUN-ORDER.md` is the order to run
them in.

| | |
|---|---|
| 1 | `lms_areas` and `lms_course_areas`. Seven areas, and a course can sit in several. The one at position 1 is the main area and decides the cover. `lms_courses.area` stays, filled from the main area by a trigger, so nothing that reads it breaks. `lms_courses.kind` is `tool` or `skill`. |
| 2 | `lms_area_tools`. Every tool or skill an area teaches, including ones with no course yet, which is what the landing picker shows as "Coming soon". Exact names: MySQL, not SQL. |
| 3 | A path gets `certificate_name` and `programme_id`, so the Professional Certificate goes through `programmes` exactly as a course certificate does. `lms_publish_path` refuses while any course in it is unpublished or the path exam's bank is short. |
| 4 | `lms_lessons.chapters_text` keeps what was pasted; `lms_lesson_chapters` holds it parsed. `lms_parse_chapters` refuses a bad list with a message naming the line. |
| 5 | Every video lesson needs 100 percent, and so will every new one. `lms_lesson_watch_state` is where the player asks what speed and seeking are allowed: 1.5x and no seeking on a first watch, 2x and seek anywhere after it. |
| 6 | A missed check question returns the lesson, the chapter and its start second, never the right answer. The explanation is returned only when they were right. |
| 7 | No new module quiz can be made. The old rows and their attempts stay as history and are hidden from every learner function. |
| 8 | The course exam. One per course, 20 of a bank of 30, 40 minutes timed by the server, 70 percent, two tries then a day. `lms_exam_status` returns one of five states. |
| 9 | The path exam, same machinery: 40 of 60, 90 minutes. Opens only when every course certificate in the path is held. |
| 10 | `lms_learner_profiles`, the About you answers, with the skip logic as check constraints. |
| 11 | Nothing is stored until the email is confirmed, and the answers are then taken back out of `user_metadata`. |
| 12 | Disability is read one record at a time, by administrators only, and every read is logged. Totals under 5 come back as "fewer than 5". |
| 13 | `lms_course_next` and `lms_my_recommendations`, rule based, four reasons, never a course they hold. |
| 14 | `lms_popups` and `lms_live_popup`. The `place` check constraint cannot name a lesson, a check or an exam. |
| 15 | The catalogue and course page gain areas, kind and a chapter count. `lms_public_landing` draws the whole landing page in one call. |
| 16 | Permissions, named table by table rather than assumed. |

Three steps exist only because Part B needed them, and they are numbered where they belong rather
than appended: **5b** replaces `lms_open_lesson` so the player is handed the chapters, the furthest
second reached and whether seeking is allowed; **7b** replaces `lms_my_course` so the module quiz
rows are gone, `quiz_count` means the exam, and the page is told which paths the course counts
towards; **9b** adds `lms_my_path`, which draws the whole path page in one call.

### What Part A found, before Big Sam's review

**Five new tables were writable by any signed-in learner.** Supabase grants every new table in
`public` to `anon` and `authenticated` by default. I revoked it on the tables I was thinking about
and missed `lms_areas`, `lms_area_tools`, `lms_course_areas`, `lms_course_next` and
`lms_lesson_chapters`. The `anon` half was read only. The `authenticated` half was INSERT, UPDATE
and DELETE with no row level security, so a learner could have renamed an area, emptied the landing
picker, moved a course or rewritten a lesson's chapters. File 10's tidy pass does not catch it,
because it revokes write access from `anon` and these were granted to `authenticated`. Found by row
36 of my own verify file. All five now have RLS on, read for signed in users, writing behind
`lms_is_staff()`, and there is a test that tries it as a learner and gets 0 rows.

**An empty goals list was accepted.** The constraint read `array_length(goals,1) between 1 and 2`.
For an empty array `array_length` returns null, `null between 1 and 2` is null, and a check
constraint passes on null. The form cannot produce that answer; a replayed request can. Now
`coalesce(array_length(goals,1), 0)`.

**Passing the exam would never have issued a certificate.** I called
`lms_issue_course_certificate`, which does not exist: the real one is
`lms_claim_course_certificate`. Worse, I had wrapped the call in `exception when undefined_function
then v_cert := null`, so a learner would have passed, seen "passed", been handed nothing, and
nothing anywhere would have said why. The catch is gone, the real function is called, and
`lms_submit_exam` now returns `certificate_message` so the page can say what is missing when there
is no certificate.

**File 07's `lms_quizzes_one_owner` had to be dropped, not added to.** It says "a lesson or a
module", written before course exams existed. Left in place, every course exam and every path exam
would have been refused on the way in. The undo puts it back.

**The undo left the site with no catalogue.** It dropped `lms_public_catalogue` and
`lms_public_course` and stopped there, so every public Academy page went blank and file 16 then
refused to run again because its own readiness check could not find them. The undo now writes
file 14's versions back in full.

**An exam was being created already published with an empty bank.** File 07 refuses to publish a
question set with nothing in it, which is how this surfaced. Exams are created as drafts now, and
`lms_publish_exam` is the gate that checks the bank is at least 1.5 times a try.

### The eight fixes from Big Sam's review of 13 October

| | |
|---|---|
| 1 | **A learner with no entitlement could read an exam question and its explanation.** File 06's `p_q_public` and `p_quiz_public` policies let anyone signed in read a published question set's questions and options. They were written for the certification exams, which is a different gate. I proved it on a 01 to 15 database: as a learner holding nothing, I read a course exam's question text and its explanation. The policies are replaced so a quiz owned by a lesson, a course or a path is readable only through the start-the-exam function, and `lms_start_exam` and `lms_start_quiz` are the only way in. Verify row 37. |
| 2 | **`lms_prune_unconfirmed_signups` would have deleted paid accounts.** It took every unconfirmed account older than 30 days with no attempts and no progress. An entitlement was not in the list. `lms_handle_new_user` also grants the free courses to every new account, so a plain "has no entitlement" test matches nobody: the prune now refuses anything holding an entitlement whose `source` is not `free`. Verify row 44, a Node test, and a mutation check that the test fails when the clause is removed. |
| 3 | **The undo was leaving the site broken in two more ways.** It dropped `lms_lesson_watch_state` while file 14's `lms_open_lesson` still called it, and it left `lms_my_path` behind pointing at tables file 16 had changed. The undo now writes file 14's `lms_open_lesson` and file 15's `lms_my_course` back out in full, and drops `lms_my_path`. Verify rows 45 and 46. |
| 4 | **`lms_attempt_marks` could not be changed in place.** `create or replace` cannot change a function's return type, so file 16 failed on a database where file 06's version already existed. `drop function` first. Verify row 47. |
| 5 | **The verify file failed with an error instead of printing NO.** `'public.lms_learner_profiles'::regclass` and a bare `cron.job` resolve at parse time, so the whole file aborted on a database where file 16 had not run. Rewritten with `to_regclass` guards and `query_to_xml`. That is what the file is for: it must print 55 NOs before and 55 yeses after, and never an error. |
| 6 | **The disability total could be worked out by subtraction.** A breakdown that returns "fewer than 5" for one row and a real number for the rest, next to a grand total, gives the small number away. Every total in the same report is now suppressed when any one of them is under 5. Verify row 48. |
| 7 | **`ON CONFLICT` cannot use a deferrable unique constraint as its arbiter.** Two of the seed inserts did. Rewritten as a `where not exists`. |
| 8 | **`lms_my_course`'s exam read was ambiguous.** The OUT parameter is named `course_id`, which shadows the column, so the function parsed and then failed at run time on the first call. Every reference is qualified now. This is a class of bug, not one bug: the whole file was re-read for it. |

### Part B, the thirteen learner pages

| | |
|---|---|
| 1 | **The landing page.** Area tabs that WRAP, never a sideways scroller, and a tool key grid under them; pressing a key opens a panel inserted after the last key of that key's own row, with a tip pointing up at the key. A tool with no course says "Coming soon" rather than being hidden. "Explore by area" sits above the map. The goal rail slides itself every 4.2 seconds, stops the moment a pointer, a finger or the keyboard reaches it, stays stopped after a touch, and never moves at all for somebody whose system asks for no motion. It has no pause button, because it stops when you touch it. |
| 2 | **The catalogue.** Two toggles, Free to start and Under 90 minutes, and the sort dropdown is gone. A filter in the address is read once on the way in, so the three Quick picks columns can open it ready, and pressing a toggle does NOT rewrite the address, because a page per combination of filters is a page per combination for a search engine to find. |
| 3 | **The course page** carries its areas, its kind, its chapter count and the paths it counts towards. |
| 4 | **Sign up gets the About you questions**, with the skip logic the database enforces, as a form that does not ask what it does not need. Nothing is stored until the email is confirmed. |
| 5 | **The lesson.** The watch tape needs every cell; the 92 per cent line is gone. The chapters sit under the player and can be jumped to only once they have been reached, and how far that is comes from the database, never from the player. The speed list opens to 2x only after a full watch. The outline ends with the exam. |
| 6 | **The lesson check.** A missed question offers "Watch this part again" at the chapter it came from, and never says which option was right. Passing offers the next lesson BY NAME. |
| 7 | **My course.** No module quiz rows. One dashed Course exam row saying what opens it, with See the rules before it opens. The certificate checklist counts the exam. |
| 8 | **The exam page**, in three phases: the rules with the four numbers and the tries left, the sitting with the server's clock, and the result. A result never holds an option id, and a late submit is marked at the deadline. |
| 9 | **The path page** at `/lms/paths/:slug`. A course already finished in another path is ticked AND says which path it came from, so the tick does not look like a mistake. The path exam says how many courses are left. |
| 10 | **Recommendations on My learning**, each with the reason it was picked, and a line saying they are never from what anybody paid to show you. |
| 11 | **The certificate moment** offers what the course counts towards and the next thing, from the recommendations rather than from the catalogue, so it can no longer offer a course they have just finished. |
| 12 | **The one popup.** A card in the corner, not a sheet over the page: nothing behind it is blocked. It waits three seconds, and only if the tab is still in front. Four pages may have one, and a lesson, a check and an exam never may; the database refuses those places too, so it is said twice. It has no "do not show again" link, because how often it appears is set on the popup. |
| 13 | **The covers** carry the area and the kind. |

### The two notes from the round 2 review, and a third defect they led me to

1. **"KoboToolbox" was breaking mid word** in the hero rack at 1360 and 1024. A long name now takes
   a smaller size, worked out from its longest WORD rather than its total length, and the key grows
   rather than breaking. There is a test that fails if any name in the rack can break inside a word.
2. **At exactly 1024 the tick and the certificate tiles were cut off** by the right edge of the
   window. Every tile is now positioned so it stays wholly inside the viewport at every width from
   320 to 1600.
3. While measuring that, **a tile was sitting on top of the card's text** at 1180. Fixed, and the
   measurement pass now also fails if any tile overlaps anything on the card. Fifteen widths, real
   boxes from the browser rather than a reading of the CSS.

### And one hole in the launch switch, in my own new page

**The path page was emitting no robots tag at all while the Academy is private.** There are FOUR
public Academy pages now, not three: the landing page, the catalogue, a course page and a path page.
The first three carry `noindex, follow`, and `follow` is the whole point of that wording: it tells a
crawler to walk the links on the page, so that the day the switch flips nothing has to be re-earned.
One of those links is the path banner on the landing page, pointing at the path page. So the path
page was a way into the Academy that the switch did not cover, which is exactly what round 2 was
for. It now says the same as the other three.

Found by measuring, not by reading: seven pages at seven widths, reading the real robots tags out of
the browser. Two tests now cover it, one for the four public pages and one for the four pages behind
a sign in, which must stay `nofollow`.

**And a note in `api/_site-routes.js` said something untrue.** I had written that the edge function
knows how to write a path page's tags. It does not: `vercel.json` rewrites three Academy addresses
plus the sign up, and `api/academy-meta.js` has never heard of `/lms/paths/`. The note now says what
is true, and a test fails if either half of it stops being true.

### Part C, the tests

`npm test` runs **227**, all passing. 104 of them are new since `main` at `422aa9f`, which runs 123.

- `tests/signup-answers.test.mjs`, 40. Every branch of the skip logic, the lists the form offers,
  what is sent and what is not, the country and state lists checked against the database's own two
  tables, the nightly prune's refusal to touch an account somebody paid for (with a mutation check
  that the test fails when that clause is taken out), and a last test that reads
  `16_restructure.sql` and fails if the database stops saying the same thing.
- `tests/chapters.test.mjs`, 20. Every refusal names its line. A final test checks the SQL parser
  still refuses the same things in the same words.
- `tests/exam-state.test.mjs`, 18. The five states and their wording, the countdown, and the two
  that matter: an exam result never holds an option id, and a late submit is marked at the deadline.
- `tests/learner-pages.test.mjs`, 23. The promises that are about what a page must NEVER do: never
  a sideways row of areas, never an answer in a result, never a popup on a lesson, never a
  recommendation somebody paid for, never a filter in the address. Those are not things a screenshot
  catches, because the way they go wrong is that somebody later writes one more line, and the page
  still renders perfectly.
- `tests/cover-art.test.mjs` gains 3: the area and the kind on a cover, and the one that fails if
  any tool name in the hero rack can break inside a word.

`database/lms/tests/file_16_tests.sql` runs **52** checks against a real local Postgres, including
sitting the exam twice and being refused a third time, and the exact query the live check page runs.

The database matrix, run on a fresh 01 to 15 build: 50 NO before file 16 with no error, three runs
of file 16 in a row with no error, 55 of 55 yes after, 52 of 52 checks pass, undo clean, file 16
runs again after the undo, 55 yes again.

---

## PHASE 5 ROUND 2, 13 October 2026. Making main safe

On 9 October the `Excel-basics` branch was created from `lms-academy` rather than from `main`, and
PR #62 carried the whole Academy, Phases 2 to 4, onto `main` with it. The real dataleadafrica.com
has been serving the Academy since. This round does not revert that. It makes `main` safe where it
stands, and finishes the job there.

No database change. No new dependency.

### The launch switch

**One constant, `ACADEMY_PUBLIC`, in `api/_seo-rules.js`, set to `false`.** That file is the one
module both the edge functions and the React bundle already import, which is the whole reason it
exists, so there is one value and it cannot be half flipped. The launch PR changes that one line
to `true` and nothing else.

While it is false:

| What | Where it is done |
| --- | --- |
| The Academy band never shows on `/courses`, whatever the catalogue holds | `src/components/AcademyBand/component.tsx` |
| `/lms`, `/lms/courses` and `/lms/courses/:slug` carry `noindex` in the HTML a crawler is handed | `api/academy-meta.js` |
| The same three set `noindex` again once React starts | the three pages, through `<Seo>` |
| No `/lms` address is in the sitemap. Everything else still is | `api/sitemap.js` |
| A slim line at the top of every `/lms` page: "Preview. The Academy is not open to the public yet." | `src/pages/Academy/ui/PreviewNotice.tsx` |

**Canonicals are deliberately untouched.** `noindex` says "do not list this page". A canonical says
"when you do list it, this is its one address". Moving the second would mean every Academy address
changed on launch day, which is the one thing a canonical exists to prevent. A test asserts that the
canonical, the title, the description and the share picture are byte for byte the same at both
values of the switch, and that the robots tag is the only thing that moves.

**The notice has no close button**, because a notice that can be dismissed needs somewhere to
remember that it was, and somebody who dismissed it on Tuesday and comes back on Thursday now
believes the Academy is open. It is rendered once, inside the router's `page()` wrapper, so all
eleven `/lms` routes have it rather than eleven places to forget it. It is not in the HTML the edge
function writes and not in the share picture: a picture is cached for an hour and shared onwards for
much longer, so a "not open yet" picture would still be going round after launch day.

**The two halves say the same words.** The edge function writes `noindex, follow`, and `<Seo>` said
`noindex, nofollow`, which is right for a page behind a sign in and wrong for a page that is hidden
on purpose rather than private. `<Seo>` now takes a `robots` prop, the three public pages pass
`noindex, follow`, and a test reads the real response from the edge function and compares it with
what the pages say. Every other page that passes `noindex` is unchanged.

**Both values are really tested.** `tests/launch-switch.test.mjs` copies the whole `api/` folder to
a temporary place, rewrites that one line to `true`, and runs the sitemap and all three edge pages
against the copy. So the launch PR is proven before it is written.

### vercel.json

**Dr Ayoola's merged file, used exactly as supplied.** It is `main`'s file, with the Excel basics
rewrites that serve a live registration page, plus our four. The round 1 package's own `vercel.json`
was NOT used: it would have deleted the Excel basics lines and taken that page down.

**`tests/vercel-rewrites.test.mjs` is new**, and it fails if any of six rewrites goes missing:
`/sitemap.xml`, `/lms`, `/lms/courses`, `/lms/courses/:slug`, `/register/excel-basics` and
`/register/excel-basics/`. It also fails if the catch-all is not last, because Vercel takes the
first match and the catch-all matches everything, so anything after it is dead.

This is the test that would have caught 9 October. A missing rewrite is not an error. The build
passes, the deployment goes green, and the page simply becomes a different page: `robots.txt` went
on advertising a sitemap at `/sitemap.xml` that from then on returned the home page, and the three
public Academy pages were served the home page's title and description.

### Three fixes to the design update

**1. Nigeria and the glow on Abuja are out from behind the rack.** The picture was chosen for the
country picked out in orange and the ring of glow on Abuja, and on a desktop both sat behind the
frosted rack, with only a faint orange smudge coming through the frost.

From 1024 pixels up the rack is now given a width of its own and pushed to the right of its column,
which opens a clear band down the left of it, and the map is sized so that Nigeria lands in that
band. The map is pinned to the COLUMN, not to the rack, so narrowing the rack widens the band
instead of dragging the map along with it. That is why the rack became its own element,
`.acad-hero__card`.

The size is not a guess. The orange country is at x 170 to 260 of the picture's own coordinates and
the outer Abuja ring runs x 168 to 248, so with strokes the whole feature sits between 29.9 and 46.8
percent of however wide the map is drawn. 46.8 percent of the map therefore has to fit in the band,
and that is the sum in the stylesheet. Below 1024 the map may sit behind the rack exactly as before.

The soft glow now follows Nigeria rather than sitting in the middle of the box. Getting that right
turned up a trap worth writing down: **a custom property holding a percentage is substituted as
text**, so the same variable means the containing block's WIDTH inside `width` and `left`, and its
HEIGHT inside `top`. It put the glow 144 pixels above Nigeria, and the sum that produced it looked
perfectly correct. There are no percentages in that block now.

**2. The fourth floating tile is no longer a question mark.** A "?" in a white tile reads as a help
button, and people tap help buttons: the tile is decoration and does nothing. It is now the chart
from the concept, so the four are play, tick, chart, certificate, which is the concept's set and its
order.

**3. The rail's arrows are gone on a phone.** They were already switched on only under
`(any-hover: hover)`, which should have been enough and was not: a browser window narrowed to 390
pixels can still hover, so the next arrow sat on top of the second card, over the very thing it was
meant to help you reach. The rule is now said twice, `(any-hover: none)` for a real phone and
`max-width: 620px` for a narrow window, and both come after the `any-hover: hover` rule because
they have the same specificity and written above it neither would do anything.

Measured at 1600, 1360, 1180, 1024, 980, 900, 760, 620 and 390 pixels, with the real boxes: the map
clear of every piece of hero text, at least 10 pixels of air between Nigeria and the rack from 1024
up, the whole feature drawn and not clipped, no sideways scroll, and the arrows shown or hidden as
they should be at each width with a mouse and with touch.

### Tidying

- `CHANGELOG.md` and `PREVIEW-DATA.md` moved from the root of the repository into `docs/lms/`, and
  every link that pointed at them fixed.
- `database/lms/not-yet-run/` deleted. It held a second copy of file 10, which was run on the live
  database on 6 October, and a stale duplicate of a migration is one edit away from being the one
  somebody pastes into the SQL editor. `database/lms/README.md` no longer points at it.
- `docs/lms/PHASE-5-TEST.md` section 1 replaced. The test course already exists and was hidden on
  12 October, so section 1 is now one SQL file to run rather than a course to build.
- `database/lms/show-test-course.sql` added, holding that SQL, so the name the document uses points
  at something real. It runs as the first administrator inside one transaction, because the SQL
  Editor is not signed in and `lms_publish_course` refuses anybody who is not an administrator.
  Proved locally on PostgreSQL 16: it publishes, it is safe to run twice, it leaves nothing set
  afterwards, and it refuses with a clear message and changes nothing when there is no
  administrator or no test course.
- `docs/lms/STATUS.md` records what happened on 9 October and what it cost, and adds two standing
  rules: branch from `main` and come in by pull request, and merge a shared configuration file
  rather than replacing it. It says `lms-academy` is finished and can be deleted once this round is
  merged.

### The numbers

`npm run build` passes. `npm test` is 123 of 123, up from 103: 15 new for the launch switch, 5 for
`vercel.json`. Lint is unchanged from `main`: the same 3 errors and 7 warnings, all in files this
package does not touch.

---

## PHASE 5, 9 October 2026. The design update

Every course now has a cover, drawn in code from its own details. The landing page asks what you
want to do instead of listing three courses. No database change, and nothing the Phase 5 test
covers was touched, with one exception that is set out in full under **The certificate picture**
below.

### What was left out, and why

**Step numbers on the fan of covers in the learning path banner.** They were built, and every
corner they could sit in was already taken: the bottom right of a cover is where a long tool name
like "KoboToolbox" ends, the bottom left is where a short one like "STATA" starts, the top left is
the Data-Lead Academy line, and the one free corner on the back cover is underneath the cover in
front of it. A number sitting on top of the tool name is worse than no number. Nothing is lost:
the numbered list beside the fan is the part that is read aloud and the part you can click, and it
still says 01, 02, 03.

**The area art on thumbnails.** A square cover is about forty pixels wide, with the art at forty
percent opacity behind two large letters. At that size a thirty point scatter plot is not small,
it is invisible, and it was costing 2,250 characters of markup per thumbnail inside the HTML. The
twelve thumbnails on the landing page now carry the Academy's rings instead, at 500 characters.
The area is still unmistakable, because the background colour is the area's and colour is the part
that survives being shrunk.

**The landing page is 2 KB over one reading of the 40 KB budget.** Set out in full under **Page
weight** below, with both numbers and the one line that would close it.

### A. Every course has a cover

New file `api/_cover-art.js`, plain JavaScript with no imports, the same pattern as
`api/_seo-rules.js`: the React pages need it, `api/og.js` needs it, and the tests run it in plain
Node. One copy, so the picture on a card and the picture in a WhatsApp group cannot drift apart.

Four pieces of art, one per area, each drawing the work rather than a symbol of it: a scatter with
a fitted line for Analysis, bars with a trend over them for Visualisation, a form being filled in
for Data collection, lines of code for Programming. An area nobody has written art for gets a
constellation, which varies by course so that five courses in a new area are not five identical
cards.

Three rules the art obeys, each for a reason that has bitten real sites:

- **Shapes only, no words.** Every word on a cover is real HTML over the top, so it is selectable,
  translatable, read aloud correctly, and set in the fonts the page already loaded. A font that
  fails to load cannot turn a cover into a row of boxes.
- **No `id`, no gradient, no filter, no clipPath.** An `id` is global to the page, so twenty covers
  each defining the same gradient id would every one of them draw the twentieth. The background is
  a CSS gradient on the element instead.
- **Nothing from the database goes inside the SVG.** The slug only seeds the random numbers. The
  title, tool and summary never appear in it, which is what makes it safe to set as HTML. There is
  a test that pushes a `<script>` tag through every field and checks it comes out the other side.

The same slug gives byte for byte the same picture every time, in Node and in the browser, and
there are tests for both.

### B. Where the covers appear

Course cards, the tool rack readout, the course page buy card, My learning, the catalogue, the
learning path banner, and the share picture. The card was rebuilt around the picture: it opens with
the cover, then the title, a two line summary, one line of facts and the price. The tool chip is
gone from the card because the cover says the tool, and the "Module 1 free" tag moved onto the
cover where it is seen before the price rather than after it.

On My learning the cover is found by looking the course up by slug in the public catalogue, which
that page now also fetches. No database change. A course that has since been unpublished is not in
the catalogue and gets the neutral art rather than a hole, and nothing on the page waits for it or
moves when it arrives.

### C. The landing page

"Latest courses" showed three cards and a link. It is now **What do you want to do?**: a row of
goal chips built from the data, counts and all, and a rail holding every published course, newest
first. Add a course in a new area and a chip for it appears with the right number on it; an area
with no published course has no chip, because a filter leading to an empty rail is a dead end.

Pressing a chip does not change the address. Someone who presses three chips and then presses Back
expects to leave the Academy, not to walk back through their own filtering; the catalogue at
`/lms/courses` is the page with real, linkable filters.

The arrows on the rail appear only where something can hover, using `any-hover` rather than `hover`
so a laptop with a touchscreen still gets them. On a phone there are dots instead, and the rail is
moved with a finger.

Below it, **Quick picks**: Free to start, Newest, Under 90 minutes. A column with fewer than two
courses hides, and the whole section hides below four courses, when it would just be the rail above
written out again. There is no "Popular" column and there will not be one: we do not count
enrolments on the public site, so the word would be one we made up on the page a stranger trusts
least.

The first learning path becomes a banner with its first three covers fanned out beside it. Any
other paths keep the compact cards.

### D. The catalogue

Picture cards, from the same component, and each area filter now carries a small square of that
area's own colour so the filter and the cards it produces are plainly the same thing. The colour is
never the only signal: the area's name is beside it.

### E. Page weight

Measured in a real browser, with six courses, before and after, in the same session.

| | before | after | change |
|---|---|---|---|
| `/lms` every file, uncompressed | 1830.9 KB | 1873.0 KB | **+42.0 KB** |
| `/lms` the HTML itself, uncompressed | 24.9 KB | 53.3 KB | **+28.3 KB** |
| `/lms` what a visitor downloads | 758.8 KB | 771.6 KB | **+12.8 KB** |
| `/lms/courses` every file, uncompressed | 1801.0 KB | 1796.2 KB | **-4.8 KB** |
| `/lms/courses` the HTML itself | 23.9 KB | 38.3 KB | **+14.3 KB** |
| `/lms/courses` what a visitor downloads | 735.9 KB | 723.5 KB | **-12.4 KB** |

The budget was 40 KB on the landing page before compression. **On the HTML that is +28.3 KB and
under. On every file added together it is +42.0 KB and 2 KB over.** Both numbers are uncompressed,
so which one the budget meant decides it, and I would rather give you both than pick the flattering
one.

What the +42.0 KB is made of:

| | |
|---|---|
| the HTML, mostly the covers themselves | +28.3 KB |
| `africa-dots.svg`, the map behind the hero | +11.8 KB |
| the three new components' CSS and JavaScript | +14.0 KB |
| the mark, fetched once and then cached for the whole site | +4.4 KB |
| smaller bundles elsewhere, and one import removed | -16.5 KB |

**If you want it under 40 KB on the strict reading, the one line is to drop the map.** That is
11.8 KB uncompressed and the page is immediately 10 KB inside the budget. It is only 0.6 KB over
the wire, though, because a field of repeated dots compresses to almost nothing, which is why I
have not dropped it on my own judgement.

Four things made it smaller along the way, each a real improvement rather than a trick:

- The landing page was pulling in `lib/learn`, the learner area's whole data layer, because the
  path banner imported one word-pluralising helper from it. Four kilobytes of code for pages the
  visitor has not opened. The same helper exists in `lib/courseSeo`, which the page already uses.
- The graph paper inside every cover moved to CSS, where a background belongs. It was 290
  characters of identical markup inside each one.
- Thumbnails stopped drawing art nobody can see, as above.
- Coordinates are whole numbers. The art is drawn in a 320 by 180 box and scaled up, so half a
  unit is a sixth of a pixel on a card: not a difference anybody can see, and two characters on
  every one of about forty numbers per cover.

Structured data: the `Course` entry now carries `image`, pointing at `/api/og?course=<slug>`, the
same address the `og:image` tag already used, so there is one picture and one cache entry. The edge
function already wrote `og:image:width`, `og:image:height` and `og:image:alt`; I checked rather
than adding them twice. Nothing about the snapshot, the canonicals, the sitemap or robots changed.

### F. The awkward cases

A course with no area and no tool, an eighteen character tool name, one course on its own, and a
screen 390 pixels wide. All checked in a real browser, and all in the test harness:

- no area and no tool gets the neutral art and its two letters
- "Advanced Excel 365" is too long to read on a cover, so it becomes the two letter code
- one course means no arrows, no dots, and no Quick picks section at all
- no cover's words overflow its cover at either width
- no page scrolls sideways at 390
- the same slug gives the identical SVG in Node and in the browser

### G. The mark and the icons

`dla-mark.webp` is at `public/brand/`, used through one CSS class in `src/css/dla-mark.css`, which
every component that uses it imports. One file, because the Academy and the certificate pages do
not share a stylesheet and a class defined in a file one of them never loads is a class that
silently does nothing there.

It appears on every cover's label, on the landing and account page eyebrows in place of the pulsing
dot, on the certificate rows in My learning, and in front of the issuer line on a certificate page.
It is always `aria-hidden`: the words beside it always say Data-Lead. On the orange Programming
covers it sits on a white pill, because it was not drawn to sit on orange.

Three new icon files, all the mark on white so it reads on a dark tab bar as well as a light one:
`public/favicon.ico` (16, 32 and 48 in one file), `public/apple-touch-icon.png` (180), and
`public/icon-192.png`. All three are listed in `index.html`. **`public/logo.svg` is unchanged** and
is still what a modern browser uses.

### H. The map behind the hero

`africa-dots.svg` at `public/academy/`, kept exactly as you sent it. The dots were generated by a
script that sampled an outline onto a ten pixel grid, which is why it is one very long path and not
something to edit by hand; there is a comment in the CSS saying so.

It is decoration and it says nothing: no city names, no numbers, no claim about where anybody is
learning. A decorative `img` with width, height, empty alt, `aria-hidden` on its holder,
`decoding="async"` and `fetchpriority="low"`.

The tool rack in front of it is frosted, white at 82 percent with a small blur, so the dots read as
a texture while the tool names stay at full contrast. A browser that cannot frost gets the opaque
card it has today rather than text on top of a pattern.

Four small white tiles float at the corners of the rack, two on a phone. Each repeats something the
words already say, so all four are hidden from screen readers, and they stop moving entirely when
somebody has asked for less movement.

**The map is positioned inside the rack's own column, not across the hero.** That is what keeps it
off the headline at every width: it cannot reach the words because it is not in their half of the
page. The first version placed it at "33% of the hero", which looked right at the width I chose it
at and slid under the headline at others. Checked at 1360, 1024 and 390, against every piece of
text in the hero rather than a list of four I had to remember to keep up to date.

### The certificate picture, which is the one thing I touched outside the Academy

`api/og.js` draws both the course share picture and the certificate share picture. Redrawing the
course half meant editing that file, and two faults in it came out:

**It could not draw the mark.** Built in as the WebP the pages use, which that renderer cannot
decode. It threw, and every course quietly fell through to the plain certificate card. The build
passed, the types passed, every other test passed. Fixed with a PNG of the same mark, and there is
now a test that renders the real thing and fails if a course card comes back smaller than a course
card could possibly be.

**The fallback in that file had never worked, and the cache header said two different things.**
`ImageResponse` draws lazily, so the `try`/`catch` around it caught nothing: the response had
already gone out with a 200 and the drawing then died part way through sending, which is a blank
preview. Waiting for the finished bytes inside the `try` fixes it. The same change fixed a header
that read `max-age=31536000, public, max-age=3600, s-maxage=86400`, because the renderer appends
its own rule to ours. A cache takes the first one, so these pictures were being kept **immutable
for a year** instead of a day: a certificate revoked afterwards would have gone on showing its old
picture.

**The certificate picture itself is unchanged.** I rendered all four of its states before and after
and compared the bytes: identical, all four. What changed for certificates is that their cache
header is now the one the code always asked for, and that a drawing failure degrades instead of
breaking. If you would rather hold even that back, it is `api/og.js` on its own and I can send a
version with only the course half changed.

---

## PHASE 4 REVIEW ROUND, 9 October 2026

Your three items, plus one thing I found underneath the first.

### What was left out of this round, and why

Nothing. The standing section stays, and it is empty this time.

### 1. SERIOUS. A lesson could not be finished above 1x

You were right in every detail, including the arithmetic. Reproduced with Playwright's fake
clock, so with no timer jitter at all, on the same 8 minute, 48 slice, 92 percent lesson:

```
1     47 of 48,  97.92%  OPEN     missing 0
1.25  38 of 48,  79.17%  LOCKED   missing 0, 4, 9, 14, 19, 24, 29, 34, 39, 44
1.5   31 of 48,  64.58%  LOCKED   missing 0, 2, 5, 8, 11, 14, 17, 20, 23, 26, ...
2     26 of 48,  54.17%  LOCKED   capped to 1.5x, same every-third pattern
```

Every fifth at 1.25x, every third at 1.5x, and slice 0 missing at every speed. `onTick` counted
ten seconds of **wall** time and sent one slice numbered from the playhead, so at 1.5x, where
ten wall seconds is fifteen video seconds, a third were never sent. Slice 0 was never sent
because the first send happened ten seconds in, by which time the playhead was in slice 1.

The only place my run differs from yours is 1x, and that difference is the real problem: with a
perfect clock it reaches 97.9 and opens, with real jitter it reaches 91.67 and does not. **At 1x
it passed or failed depending on how busy the phone was**, which is worse than failing outright
because it would have looked fine in testing.

| Changed | What |
| --- | --- |
| `src/pages/Academy/Learn/Player/slices.js` (new) | The arithmetic, on its own, in plain JavaScript so the package's own test can run it with no browser and no new dependency. `slices.d.ts` is the typed doorway, the same pattern `api/_seo-rules.js` already uses |
| `Player/page.tsx` | The tick sends **every slice the playhead crossed** since the last tick. A move further than playing could manage is a seek and credits nothing for the gap. Slice 0 goes when play starts; the final slice goes on the ENDED event, because the last slice is usually a part of one and the playhead can stop inside it without any tick seeing the boundary |
| `Player/page.tsx`, `ui/WatchTape.tsx`, `Learn/MyCourse/page.tsx` | Coverage is rounded **down** wherever it is printed. 91.67 rounds to 92, and "you are at 92%" beside a locked button that opens at 92% is the page calling the learner a liar about their own screen |
| `database/lms/15_learning_pages.sql` | The throttle is now `ceil(60 / bucket_seconds * 1.5) + 3`, which is 12 at ten second slices, rather than `(60 / bucket_seconds) + 3`, which was 9. Honest 1.5x produces exactly 9 a minute, and because the window is rolling the busiest minute actually holds **10**, so real watching was being thrown away at a speed the player itself offers |
| `tests/watch-slices.test.mjs` (new) | 18 tests. A whole lesson at 0.75x, 1x, 1.25x and 1.5x must each reach 100 percent and open, with and without a phone that cannot keep time |
| `database/lms/tests/file_15_tests.sql` | Tests 48 and 49: an honest 1.5x minute is never refused, and a script is still refused |
| `database/lms/15_verify.sql` | Row 23, on the throttle. 23 rows now |
| `docs/lms/PHASE-5-TEST.md` | 4.3c and 4.3d: watch a whole lesson at 1.5x, and another at 1.25x, and both must reach 100 percent |

**On what the throttle change concedes.** It is the only thing making a faked watch take about
as long as a real one, and 12 instead of 9 makes a fake a third faster. That is exactly the
speed up an honest learner already gets from the 1.5x the player offers, so it concedes nothing
that was not already conceded. The limit now says what it always meant: nobody may record
faster than somebody genuinely watching at the fastest allowed speed.

### The thing underneath it: the offline queue was throwing away the backlog

Chasing your jitter point led somewhere worse.

**`lms_record_watch` does not fail when it throttles. It answers normally, with the coverage
unchanged.** The queue treated "answered" as "stored" and deleted its own copy.

While playing that is nearly invisible, because only one or two are ever in flight. On reconnect
it is a disaster: somebody who goes through a tunnel comes back with thirty slices queued, the
queue fires them off as fast as the network allows, the database stores a dozen and ignores the
rest, and the queue deletes all thirty. **The feature whose entire promise is "nothing is lost"
would have lost almost everything in the one situation it exists for.**

`useWatchQueue` now keeps to the same rate the database accepts, with the number defined once in
`slices.js` beside a note saying it mirrors the SQL. A backlog drains at the speed of an honest
1.5x watch, the retry comes back every five seconds instead of twenty so it actually drains, and
the page says "Catching up on 23 parts you watched while the connection was down". Measured end
to end on the real page: **two minutes offline mid lesson, 48 of 48 slices survived.**

### One older test had to change

File 11's N8 asked for 12 slices and required fewer than 12 back, so it was testing the constant
rather than the rule and failed the moment the limit became 12. It bursts 40 now, which no
player at any allowed speed could produce in a minute, so it tests the thing it is named after
and survives the limit being tuned again.

### 2. The test script started in the wrong place

`PHASE-5-TEST.md` began with file 15. File 14 has never been run on the live database either,
and it is the one that closes the two leaks. The first section is now a table: file 14, then
`14_verify` (20 rows, all yes), then file 15, then `15_verify` (23 rows, all yes), with a line
saying to stop if rows 1 or 2 of `14_verify` say NO, because those are the leaks.

### 3. The quiz rules contradicted the waiting card

While the quiz is waiting, the four rule tiles are dimmed and greyed, the fourth reads "3/3
tries used" rather than "3, tries then a day's wait", and on a phone the waiting card comes
**first**. Dimmed rather than removed, because they are still the answer to "what am I coming
back to". Added to the test script as 6.10b.

### What was checked

| | |
| --- | --- |
| `npm run build` on top of `main` `d02c86b` | passes |
| Node tests | **76 pass, 0 fail** (was 58) |
| Database, files 01 to 15 | **255 pass, 0 fail** across seven suites |
| `15_verify.sql` | **23 rows**, all yes |
| Test 48 against the old throttle | FAILS, with "The throttle threw real watching away" |
| The new watch tests against the old player | FAIL at 1.25x and 1.5x |
| A whole lesson on the real page at 1x, 1.25x, 1.5x and 2x | **48 of 48 slices, 100%, OPEN** every time |
| Two minutes offline mid lesson | **48 of 48 slices survived** |
| Browser: the six pages and Part C | 73 checks, all pass |

---

## PHASE 4, 8 October 2026. The part where people learn.

Database file 15, then the six pages. The database went first because the pages needed several
things it could not give them, and because two of its rules would have trapped learners.

### What was left out of this phase, and why

The standing section. It is not empty this time.

| Left out | Why |
| --- | --- |
| **The concept's bootcamp wording.** The My learning tab shows a notice reading "Your bootcamp access is open, so every course is free to you", and a pass card reading "Every course is free while your bootcamp enrolment is active" | Your standing rule is "never say anything about bootcamp emails or who gets free access", and it has been repeated in three briefs. The pass card built in Phase 2 says "Your bootcamp enrolment is active, so the courses it covers are open to you", which is true of what the server actually granted and promises nothing about any other course. I kept that and did not adopt the concept's stronger line. **Say so if you want the concept's wording instead** |
| **The "Active learner / Brand new" switch** on the My learning tab | It is a device for showing you two states in one HTML file. On the real page the state is whatever the learner actually has |
| **The welcome video on `/lms`** | `lms_settings` has had `welcome_provider`, `welcome_ref` and `welcome_seconds` since file 02 and nothing has ever read them. It was not in this brief and it is not in the concept's landing tab, so it is still unread. It is a small Phase 6 job |
| **A short answer question type** | `lms_questions` supports `short_text`, and `lms_start_quiz` correctly returns it with no options. No course has one, and the marking is a string comparison that needs thinking about before it is put in front of anybody. The question renders with a line saying it cannot be answered here and to tell the tutor, rather than as a broken empty box |

### The two traps, which were live faults

Both are reachable by an ordinary learner having an ordinary bad day, and the only way out of
either was somebody writing SQL against the live database.

**A lesson check locked the course for ever.** `lms_create_quiz` gives a check a 100 percent
pass mark, which is right, and 20 tries, which is not. `lms_start_quiz` returns an empty table
once the tries are used, and with `retake_after_minutes` at 0 there is no reopening clause at
all. So the twentieth wrong answer on three questions meant `lms_complete_lesson` refused the
lesson, `lms_is_lesson_unlocked` refused the next one, and the course could never be finished.
The learner saw a button that did nothing and no explanation anywhere. **A check now ignores the
try limit completely.**

**A module quiz locked the certificate away for ever.** Three failed tries and the same thing,
permanently. **It now reopens 24 hours after the last try, with a fresh set of tries.** The wait
is the point: it sends somebody back to the lessons rather than guessing again.

### Database file 15

| | What |
| --- | --- |
| `lms_my_course(slug)` | **new.** One call for a whole learning page: the ring, the resume target, every module and lesson with its state, each quiz's status, the certificate |
| `lms_quiz_status(quiz)` | **new.** `lms_start_quiz` returns nothing for six different reasons, so a page could only say "something went wrong". This says which, in a sentence written for a person |
| `lms_start_quiz` | **replaced.** The two rules above |
| `lms_attempt_marks` | **replaced.** It had the rule backwards in both directions at once: it marked every question for any submitted try, module quizzes included, which is solvable by elimination across three tries; and it showed the explanation only when the answer was **right**, which is the one time nobody needs it. Now: a check gives everything, a module quiz gives nothing until it has been passed |
| `lms_record_watch` | **replaced.** It stored `greatest(old, new)` as the position, so somebody who rewound to re-watch a hard part and stopped there was sent back to the furthest point they had ever reached. It stores the latest position now. It also counts new slices into the day |
| `lms_watch_days` | **new table.** One row per learner per day. The This week chart cannot be counted from the slices, because `lms_progress_tidy_up` deletes a lesson's slices the moment it is completed: the harder somebody worked, the less the chart would show |
| `lms_my_week()` | **new.** Seven rows, always, today last |
| `lms_my_courses()`, `lms_my_certificates()` | **new.** The whole of `/lms/me` in two calls |

Plus `15_verify.sql` (22 rows at the time, 23 after the review round), `15_undo.sql`, `15_test_course.sql`'s successor in
`docs/lms/PHASE-5-TEST.md`, and the tests.

### Three things I found while writing file 15

**My own version of the bug I was fixing.** The first `lms_quiz_status` reported `tries_used: 0`
and `tries_left: 3` on a quiz that was shut, because three tries divide exactly by three and I
was reading the remainder. A page built on that would have shown "3 tries left" above a button
that refuses to work. Test 46 caught it; it is fixed in both places that do the arithmetic.

**`lms_watch_days` could be written to by any signed in learner.** Not through a policy, there
is none, but Supabase's default privileges hand `INSERT`, `UPDATE` and `DELETE` on every new
public table to `authenticated`, and `lms_tidy_table_privileges` only takes those back from
`anon`. Row security refused the write anyway, so nothing was exploitable, but a table whose
whole job is to be a record the learner cannot fake should not depend on one policy being
present. The grants are revoked explicitly now, and `lms_watch_buckets` was in the same state
and got the same treatment.

**`15_undo.sql` would have run even while refusing.** The guard raises an exception, which in
the Supabase editor rolls the whole script back, so it works where you use it. Run through psql
it printed the refusal and then carried on undoing. File 15's undo is wrapped in a transaction
so it refuses either way. **Files 10, 11, 13 and 14 have the same shape**; I have not touched
them, and it is in STATUS.md.

### The pages

| Address | What |
| --- | --- |
| `/lms/learn/:slug` | My course: the ring, one resume button to the exact lesson and second, the modules, the certificate checklist, the week tape |
| `/lms/learn/:slug/:lessonId` | The player |
| `/lms/learn/:slug/quiz/:quizId` | The module quiz: intro, one question at a time, review, result |
| `/lms/learn/:slug/complete` | The certificate moment |
| `/lms/me` | The full bento |

All four learning pages are behind `RequireAccount`, carry `noindex`, are registered in
`api/_site-routes.js` as deliberately out of the sitemap, and hide the site's floating WhatsApp
button through the `focus` prop `AcadStage` already had.

**The player keeps four rules, and each one has a reason:**

- **One slice every ten seconds of real playing.** Not of wall clock: a paused video records
  nothing, and the slice index comes from the position in the video, so a slice can only be
  credited for a part that was actually on screen.
- **First watch: no running ahead.** Going back is always allowed, and so is going forward over
  ground already watched. Only running past yourself is refused, with a line saying so rather
  than a silent jump.
- **First watch: 1.5x at most.** This is arithmetic, not a preference. `lms_record_watch`
  refuses more than nine slices a minute as script-like and a player at 2x sends twelve, so a
  quarter would be thrown away and the lesson would never open. The cap is enforced against
  YouTube's own speed menu too, not just ours.
- **A slice that does not get through is kept**, in a queue mirrored into this browser so it
  survives the tab closing, and sent when the connection comes back. Sending the same slice
  twice is safe by design, which is also what makes two tabs harmless.

### Three bugs only a browser could find

**The player took the whole page down.** YouTube's API does not fill the element you hand it, it
**replaces** it with an iframe. React then tried to remove a node that was no longer there and
threw `The node to be removed is not a child of this node`. It fired on any re-render that
swapped the player out, which includes the message for a video that will not play, so the
handle-a-broken-video-gracefully path was itself a crash. React now owns an outer frame it never
looks inside, and the inner div handed to YouTube is created by hand.

**The certificate would have said "This certifies that learner".** `getSession().fullName` falls
back to the part of the email before the at sign, which is right for a greeting and wrong on a
certificate. The card reads `lms_profiles.full_name` now, the same field
`lms_claim_course_certificate` writes into the register, so the two always agree. A blank one
says "Add your name" in grey italic rather than printing a guess.

**A flex gap split a sentence.** The gate read "You are at **52%** ." with the full stop floating
off on its own: the paragraph is a flex row so the tick can sit beside the words, and a flex
container puts its gap between every child, bare text nodes included.

### One Phase 3 fault this phase repeated and fixed

`.acad-chip` lived in `CourseCard.css`. The learning pages use it and never load that file, so
it would have arrived unstyled, which is exactly the trap found on the course page in Phase 3.
It has moved into `academy.css`, where anything used by more than one page belongs.

### What was checked

| | |
| --- | --- |
| `npm run build` on top of `main` `d02c86b` | passes |
| Node tests | **58 pass, 0 fail** |
| Database, files 01 to 15 | **253 pass, 0 fail** across seven suites |
| File 15 before it is applied | **9 pass, 36 FAIL**, with the four traps named in words |
| `15_verify.sql` | 22 rows, all yes. 19 say NO beforehand. A 23rd was added in the review round |
| `15_undo.sql` | refuses while guarded, undoes properly when changed |
| File 15 run twice | 47 still pass |
| Browser: the six pages and Part C | **73 checks, all pass**, at 1360px and 390px |

---

## PHASE 3 REVIEW ROUND, 8 October 2026

Your six items, plus three things I found while fixing them. Everything below is on top of the
Phase 3 package, not instead of it.

### What was left out of this round, and why

Nothing. You asked me to list anything I leave out and say why, so this section stays here and
stays honest. It is empty for this round.

### 1. SERIOUS. A course page told Google it did not exist whenever Supabase was asleep

`getCourse` returned nothing both for "no such course" and for "the call failed", and the handler
treated nothing as not found, so a slow, down or paused Supabase produced a 404 with `noindex`.
The free plan pauses after a week without visitors, so one quiet week and a crawl would have
dropped every course from the index.

| Changed | What |
| --- | --- |
| `api/_academy-data.js` | `callRpc` and the new `callRest` return `{ ok, data }`. `getCourse` now has three answers: a course, a real empty reply, and could not ask |
| `api/academy-meta.js` | 404 with `noindex` **only** when Supabase replied with no row. Any failure serves the ordinary page: 200, no `noindex`, `s-maxage=30` and no `stale-while-revalidate` |
| `api/sitemap.js` | the same idea: a shorter cache when the courses are missing |
| `src/lib/catalogue.ts` | `getCatalogue` returns `{ ok, courses }`; `getCourse` keeps its three way answer |
| `src/pages/Academy/Courses/page.tsx` | **not in your list.** The catalogue showed "The first courses are on their way" when it could not reach the database, which sends a reader away believing the Academy is empty. It now says it could not load them, with a try again button |
| `src/components/AcademyBand/component.tsx` | only a successful answer sets the count, so a failure hides the band rather than claiming a number |
| `tests/academy-meta.test.mjs` | four new tests: slow, down, a paused project answering 503, and a genuine missing course. Written against the old code first, where three of the four failed |

### 2. One address, everywhere

| Changed | What |
| --- | --- |
| `api/_seo-rules.js` | `SITE_ORIGIN = "https://dataleadafrica.com"`, plus `siteUrl` and the new `siteAsset` |
| `src/lib/site.ts` | imports it rather than declaring it |
| `api/academy-meta.js`, `api/sitemap.js`, `api/og.js` | every canonical, `og:url`, `og:image`, structured data url and sitemap `loc` comes from it |
| `tests/seo-agreement.test.mjs` | fails if any of those files grows its own copy, and checks the `Sitemap:` line of `robots.txt` |
| `tests/academy-meta.test.mjs` | sends a request with the `dataleadweb-frontend.vercel.app` host and fails if that string appears anywhere in the answer |

The edge still fetches its own `index.html` from the host it is running on, which is correct: a
preview deployment has to read its own files.

**Found while doing it, not in your list.** `siteUrl` strips the query string, which is right for
a canonical and was silently removing `?course=` from every `og:image`, so every course was
sharing the generic picture rather than its own. There are two helpers now, `siteUrl` and
`siteAsset`, with a test showing the difference.

### 3. The buy card for signed in people

`src/pages/Academy/Course/BuyCard.tsx`, `BuyCard.css` and `Course/page.tsx`.

A fifth state, `waiting`. The page now calls `lms_has_course_access` for anybody signed in
looking at a paid course:

| Who | What they see |
| --- | --- |
| Has access | "Continue learning", to `/lms/me` until Phase 4 |
| Signed in, no access, paid, payments closed | The price, "Online payment opens soon", and "Try module 1 free" when `first_module_free`. **No** "Create an account" |
| Signed out | "Create an account", as before |

A free course is open to anybody signed in, which is the database's rule in `lms_lesson_is_open`,
so the page does not ask about those. While the answer is on its way, a signed in person sees the
middle row, so the button never changes under them from wrong to right. The same on the phone
bar, because it is the same component.

Still nothing about bootcamp emails or who gets anything free, and there is now a browser check
that reads the whole page and fails if it ever says so.

### 4. Two copies of the structured data

| Changed | What |
| --- | --- |
| `api/academy-meta.js` | its JSON-LD scripts carry `data-edge="1"` |
| `src/components/Seo/component.tsx` | removes anything carrying that mark before adding its own |
| `src/pages/Academy/Courses/page.tsx` | **found by the check:** the catalogue had a visible breadcrumb and no `BreadcrumbList` in its markup. It has both now, on both sides |
| `api/academy-meta.js` | one `breadcrumbJsonLd` builder for both pages, instead of the trail being written out inside the course builder |

The browser check is new and lives with the other checks, outside the repository. A Node test
only ever sees what the edge wrote, so nothing but a real browser can see a duplicate that only
appears after React runs. It loads all three pages in Chromium and counts the blocks before and
after.

### 5. The two things the brief asked for that were missing

**a. The landing headline and subhead from `lms_settings`.**

| Changed | What |
| --- | --- |
| `api/_seo-rules.js` | `LANDING`, `CATALOGUE`, `NOT_FOUND` and `landingWords`, so the words exist once rather than twice |
| `api/academy-meta.js` | imports them instead of declaring its own |
| `src/lib/courseSeo.ts` | the typed doorway onto them |
| `src/lib/catalogue.ts` | `getSettings` |
| `src/pages/Academy/Landing/page.tsx` | reads the headline, subhead and announcement, with the current words as the fallback |
| `src/pages/Academy/Landing/page.css` | the announcement line |

The `<title>` and `<meta description>` deliberately do **not** come from the database. They are
the two lines a search engine weighs most, and a mistyped headline in the Phase 6 control room
should not be able to move the Academy down the results. There is a test.

The landing title and description had been written out twice, once in the page and once in the
edge function, as two constants that happened to match with nothing checking them. That is gone.

**b. Learning paths.**

`src/lib/catalogue.ts` gains `getPaths`; `src/pages/Academy/Landing/page.tsx` and `page.css` gain
the section. Built from published `lms_paths` and `lms_path_courses`, in `position` order. A
course inside a path that has since been unpublished is dropped, because a path must never link
to a page that is not there, and a path left with no courses disappears. The whole section is
absent when there are none.

### 6. The polish

| | Changed | What |
| --- | --- | --- |
| a | `Course/BuyCard.tsx`, `BuyCard.css` | "Online payment opens soon" is inside the phone bar, under the price, instead of floating above it over the page |
| b | `ui/Breadcrumb.tsx` and `.css` (new), `Courses/page.tsx`, `Course/page.tsx`, `Courses/page.css` | One component with its own stylesheet. The two looked different because the styles lived in the catalogue's stylesheet and the course page never loads it, so its trail arrived as plain blue links. Same family of mistake as the one caught in Phase 3 |
| c | `ui/ToolRack.tsx`, `ToolRack.css` | A long tool name gets smaller type and may wrap. Keys are a grid, so one that wraps does not leave its neighbours short. Checked in a browser by measuring "KoboToolbox" against its key |
| d | `src/pages/Courses/page.tsx` | The Academy band moved to just before "Why Data-Lead Africa". **A choice worth flagging:** it sits after the kids bootcamp section rather than between the two grids, so the two programmes stay together. When there are no kids courses that section is absent and the band follows the main grid directly |
| e | `api/_seo-rules.js`, `api/academy-meta.js` | One `plural` function, used everywhere a count is written in the plain HTML, with tests |
| f | `database/lms/tests/README.md`, `tests/DO-NOT-RUN-ON-SUPABASE_certification-harness.sql` | See below |

**The tests README was not just out of date, it was unfollowable.** File 13 refuses to apply
unless `certificates.certificate_number` has a UNIQUE rule, the real database has one and the
local stand in did not, so anybody following the README hit a wall with no way past it. The
certification harness now adds the rule if it is missing, and the README explains why the two
harness files have to go in a particular order.

Its numbers were wrong too. It said 132 tests in four suites with 25 in the file 12 suite. It is
**206 tests in six suites** and that suite has 52. Every number in it is now counted from a run
on 8 October, which is also how I found that the "fail first" figure for file 14 had drifted: it
is 7 passed and 22 failed, not 6 and 23. `docs/lms/WHAT-CHANGED-explained-phase-3.md` is
corrected to match.

### For later, in STATUS.md

The main JavaScript bundle is 1.17 MB, 354 KB compressed, because every page outside the Academy
loads at once. Lazy loading the other route groups the way the Academy's are done would make the
whole site faster on phones. A separate pull request after launch.

### What was checked

| | |
| --- | --- |
| `npm run build` on top of `main` `d02c86b` | passes |
| Node tests | **58 pass, 0 fail** (was 42) |
| Database suites, files 01 to 14 applied | **206 pass, 0 fail** across six suites |
| Browser: structured data | 12 checks, all pass |
| Browser: the review's visual items | 31 checks, all pass |

---

## SITE WIDE, 8 October 2026. Two fixes that are not about the Academy.

Listed first and separately, because they change every page on dataleadafrica.com.

### 1. Every page told Google it was a copy of the homepage

`index.html` carried these two lines:

```html
<link rel="canonical" href="https://dataleadafrica.com/" />
<meta property="og:url" content="https://dataleadafrica.com/" />
```

`index.html` is served for **every** address on the site. So the first HTML a search engine
received for `/courses`, for every blog post and for every research page said "this is a copy of
the homepage". A crawler that does not run JavaScript never saw anything else. One that does still
read it first.

Both lines are gone. There is a comment where they were, saying why, because the obvious thing to
do when you notice they are missing is to add them back.

They are now set per page: by the `Seo` component once React boots, and by the edge functions
before the HTML is even sent.

**This is the largest SEO problem the site had, and it had nothing to do with the Academy.**

### 2. robots.txt and sitemap.xml did not exist

`public/robots.txt` is new. `/sitemap.xml` is new, built by an edge function from the site's own
route list plus every published course.

| Changed existing file | What changed |
| --- | --- |
| `index.html` | The two lines above removed, and a comment left in their place |
| `src/components/Seo/component.tsx` | An optional `canonicalPath`, and `SITE_ORIGIN` instead of `window.location.origin`. Every page that does not pass the new prop behaves exactly as before |
| `vercel.json` | Four rewrites, all placed BEFORE the catch all |
| `src/pages/Courses/page.tsx` | One band at the bottom linking to the Academy catalogue, which hides itself when no course is published |

---

## Phase 3, 8 October 2026. The three public Academy pages, and the database behind them.

**`npm run build` passes on top of `main` at commit `d02c86b`.** Fresh clone, package laid over it,
real build: exit code 0, `tsc -b` clean, `eslint` clean on every new file.

### Part A. Database file 14: two leaks closed

Both were real on the live database, and both were found by loading files 01 to 13 into a local
PostgreSQL and reading as the `anon` role. The tests were written to fail first: **6 passed and 23
failed before the fix, 29 pass after.**

**Leak 1. Every lesson's video id was readable by anybody.** `grant select on ... lms_lessons ... to
anon` is a grant on the whole table, every column, and the row policy then let anon see every
lesson of every published course. So `video_ref` and `content_md` came back with the rest.

File 10's comment said the reference was "useless without `lms_lesson_is_open`". That is true of a
player and false of YouTube: an unlisted video is not a private one, and the id plays for anybody
who has it, for ever. One request with the publishable key returned the id of every paid video.

Measured before the fix: **3 video references and 3 lesson bodies readable by anon**, and the same
by a signed in learner with no entitlement.

Fixed by granting the columns a shop window needs and no others. Titles, lengths and positions stay
readable, so the course page's curriculum still works. Granting columns rather than the table also
fails safe: a column added next year is not handed over until somebody says so.

**Leak 2. Draft courses were readable by anybody.** `lms_course_cards` is a view, and a view runs
with its OWNER's rights unless told otherwise, so the policy that hides draft courses was simply
not consulted. Measured before the fix: **2 draft courses visible to anon**, with their titles and
their prices. Fixed with `security_invoker = true`.

Also in file 14:

| | What |
| --- | --- |
| `lms_open_lesson(uuid)` | The only way to a video. Asks `lms_lesson_is_open` first, returns no row when the answer is no. For the Phase 4 player. `authenticated` only |
| `lms_staff_lesson(uuid)` | The same for staff, for the Phase 6 control room |
| The sweep | Every `lms_` view checked for `security_invoker` and every function for reading the video with the caller's rights. Both are also permanent tests, so a view added later cannot bring the leak back |
| Six new columns | `outcomes`, `audience`, `prerequisites`, `faq`, `seo_title`, `seo_description`, with length rules the database enforces and an FAQ shape check |
| The publish checklist | Now refuses a course with fewer than three outcomes. The empty summary rule was already there, as "Has a short description" |
| `lms_public_catalogue()` | One call, published only, with lesson, module and quiz counts and total seconds |
| `lms_public_course(slug)` | One call, with the modules and lessons as JSON. **Neither returns a video reference or a lesson body, and there is a test that reads their column names and fails if one ever does** |

`14_test_course.sql` puts one real course in, as a draft, with outcomes and an FAQ, for the Phase 5
test. It prints the checklist so you can see it is ready before publishing, and the file ends with
the one line to publish it and the one line to take it down.

**All five older suites still pass: 43 + 36 + 28 + 52 + 18, plus 29 new, is 206 tests.**

Four older fixtures needed bringing up to date, not because the new rule is wrong but because they
were written before it. One older test was also repaired: the file 12 suite was **not repeatable**.
P13 checks that a mailer which has never called in raises an alarm, and P14 four lines later makes
it call in, so the second run on the same database saw the first run's heartbeat and P13 passed
incorrectly. The seed now clears it.

`14_verify.sql` had the same fault as the Phase 1 readiness query and is now fixed: PostgreSQL
resolves function names at parse time, so a half applied file 14 made the whole verify return
nothing instead of a list of NOs. Row 19 runs its query through `query_to_xml`. With file 14
deliberately undone, the verify now reports **14 honest NOs** rather than erroring.

`14_undo.sql` refuses to run unless you edit one line in it, because undoing file 14 means putting
two security leaks back. It keeps the six columns, which hold words somebody wrote.

### Part B. The three pages

| Route | What it is |
| --- | --- |
| `/lms` | Hero, the tool rack, How it works, Latest courses, Check any certificate, FAQ, the dark closing band |
| `/lms/courses` | Breadcrumb, live count, search, area filters, sort, and a designed empty state |
| `/lms/courses/:slug` | Breadcrumb, chips, the four facts, the course map bar, outcomes, who it is for, the curriculum, certificate, FAQ, related courses, and the buy card |

**"Latest courses", not "Popular courses".** The concept says Popular; we do not measure popularity,
so the page would have been making up a number in the one place a stranger trusts least.

**The tool rack is never a hard coded list.** It is the tools that actually have a published course,
and it falls back to pills below four tools. It stops cycling when anybody touches it, when the tab
is hidden and when reduced motion is on.

**The catalogue's address never changes.** Filters and search change the list and nothing else: no
query string, no history entry. Every combination would otherwise be an address a search engine
could find, and it would find twenty thin pages instead of one strong one.

**The buy card has four states and exactly one is live.** Free, paid with payments open (not used:
Paystack comes later), paid with payments not open (this release: "Create an account", with "Online
payment opens soon"), and signed in with access. It says nothing about bootcamp emails or who gets
anything free.

**The Academy is loaded separately from the rest of the site**, with `React.lazy` and a dynamic
import, so somebody reading the blog never downloads it. Every loading state is a block the exact
size of the thing it is holding a place for, so nothing jumps.

### Part C. SEO

`api/academy-meta.js` answers the three public addresses with the real title, description,
canonical, sharing tags, structured data and **a plain HTML copy of the page's content inside
`#root`**, before any JavaScript runs. React replaces it on boot.

The rules it keeps, each with a test: a draft or unknown slug answers a real **404** and `noindex`,
never a 200; any query string is dropped from the canonical; if Supabase is slower than 1.5 seconds
or down, the ordinary page is served and **never a 500**; `s-maxage=300, stale-while-revalidate=86400`.

`api/sitemap.js` builds `/sitemap.xml` from the site's routes plus every published course with its
`updated_at`. The route list is a second copy of `routes.ts`, which an edge function cannot import,
so `tests/sitemap-routes.test.mjs` reads `routes.ts` and fails if the two ever drift. A new route
has to be classified as public or explained, on purpose.

`api/og.js` gains `?course=<slug>`: a 1200 by 630 card with the title and three facts, drawn with
the Poppins already in that file.

**One copy of the title and description rules.** They are needed in TypeScript for the page and in
JavaScript for the edge function. An earlier attempt wrote them twice with a test comparing the two,
and that test had to turn TypeScript into JavaScript with regular expressions to do it. They now
live once, in `api/_seo-rules.js`, which both sides import.

### Four faults found while building, none of them in the brief

| What | Why it mattered |
| --- | --- |
| The canonical carried the query string | The one place it must never appear. Found by the test, not by looking |
| The course page used styles defined in the landing page's stylesheet | Harmless until Phase 3 made each page load on its own. A visitor arriving at a course page from a search result got every eyebrow and every grid unstyled; it only looked right if you visited the landing page first. The shared styles now live in `academy.css` |
| An unclosed CSS comment ate the rules after it | Introduced while fixing the above. The build does not warn: it silently drops everything to the next `*/`. Every Academy stylesheet is now checked for it |
| The WhatsApp button sat on the sticky buy bar | The brief asked for this not to happen; it was still happening until the check caught it. The button is lifted clear on course pages rather than hidden, because a course page is public and the button belongs there |

### How it was checked

- **29 database tests** for file 14, failing first, against a real local PostgreSQL as the real
  `anon` and `authenticated` roles, plus 177 older ones. 206 in all
- **42 Node tests** for the edge functions, with a stubbed `fetch`: the five Supabase cases
  (normal, draft, unknown, slow, down), the canonical, the 404, the structured data, escaping, the
  sitemap, the route drift and the title rules
- **29 browser checks** on the three pages at 1360px and 390px: one h1 each, headings in order,
  filters not touching the address, the empty catalogue, the sticky bar, the WhatsApp button, and
  no sideways scroll

### Changed existing files

Ten. Four are the site wide fixes listed at the top of this entry.

| File | Change |
| --- | --- |
| `index.html` | The homepage canonical and `og:url` removed |
| `vercel.json` | Four rewrites before the catch all |
| `src/components/Seo/component.tsx` | Optional `canonicalPath`, and one site origin constant |
| `src/pages/Courses/page.tsx` | The Academy band |
| `src/pages/routes.ts` | Two public Academy routes |
| `src/main.tsx` | Mounts `academyRouter()` (Phase 2) |
| `src/lib/learning.ts`, `src/lib/certificates.ts`, `src/pages/Learning/Login/page.tsx`, `src/pages/Certificates/Claim/page.tsx` | The file 12 changes, written on 7 October and still unmerged |

`api/og.js` is also changed, by addition only: the certificate card is untouched.

### Two things to do when this is merged

1. Delete `database/lms/not-yet-run/10_roles_and_access.sql`, `10_undo.sql` and `10_verify.sql`.
   File 10 was run on 6 October and the current copies are at the top of `database/lms/`.
2. Check the primary address and, if it is the www one, change the single line in `src/lib/site.ts`
   and the `Sitemap:` line in `public/robots.txt`. `docs/lms/SEO.md` section 3 says how to check in
   thirty seconds. **This is the one thing in Phase 3 I could not verify from here.**

---

## Phase 2, 8 October 2026. The Academy, built on the design concept.

**`npm run build` passes on top of `main` at commit `d02c86b`.** I cloned the repository, laid
this package over it and ran the real build: exit code 0, `npx tsc -b` clean, and `npx eslint`
clean on every new file. That is a check I ran, not a claim.

An earlier version of this entry said `e4367d8`. That commit is real but two behind: `01292b1` and
the merge `d02c86b` came after it, and they added `database/lms/` and `docs/lms/STATUS.md` and
**touched no file under `src/` or `public/`**. So nothing in this package depended on the stale
copy, and the build is the same on both. Thank you for catching it. Verified by diffing
`e4367d8..d02c86b`.

### Two files to delete when this is merged

Laying this package over `main` leaves two things behind that it cannot remove by itself.

1. **`database/lms/not-yet-run/10_roles_and_access.sql`, `10_undo.sql` and `10_verify.sql`.** File
   10 was run on 6 October, and its three files are at the top of `database/lms/` in this package.
   The copies in `not-yet-run/` are stale, and the folder's name now says something untrue about
   them.
2. Nothing else. `DataLeadWeb-frontend/` is a separate job, after launch, in its own pull request.
   It is in `docs/lms/STATUS.md`.

Phase 2 was built once, looked too plain, and has been rebuilt to the design concept. This entry
describes the package as it stands, not the difference from the first attempt.

### The second review round, 8 October

Four things came back. All four are in.

**1. A real bug in swallowing the error, and it was mine.** supabase-js does **not** throw when the
network fails: `_request` builds an `AuthRetryableFetchError` and throws it, and then every public
method catches it again with `if (isAuthError(error)) return { error }`. So the try/catch I had
wrapped every call in never fired once. "Nothing was thrown" was read as "the server answered", and
every failure was treated as the one failure that has to be hidden. Three real ones were hidden
with it, and in all three the person was shown the code screen and left waiting for an email that
was never going to arrive: no connection, the project's hourly email allowance used up, and the
mailer or hook being down. With the allowance set to 20 an hour, the middle one would have happened
on a busy day.

The error is now read, and the decision is made on its kind:

| What came back | What happens |
| --- | --- |
| `status 0`, the request never left the device | *We could not reach the Academy. Check your connection and try again.* |
| `429` matching `after N seconds`, the per address wait | **Treated exactly as success.** This is the only one that leaks, because Supabase sends it only for an address it already knows |
| `429` anything else, the project's hourly allowance | *We are sending a lot of emails right now. Please try again in an hour.* |
| `500` and above | *We could not send your code just now. Please try again in a few minutes.* |
| anything else | success |

Applied to sign up, send another code, and reset. **Fifteen tests, five cases on each.**

While in there I found the same fault in two more places the review did not list. A dropped
connection during **sign in** was reported as *that email address and password do not match*, which
sends somebody off to reset a password that was fine; and a dropped connection while **a code was
being checked** was reported as *that code was not right*, which burns a good code. Both now say
the connection failed. Two more tests.

**One residual leak, written down rather than quietly accepted.** The `500` can only happen when an
email was really being sent, which on sign up means the address was new, so in principle somebody
watching very closely could read something into it. Reporting it anyway is the right trade: it
needs the mailer to be broken at that exact moment, and the alternative is telling a real person a
code is coming when we know it is not.

**2. The WhatsApp button over the main button on phones.** Hidden on `/lms/sign-up`,
`/lms/sign-in`, `/lms/reset` and `/lms/me`, and kept on `/lms` and the public Academy pages.

I used the scoped rule rather than editing `Footer`, as suggested:

```css
body:has(.acad-stage--focus) .wa-float { display: none; }
```

`AcadStage` takes a `focus` flag which adds that class, and the four pages pass it. The reason for
preferring it: the button belongs to `Footer`, which every page on the site renders, so reaching
into Footer from here would let a page outside `/lms` start hiding it by accident. This way the
whole arrangement is one rule in the Academy's own stylesheet, beside the thing it is about. A
browser too old for `:has()` drops the rule and shows the button exactly as it does today, which is
the right way for it to fail. The Phase 4 lesson player will pass `focus` too.

**3. The beacon touching the step rail.** Its top margin goes from 30px to 54px. The two rings
leaving the beacon grow to 1.7 times its size, about 26px past the top of the box, which is what
was closing the gap. Measured in the browser afterwards: 27px of clear space between the rail and
the furthest the rings reach.

**4. The commit.** Covered above.

**Agreed, no change:** the orange button keeps white text, like the rest of the site.

### New pages

| Route | What it is |
| --- | --- |
| `/lms` | The Academy is opening soon, until Phase 3 |
| `/lms/sign-up` | Name, email, password, then six boxes for the emailed code |
| `/lms/sign-in` | Email and password, with a route back for an unconfirmed account |
| `/lms/reset` | Address, code, new password |
| `/lms/me` | Greeting, access notice, pass card, and the space Phase 4 fills |

Every one carries `noindex`.

### The design system

Built from the attached concept and written down in `docs/lms/DESIGN.md`, so Phases 3 to 6 build
from one place rather than from memory.

```
src/pages/Academy/academy.css        tokens, type, button, link, messages
src/pages/Academy/ui/AcadStage       the stage: grid, glow, page width
src/pages/Academy/ui/AcadCard        the white card with the orange edge
src/pages/Academy/ui/StepRail        Details, Verify, Ready
src/pages/Academy/ui/Field           one input with a floating label
src/pages/Academy/ui/PasswordStrength
src/pages/Academy/ui/CodeBoxes       the six code boxes
src/pages/Academy/ui/MeterRing       a circular countdown
src/pages/Academy/ui/WatchTape       one cell per ten seconds. Built now, used in Phase 4
src/pages/Academy/ui/PassCard        who you are and what your account reaches
src/pages/Academy/ui/EmptyState      before anything has been started
src/pages/Academy/ui/Icons           the line icons, drawn inline
src/pages/Academy/ui/format.ts       asClock
src/pages/Academy/CodeStep           the whole code screen, shared by three pages
src/pages/Academy/Pitch              the left hand side of the account pages
src/pages/Academy/useCodeTimers.ts   the two countdowns, worked out from one timestamp
```

**Every token is on `.acad`, and nothing touches `:root`, `html` or `body`.** `portal.css` already
rewrites `:root` and sets a `body` background, and Vite bundles every stylesheet together, so those
apply site wide the moment any portal page loads. The Academy must not add a second source of that.

### One new font, self hosted

`public/fonts/jetbrains-mono/`, weights 400, 500 and 600, latin only, 63.3 KB, SIL Open Font
License, with `OFL.txt` beside the files. Declared in `academy.css`, not `global.css`, so the rest
of the site never downloads it. **No new npm dependency.**

Clash Display and Poppins are already in the repository and no new files were added for them.

| | Raw | Over the wire |
| --- | --- | --- |
| Academy CSS | 31.5 KB | 8.5 KB |
| JetBrains Mono | 63.3 KB | 63.3 KB |
| **Total added** | **94.9 KB** | **71.8 KB** |

The budget was 120 KB.

### The seven fixes

| # | What was wrong | What it is now |
| --- | --- | --- |
| 1 | The welcome notice never appeared, because the sync after sign up, sign in or reset used up `changed = true` before `/lms/me` ever asked | Whoever calls the sync carries the answer to `/lms/me` in the navigation, which also wipes it from the history entry so a reload does not show it twice. `/lms/me` uses the role from that same answer and no longer calls `lms_my_role` |
| 2a | Typing one digit into a filled box wiped the whole code, because the box reports two characters and anything over one was treated as a paste | Three or more at once is a paste. For two, whichever is not the old digit is kept |
| 2b | After a wrong code the cursor stayed where it was | It goes back to box 1 |
| 2c | A digit typed into box 3 while 1 and 2 were empty jumped to box 1 | The boxes keep an array of six cells, so the gap survives |
| 3 | The reset code screen had no way to ask for another code | It has Send another code, with the same 60 second ring as the others |
| 4 | Supabase answers "you can only request this after 60 seconds" **only for addresses that have an account**, and both pages passed that straight on | Sign up and reset do not read the reply at all. Every answer produces the same screen |
| 5 | The steps were divs with click handlers | Every step is a real `<form>` with a real submit button, so Enter works and password managers offer to save |
| 6 | An error stayed on screen while the person fixed it | Each message names the box it is about and clears the moment that box is edited |
| 7 | `/lms` named four courses that do not exist and pointed bootcamp people somewhere else | It names no courses, promises nothing about who gets what, and says only that the Academy is nearly ready |

### Wording removed from every account page

Nothing before sign in says anything about who gets which courses, or about which address to sign
up with. Two lines are gone:

- Sign up: *"If you are on one of our bootcamps, use the same address you enrolled with and your
  courses will be waiting."*
- `/lms`: *"On a bootcamp with us? Use the learning portal instead."*

Before somebody is signed in the page has no idea who is reading it, so any such sentence is a
promise made to a stranger. What an account reaches is settled by the server and said by the pass
card on `/lms/me`. The learning portal is still linked from `/certifications`, so nobody is
stranded.

The watch tape appears on no account page.

### Five more faults, found while testing this phase

None of these were in the brief. They were found by driving the pages and by rendering the
components rather than by reasoning about them.

| What | Why it mattered |
| --- | --- |
| The six boxes submitted a code the page could not see | The boxes finish and tell the page in the same tick, so the page's own copy is one digit behind. A complete code was refused with *please enter all 6 digits*. The boxes now hand the finished code over as an argument |
| My own CSS reset beat my own buttons | `.acad button { color: inherit }` scores higher than `.acad-btn`, so the orange button had dark text and inline links looked like ordinary writing. The reset now uses `:where()` and carries no weight |
| The watch tape drew nothing for a long lesson | An hour is 360 cells, and at `1fr` each they refuse to shrink and push each other out of the grid. It now groups buckets above 120 cells and uses `minmax(0, 1fr)`. A lesson with no length says so instead of drawing one cell the width of the card |
| Reduced motion left one animation running | The rule said `.acad *`, which does not match `.acad::after`, and that is exactly where the glow that never stops is drawn |
| Two pieces of small orange text missed AA | `#c2500a` is 4.7:1 on white but 4.0:1 on the faintest orange wash. There is now a second orange, `--acad-signal-deep`, for text on a tint |

Also hardened while there: every Supabase call is wrapped, so a dropped connection says *We could
not reach the Academy* instead of leaving a button spinning for ever. A returned error can depend
on the address and is swallowed; a thrown one means the request never left the phone and is
reported honestly.

### How it was checked

Not by looking at it. Three scripts drove the real pages in a real browser against intercepted
Supabase replies, with nothing added to the website:

- **12 checks** on the code boxes: typing, the two character case both ways round, paste, autofill
  into the wrong box, backspace, and the cursor after a refusal
- **41 checks** on the rest: the 429 behaving exactly like a success on both pages, Enter
  submitting, errors clearing on the right box only, the notice appearing once and not returning
  on reload, and no page before sign in naming a course, mentioning free access or drawing a tape
- **10 checks** on the design rules: only `transform` and `opacity` animated, a hidden tab stopping
  everything, reduced motion stopping everything, and the contrast of **71 runs of text** across
  four pages, composited against what is actually behind them
- **24 checks** from the second review round: the five failure cases on each of the three pages
  that send an email, the two places a dropped connection used to be blamed on the person, the
  WhatsApp button gone from the four task pages and still there on `/lms`, nothing covering the
  main button on a phone, and the gap above the beacon measured in the browser

All 87 pass. Both widths, 1360px and 390px, were screenshotted at every step.

The resend tests wind the browser's clock forward 65 seconds rather than forcing the disabled
button, so they go through the path a person actually takes.

### Existing repository files this package changes

Six, and four of them are the file 12 website changes written on 7 October and never merged.

| File | Change | Why |
| --- | --- | --- |
| `src/pages/routes.ts` | Five entries added at the end | The Academy routes |
| `src/main.tsx` | One import, one line in the route list | Mounts `academyRouter()` |
| `src/lib/learning.ts` | Calls `request_sign_in_code` instead of `request_certificate_code` | File 12 |
| `src/lib/certificates.ts` | The same change | File 12 |
| `src/pages/Learning/Login/page.tsx` | Shows the shared sentence | File 12 |
| `src/pages/Certificates/Claim/page.tsx` | Shows the shared sentence | File 12 |

**Nothing else is touched.** No existing component, no existing stylesheet, no `global.css`, no
`vercel.json`, no `package.json`. **No new dependencies.**

### Decisions worth recording

| Decision | Why |
| --- | --- |
| The orange button keeps white text at 2.95:1, below AA | It is the site's own button, `#f56e0f` with white text, used identically in `LeadForm`, `GizStrip`, the Footer and the blog. Reaching AA means a noticeably browner button here than everywhere else on the site, which is a decision about the whole site rather than about `/lms`. `docs/lms/DESIGN.md` section 10 names the two places to change if you want it |
| Sign up and reset do not read Supabase's error at all | Reading it is the leak. See fix 4 |
| The code screen is one component shared by three pages | The three copies had already drifted: only two had a resend button, and the third was the one people most needed it on |
| The two countdowns are worked out from one timestamp, not counted down | A browser slows timers in a background tab, so a counter drifts and eventually tells somebody their code has four minutes left when it expired a while ago |
| `WatchTape` is built now and used in Phase 4 | It is the signature element, and building it with the system means Phase 4 inherits something already proven rather than inventing it under pressure |
| The pass card's sheen is masked rather than blurred | A blur on a permanently rotating element is the most expensive thing on a page and the first thing to stutter on a cheap Android phone |
| `/lms/me` shows the pass card only once the sync has answered | Showing the plain card first and swapping it a moment later would tell somebody their access had changed when all that happened was the page finished loading |
| Only the first code box carries `autocomplete="one-time-code"` | On all six, some browsers offer the code six times over |

### One row to add to the Supabase settings checklist

**Authentication, Sign In / Providers, Email, Minimum password length = 8.**

It is in `docs/lms/SUPABASE-AUTH-SETTINGS.md` as setting 7, with how to confirm it took. The pages
already refuse anything shorter, but a rule enforced only in the browser is not a rule.

### Still waiting

- The real email test. Every code in this phase is sent by Supabase through the hook and the Apps
  Script mailer, and none of that is reachable from a preview. Phase 5.
- `/lms/me` has two tiles. The Continue, This week, Your courses and Certificates tiles are
  Phase 4, and This week needs a new database function first: see `docs/lms/STATUS.md`.
- `/lms` is a placeholder. Phase 3 replaces it.

---

## Phase 1, 7 to 8 October 2026. The database.

Files 01 to 07, 10, 11, 12 and 13, all applied to the live database, with 177 tests across five
suites. See `docs/lms/STATUS.md` for the decisions log and `docs/lms/test-evidence-file-*.md` for
the evidence.

Also in this package from Phase 1: `scripts/lms/mailer.gs` and `scripts/lms/alarm.gs`, which are
pasted into Apps Script projects rather than run from the repository, and the documents in
`docs/lms/`.
