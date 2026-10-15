# Phase 6B: what to run in Supabase, and in what order

Three files, in this order. Nothing else in this branch touches the database.

| Order | File | What it does | How long |
|---|---|---|---|
| 1 | `database/lms/17_control_room.sql` | The whole control room, in one transaction | A few seconds |
| 2 | `database/lms/17_verify_EDITOR.sql` | Changes nothing. Prints 41 rows. **This is the one to paste** | Instant |
| 3 | only if it has to come off: `database/lms/17_undo.sql` | Puts it back as file 16 left it | A few seconds |

## Before you start

File 17 checks for itself that files 01 to 16 have been run, and stops with a list of what is
missing if any of them has not. You do not need to check first.

**Run it on a preview first if you would rather.** Nothing in file 17 changes anything a learner
sees: it adds staff functions and three columns to `lms_courses`. The one existing behaviour it
changes is covered under "What it changes that already existed" below.

## 1. Run the control room

Open the Supabase SQL editor, paste the whole of `17_control_room.sql`, and run it.

It is one transaction. Either all of it lands or none of it does, so there is no half applied state
to clean up. Running it a second time changes nothing, so if you are unsure whether it took, run it
again.

You should see a line of notices, one per step, ending with:

```
Step 12: 47 control room functions granted to signed in callers only, none to anon.
Step 12: table privileges tidied across 32 Academy tables.
```

## 2. Run the verify

**Paste `17_verify_EDITOR.sql`, not `17_verify.sql`.** The two hold the same 41 checks and a test
keeps them in step. The EDITOR one says only "check 1", "check 2" and so on, with nothing in the
note column.

Why there are two: `16_verify.sql` failed in the Editor with `relation "the" does not exist` while
running cleanly everywhere else. Taking out every semicolon did not fix it, and nor did removing
every comment. What ran was a version with short labels and no prose. The cause is still a guess:
the file that failed had phrases like "from the courses table" inside its explanation strings and
the one that ran had none, which would fit an Editor scanning for a table name after from, into,
join, update or table. So the EDITOR file has no prose at all, and the explanations live in
`PHASE-6B-PLAIN.md`, one row per check number.

**Read every row. All 41 should say yes.** `PHASE-6B-PLAIN.md` says what each number means and what
a NO would be telling you. If one says NO, the fourth column says what that row was
protecting and what to do about it.

Run it BEFORE file 17 as well if you like: it prints a column of NOs rather than a Postgres error,
which is the answer. If it ever gives you an error instead of NOs, that is a fault in the file and
worth telling me about.

Six rows say yes even before file 17 has run, and that is correct: they check for the ABSENCE of
something. Row 7 is one of them, and it is the most important row in the file.

## 3. The undo, only if needed

`17_undo.sql` puts the database back as file 16 left it.

**It refuses if anybody has used the control room.** If a course has been created, sent for review
or published through it, or any access has been given or removed, it stops and changes nothing. If
you genuinely want that, run this first, in the same editor session:

```sql
select set_config('lms.undo_17_force', 'yes, I mean it', true)
```

The activity log is never emptied by the undo. Every line it already holds stays, because the point
of a log is that it outlives the thing that wrote it.

## What it changes that already existed

Three functions are replaced rather than added, and the undo writes all three back out in full.

| | |
|---|---|
| `lms_publish_course` | Same signature, same return. The body now runs the nine checks and refuses a facilitator, and it STILL opens a free course to everybody who already has an account, which is file 05's sweep and the part it would have been easiest to lose. |
| `lms_unpublish_course` | The one argument version now points at a two argument one that takes a reason. Taking a live course down with no trace is the kind of thing somebody asks about three weeks later. |
| `lms_guard_lesson` | File 10's guard refused EVERY change to a lesson of a live course, including a typo fix. The brief says words may change and video, length and order may not, so the guard was loosened in exactly that one place. |

**`lms_course_blockers` is NOT one of them.** File 11's step 0 looks up that function's exact
signature and refuses to run if it has changed, so widening it would have made file 11 unrunnable
on this database for ever. The nine checks are a new function, `lms_publish_checks`. Verify row 7
is the check that this stayed true, and file 11 was run again after file 17 to prove it.

## show-test-course.sql will be refused after this

Measured on a local build rather than reasoned about. File 17 makes `lms_publish_course` run the
nine checks, and the Phase 4 test course fails three of them: no lesson checks, no certificate
programme, no exam. The file's last line comes back:

```
published | message
f         | This course is not ready yet: Every video lesson has a lesson check;
            Has a certificate programme; The course exam has enough questions.
```

**That is the checks working rather than a fault.** The test course was never a finished course.

**So run it before file 17, not after.** If it is ever needed live afterwards, either finish it, or
put it live by hand with a plain update, which skips the checks on purpose and is written at the
top of `show-test-course.sql`. Nothing is logged by that route, because nothing called the function
that does the logging.

## One thing that is now possible and was not

Nothing could publish a lesson check. `lms_publish_exam` reads `serve_count`, which is null for a
lesson check, and raises "No such exam". The table is behind row level security so no browser can
do it directly. Meanwhile publish check 7 refuses to let a course go live until every video lesson
HAS a published check.

A course could therefore be built right up to the last check and stop, with nothing explaining what
to do. **Publishing the course now publishes its lesson checks**, in the same statement, which keeps
file 10's rule that only an administrator publishes a set of questions without deadlocking the
facilitator who wrote them.

## After it is run

Nothing on the live site changes until the branch is merged and deployed. The control room is at
`/lms/studio` and is reachable only by somebody whose role is `facilitator` or `admin`.

### Making the two administrators

**This is the one thing the control room cannot do, by design.** `lms_set_staff_role` refuses the
value `admin` outright. In the Supabase SQL editor:

```sql
update lms_profiles set role = 'admin'
 where id = (select id from auth.users where lower(email) = 'you@dataleadafrica.com')
```

The page that can make an administrator is the page worth attacking, so there is no such page.

### Facilitators

Those are added from the Staff page, by email address, and the appointment waits for somebody who
has not signed up yet. That is file 10's machinery and file 17 leaves it exactly as it is.

## The test file, which does not go near Supabase

`database/lms/tests/file_17_tests.sql` runs 71 checks, and it is **not** for the Supabase editor: it
makes staff and learners, builds a whole course, sits an exam and tries every refusal. It writes
rows and then rolls them back. I run it on a local copy. It is in the package so the checks are
written down, not because you need to run it.
