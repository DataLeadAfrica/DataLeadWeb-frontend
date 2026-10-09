# The six changes to file 10, explained simply

Written to be understood without knowing any SQL. Each one says what was wrong, what
could have happened, and what was done about it.

---

## 1. The student who came back and found the door locked

**What was wrong.** When a bootcamp student signs in, the system gives them a pass that
says "this person may open every course, until this date". The date comes from when their
cohort ends.

The problem was what happened the second time. If the student already had a pass, the
system looked at it, saw a pass was there, and left it completely alone. It never checked
whether the date on it was still right.

So a student who finished cohort one in June and joined cohort two in September still had
the June pass. June had gone, so the pass was dead. And because the rules allow only one
live pass per person, a new one could not be made either. The student signed in, was told
"nothing has changed since you were last here", and could not open a single course. The
same thing happened to everyone in a cohort whose end date got pushed back.

**What was done.** The system now has three things it can do with a pass instead of two. It
can give you one, it can take it away, and now it can also **renew** it: if the date on
your pass does not match the date your enrolment says, the date gets corrected. That covers
a new cohort, an extended cohort, and an enrolment with no end date at all. If the date
already agrees, nothing is written, so this costs nothing on an ordinary sign in.

Think of a library card that used to be stamped once and never looked at again. Now the
librarian checks the stamp every visit and restamps it when your membership has moved on.

---

## 2. Facilitators could publish, change prices and delete

**What was wrong.** The whole point of having two kinds of staff is that a facilitator
builds courses and only you decide when a course goes live. Version 1 gave facilitators
permission to edit the course table, and that permission does not come in small pieces: a
facilitator who could change a course's title could just as easily change its status to
published, change its price to zero, or delete it altogether. Nothing stopped them, and
nothing would have told you afterwards.

The reason the usual protection does not help here is worth understanding. The normal
rule in this database is called a policy, and a policy can say "you may touch this row"
or "you may not touch this row". It cannot say "you may change the title but not the
price", and it cannot say "only while this course is still a draft". Those are exactly the
two rules needed.

**What was done.** Seven **guards** were added. A guard is a small piece of code the
database runs by itself every single time somebody tries to add, change or remove a row,
and it can refuse with a message. The guards say that anybody signed in who is not the
administrator may not:

- delete a course, a learning path, or a set of questions
- create one that is already published
- change a status, a publication date or a price
- edit anything that is already live
- add or change a module, lesson, question or answer belonging to a course that is
  already live

A facilitator who tries now gets a plain sentence back, such as "This course is live. Ask
the administrator to unpublish it before editing."

One deliberate exception: a session with nobody signed in is trusted. That is the SQL
editor inside Supabase, which only you can reach, and the nightly job in change 4. Without
that exception you could not fix anything by hand.

Why a guard and not just a permission? A permission is the key to the room. A guard is the
person inside the room watching what you touch.

---

## 3. Replacing questions deleted the old ones, and learners paid for it

**What was wrong.** When somebody pasted in a new set of questions, the old questions were
deleted outright.

Here is why that hurt. When a learner starts a set of questions, the system writes down
which questions they were given, so that nobody can change the questions underneath them
halfway through. That list is just a set of references. Delete the questions and those
references point at nothing.

The test showed exactly what the learner then saw. A learner who was partway through was
marked out of zero questions and told **"All 0 correct. On you go."** They were passed
without answering anything. Every past attempt also lost the questions it had been marked
against, so the records became unreadable.

**What was done.** Questions are never deleted now. Each question has a yes or no flag
called `active`, and the old ones are switched to no, which the system already knows to
skip when handing out a set of questions. The rows stay where they are, so part finished
attempts and old records still make sense. The same learner in the same situation is now
marked out of two questions and told "0 of 2 correct. Have another look at the ones you
missed."

One detail that had to be got right: every question has a number saying where it comes in
the order, and no two questions in one set may share a number. The retired questions keep
their numbers, so the new questions are numbered above the highest one already there.

There is also a new rule about who may do this at all. On a draft set of questions, any
facilitator may import. On a set that is already live, only the administrator may, because
changing questions under a learner who is sitting them is not a small thing.

---

## 4. Access only changed when somebody signed in again

**What was wrong.** All the checks happened at sign in. But Supabase keeps people signed
in for a long time, often weeks. So a student who was withdrawn on Monday kept free access
to every course until the next time they happened to sign in, which might be never.

**What was done.** Two things.

First, the sign in check was made cheap enough to run every time an Academy page opens, not
just at sign in. It writes nothing at all when nothing has changed, so calling it often
costs almost nothing.

Second, a **nightly sweep** was added. It does the same three way decision for everybody at
once, needs nobody to be signed in, and can be run by hand at any time. It also writes a
line in the audit log each night saying how many passes it gave, renewed and took away, so
there is a record.

**One thing to check on your side.** The sweep runs on a schedule only if an extension
called pg_cron is turned on, and I cannot see your Supabase settings from here. File 10
checks for you: if pg_cron is missing it prints a notice saying so and creates no schedule,
and the sweep function still works when run by hand. To find out now, run this in the SQL
editor:

```sql
select count(*) as pg_cron_installed from pg_extension where extname = 'pg_cron';
```

A 1 means it is on and the nightly job will be created. A 0 means it is off: turn it on
under Database, then Extensions, search for pg_cron, and run file 10 again. Until then,
run `select * from lms_nightly_access_sweep();` yourself when a cohort changes.

---

## 5. Permissions nobody needed

**What was wrong.** Supabase hands out every possible permission on every new table to
both visitors and signed in users, and relies on policies to hold the line. That is mostly
fine, but three of those permissions are wanted by nobody, and one of them is dangerous in
a way the others are not.

**TRUNCATE** means emptying an entire table in one go. Unlike every other kind of change,
policies do not apply to it at all. The usual route into the database does not offer it, so
nothing was reachable, but a permission that cannot be filtered and that nobody needs
should not be sitting there.

**What was done.** On the Academy tables only:

- nobody holds TRUNCATE, REFERENCES or TRIGGER any more
- a visitor who is not signed in cannot add, change or delete anything at all
- reading is untouched, and signed in staff keep everything they need

The settings for the whole public area of the database were deliberately left alone,
because the certification system lives there too and changing them would affect it. The
cost of that choice is that a brand new Academy table will arrive with the wide
permissions again, so file 10 leaves behind a small function to tidy up: run
`select * from lms_tidy_table_privileges();` after adding one.

### Which policies let a visitor who is not signed in see anything, and why each is safe

All six are read only, and after this change a visitor cannot write to any Academy table.

| Policy | What it shows | Why it is safe |
| --- | --- | --- |
| `p_courses_public` | Published courses | A published course is a shop window. Drafts stay hidden by the same rule |
| `p_modules_public` | Module titles of a published course | The syllabus, which is meant to be read before buying |
| `p_lessons_public` | Lesson titles of a published course | Same reason. The video reference is useless without the server agreeing to open the lesson, and finishing it needs watching the server actually recorded |
| `p_paths_public` | Published learning paths | A shop window too |
| `p_pathc_public` | Which courses sit in a path, in order | Two references and a number. Nothing about any person |
| `p_settings_public` | The landing page words and the welcome video | Written for the public by definition |

Everything that could identify a person or give away an answer has no policy for visitors
at all: profiles, passes, orders, progress, watching records, attempts, the audit log, the
facilitator list, and the answer key.

---

## 6. A comment that was wrong

Version 1 had a comment claiming that renaming the staff role would break a function
called `lms_lesson_is_open`, "which decides whether anyone can open a lesson at all". That
was wrong. The real `lms_lesson_is_open` does not mention the staff role. The function the
rename actually breaks is `lms_is_staff`, which the rules deciding who can see courses,
modules and lessons all use. The repair step always handled the real case correctly, and
finds whichever functions are affected rather than relying on a name, but the sentence was
misleading and is now accurate.

---

## What did not change

The six items above are the only changes. Everything else in file 10 is as it was, and the
original 43 tests still pass. File 10 still checks the database before touching anything,
is still safe to run twice, and still comes with a verify file and an undo file.

One thing the undo deliberately does not reverse: the permission tidy in change 5. Putting
TRUNCATE back into a visitor's hands would be restoring a flaw, so the undo leaves it
tightened and explains why, with a commented out block at the bottom if you ever truly
want it back.
