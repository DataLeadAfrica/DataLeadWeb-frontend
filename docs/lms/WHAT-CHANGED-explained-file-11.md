# What file 11 does, explained simply

Written to be understood without knowing any SQL. Two jobs, in one file because both are
small and both touch the same two tables.

---

## Part A. Quiz safety

### 1. A quiz with nothing in it can no longer tell a learner they are finished

**What was wrong.** When the system marks a set of questions, it counts how many the learner
got right out of how many they were given. For a lesson check it then says either "All 3
correct. On you go." or "2 of 3 correct. Have another look."

Now imagine it was given **nothing**. Zero right out of zero is still "all of them", so the
message came out as **"All 0 correct. On you go."** The learner was congratulated for
answering nothing. The attempt was also stamped as failed at the same time, which used up
one of their tries, so the record and the message disagreed with each other.

How does an attempt end up with nothing to mark? When a learner starts a set of questions,
the system writes down which questions they were given, so nobody can change the questions
underneath them halfway through. If those questions later disappear, that written-down list
points at nothing. File 10 stopped the question import from deleting them, but an
administrator can still delete a question outright, so the marking rule itself had to cope.

**What was done.** Two things, belt and braces.

The marking now checks first whether there is anything to mark. If there is nothing, it
leaves the attempt exactly as it was, still in progress, so no try is used up, and says:
"These questions are not available at the moment, so nothing has been marked and nothing has
been recorded. Please tell your tutor."

Separately, the test for passing now requires that there were marks on offer at all. Even if
something else went wrong, no marks can never be a pass.

### 2. Nothing goes live with an empty set of questions

**What was wrong.** A set of questions with nothing in it could be published, and a course
containing one could be published. That is worse than it sounds: a learner cannot even start
an empty set of questions, and a lesson is not finished until its questions are passed, so
the learner would be stuck at that lesson forever with nothing they could do about it.

**What was done.** Two gates, because there are two ways in.

Publishing the **course** now has a seventh thing on its checklist, beside having a title, a
description, a tool, a module, a lesson and a video for each video lesson: every set of
questions attached to it has at least one question. If one does not, the administrator gets
told which: "Every set of questions has at least one question. Still empty: Check three. Add
a question, or delete the empty set."

Publishing the **set of questions** on its own is refused outright, with "This set of
questions has no questions in it yet, so it cannot go live. Add at least one question first."
This gate applies to everybody, the administrator included, because an empty live quiz is a
mistake whoever makes it.

One consequence worth knowing. The order of work is now fixed: create the questions as a
draft, add the questions, then publish. You cannot create one that is already live and fill
it in afterwards. The control room already works that way.

**And one thing file 11 deliberately does not do.** If a set of questions is ALREADY live and
empty on your database, file 11 will not touch it, because the only ways to fix it
automatically would be to unpublish something learners can see or to invent questions.
Instead it prints a warning naming them when you run it, and the verify file checks for them
every time. If you see that warning, add a question to each or delete them.

---

## Part B. Housekeeping

### 1. Watch slices are thrown away once a lesson is finished

The non-skippable rule works by cutting each video into ten second slices and recording which
ones the server actually saw. A ten minute video is sixty rows per learner per lesson. A
thirty lesson course is eighteen hundred rows per learner. That is the bulk of everything the
Academy stores.

Once a lesson is complete, those rows have done their job. The only thing anybody needs from
them afterwards is the single number saying how much was watched.

**What was done.** When a lesson becomes complete, the system works out that single number,
writes it onto the progress row, and deletes the slices. All inside the database, with no
scheduler and nothing to go wrong. The place in the video is kept separately, so the player
still resumes correctly.

### 2. Lesson check attempts go too, but only after making that safe

This one needed care, and the care is the interesting part.

**The trap.** Finishing a lesson used to be decided by looking for a passed attempt in the
attempts table. So deleting attempts would have meant the system could no longer tell that
the learner had passed, and it would have **locked them out of lessons they had already
finished**. There would have been no way back except a backup.

**What was done, in order.** First a new column was added to the progress row saying whether
the check was passed. Then every pass already on record was copied into it, so nobody
existing is affected. Only then was the rule that decides completion switched over to read
that column. Only then does anything get deleted.

Module quiz attempts are kept in full. They are the real assessment record. Only the light
lesson checks are cleared, and only for lessons the learner has finished.

**What a learner loses:** the detailed breakdown of which questions they got right in that
lesson check, for a lesson they have already passed. The pass itself is kept, their progress
is kept, and the module quiz record is kept.

**I chose this option rather than the fallback you offered** of keeping the latest passed
attempt. Keeping one attempt would have left the completion rule still reading the attempts
table, which means the trap is still there for whoever next writes a cleanup. Recording the
pass in its own place removes the trap rather than working around it, and it makes the rule
easier to read: a lesson is finished when the progress row says so.

### 3. A nightly clean-up for lessons nobody ever finished

Part 1 handles finished lessons. What is left is somebody who started a video, stopped, and
never came back. Those slices would sit there forever.

A job runs each night and removes slices for a learner and a lesson where the newest slice is
more than ninety days old and the lesson was never finished. It works per learner per lesson
rather than per row, so somebody slowly working through a long video does not have the
beginning taken away while they are still going.

**What a learner loses:** the credit for the part of that video they had already watched. If
they come back after ninety days of nothing, the non-skippable bar starts again from zero and
they have to watch it through to unlock the next lesson. Their **place** in the video is not
lost, so the player still resumes where they stopped. Nothing else is touched: no progress
row, no finished lesson, no quiz attempt, no certificate.

**This does not duplicate anything.** The only other automatic cleaning in this database is
inside `mail_fetch_pending`, which deletes unsent sign in emails older than an hour and sent
ones older than a day, from the email outbox. It has never touched watch slices.

**It needs pg_cron to run on a schedule.** File 11 checks, and if pg_cron is off it says so
and creates no job; the clean-up still works when run by hand with
`select * from lms_prune_watch_buckets();`.

### 4. A storage report

`select * from lms_storage_report();` as the administrator. The first row is the whole
database against the 500 MB the free plan allows, with a percentage. The rest is one row per
Academy table, biggest first, with its size and how many rows it holds. A learner asking for
it is refused.

### 5. How much this saves, measured

Twenty learners were put through a thirty lesson course of ten minute videos, on two copies
of the database: one with file 10 only, one with file 11. Every learner watched every lesson
right through, sat every lesson check and the module quiz, and finished every lesson.

| | Without file 11 | With file 11 |
| --- | --- | --- |
| Watch slices left | 36,000 | 0 |
| Lesson check attempts left | 600 | 0 |
| Module quiz attempts left | 20 | 20 |
| Progress rows left | 600 | 600 |
| Storage per learner-course | 269,926 bytes | 12,698 bytes |

That is a **95 percent** reduction in what a finished learner leaves behind.

**How many learner-courses fit in 500 MB**, for a course of thirty ten-minute video lessons:

| | Learner-courses inside 500 MB |
| --- | --- |
| Without file 11 | about 1,900 |
| With file 11 | about 40,500 |

Two honest caveats on those numbers.

The first is that a learner only drops to 12,698 bytes once they have finished. While they
are partway through they hold the full 269,926 bytes. That is not a real constraint though:
even a hundred learners all midway through a course at the same time is about 27 MB, and it
comes back as they finish.

The second is that the 500 MB is the whole database, and my empty measurement was 8.8 MB on a
test copy where the certification tables hold no rows. Yours hold real participants and
certificates, so your actual starting point is higher than 8.8 MB and the figures above are
a little optimistic. Run `select * from lms_storage_report();` after file 11 to see the real
number.

A note on why the saving does not show up immediately: PostgreSQL does not give space back to
the operating system when rows are deleted. It marks it reusable, and the next rows go into
it. So the size on disk stays flat rather than falling, which is fine, because the point is
that it stops growing. The figures above were taken after a `vacuum full`, which is what
reveals the true steady state.

---

## Part C. Permissions stay tight

Supabase grants every privilege on anything new in the public area of the database to both
visitors and signed in users. File 10 took away the three nobody needs. File 11 ends by
calling that same tidy-up again.

Nothing in file 11 creates a table, so this call changes nothing today. It is there to make
the habit automatic, and the rule is now written into STATUS.md: **every future SQL file that
creates an lms_ table must end by calling `lms_tidy_table_privileges()`.**

---

## If something goes wrong

`11_undo.sql` removes the automatic deleting, the nightly clean-up, the report and the empty
questions rules.

It deliberately does **not** put back the old way of deciding whether a lesson is finished,
and does not drop the new columns. Those two are what keep existing learners working now that
some attempts have been deleted. Reverting them would lock people out of lessons they have
already passed. The undo file explains this at the top and gives you a query that tells you
whether a full revert is still safe on your database.
