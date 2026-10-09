# What file 13 does, explained simply

Two jobs. One gives a learner the certificate they have earned. The other stops a learner from
cheating the video rule by lying about how long the video is.

---

## Part A. A certificate at the end

### What was wrong

A learner could watch every lesson, pass every quiz, reach the end of the course, and get nothing.
Not an error, not a message. Nothing happened, because nothing in the system turned "finished" into
a certificate.

The bootcamp side has had this for ages: pass the assessment and a certificate appears. The Academy
simply never had the equivalent written.

### What was built

One function, `lms_claim_course_certificate`. The page calls it when a learner reaches the end, and
it checks two things before it issues anything:

1. **Every lesson in the course is complete** for this learner.
2. **Every module quiz in the course has been passed** by this learner.

If either is not true, it says exactly how far along they are: "Not finished yet. You have completed
4 of 6 lessons." Then it does nothing.

**Lesson checks are deliberately not on that list.** A lesson is not marked complete until its check
is passed, so they are already counted once. Counting them a second time would mean a learner who
passed a check before some rule changed could be locked out of their certificate forever, with no
way to fix it.

### It uses the certificate system that already exists

This is the part worth understanding, because it is why `/verify/:number` keeps working with no
change at all.

The certificate it writes is **the same kind of row** the staff console writes and the bootcamp
assessment writes. Same table, same numbering, same public check page. The number is produced by
calling the existing `make_certificate_number`, not by a second copy of that logic, because there
should be exactly one place in the system that decides what a certificate number looks like.

The course points at a programme, and the certificate is issued against that programme. That is the
whole link.

### Calling it twice is safe

The page may call it every time somebody opens the last lesson. The function looks for an existing
certificate first, and if there is one it hands back the same number with "You already have this
certificate. Here it is again."

### A withdrawn certificate is not quietly brought back

If a certificate was issued and later withdrawn by a member of staff, finishing the course again
does **not** undo that.

This is a deliberate choice and it is worth saying why. Withdrawing a certificate is something a
person does on purpose, usually for a serious reason. A function that silently reversed it would
make the withdraw button a lie: staff would press it, and the next time the learner opened their
course the certificate would come back. So instead it stops and says to contact us.

---

## Part B. Nobody can shrink a video to skip it

### The hole, in one sentence

The non skippable rule is "watch 92 percent of `duration_seconds`". Coverage is a **percentage of a
number**. So whoever can write that number controls the rule: set a two hour video to 10 seconds and
a single ten second slice is the whole course.

### What was already true, and now proven rather than assumed

A learner cannot reach that column. The rule that allows editing a lesson at all requires staff, so
a learner's attempt simply changes nothing.

That was already the case before file 13. What was missing was a **test** saying so. It is now test
U1, and it will fail loudly if anybody ever loosens that rule by accident.

Something else came out of writing it, which is a nice bit of belt and braces nobody planned: a
learner cannot even **see** a lesson on a draft course. The first version of the test read the
length back as the learner to check it had not changed, got nothing at all, and failed. The test now
reads it as the owner.

### The new risk, named plainly

You asked for the player to be able to correct a wrong length when a **staff member** previews a
lesson. That needs a function, and a function of this kind runs with the owner's permissions, which
means the ordinary rules do not apply to it.

**So that one check inside the function is the only thing standing between a learner and the column
that controls the whole non skippable mechanism.** If it is ever removed, nothing visible breaks.
The videos still play, the bar still fills, and the rule quietly stops meaning anything.

That is why there is a long comment above it in the file saying exactly this, and why tests U2 and
U3 exist: U2 proves a learner is refused, U3 proves a facilitator is allowed. Neither should ever be
deleted.

The function also refuses a length below 1 second or above 24 hours, and refuses to change a course
that is already live unless you are the administrator, which matches how every other lesson column
already behaves.

### Something I got wrong, and what the database told me

I set out to split the publish checklist item "Every video lesson has its video" into two, so a
facilitator could see whether the video or the length was missing.

Then the test seed refused to insert my fixture. The lessons table carries a rule saying a video
lesson has its **provider, its reference and its length together, or all three empty**. So "missing
video" and "missing length" are always exactly the same lessons, and my two items would have printed
the same thing twice.

What was actually missing was **which lessons**. The item now names them: "Still missing: Lesson one,
Lesson four."

---

## The new publish rule, and who it affects

The checklist has one genuinely new item: **a course must have a programme before it can be
published.**

Without one there is nothing to issue a certificate against, so a learner would pay for a course,
work through it, reach the end, and find there is no certificate. Much better to refuse at
publishing time, when somebody can still fix it.

**This changes behaviour for existing courses**, and three tests in the earlier suites failed when I
first ran them because their courses had no programme. Those tests were right to fail: the fixtures
predated the rule. I gave them a programme, which is what a real course will have.

**On your live database this affects nothing today**, because there are no Academy courses yet. That
makes now exactly the right moment to introduce the rule, rather than after a dozen courses exist.

`13_verify.sql` row 11 lists any course that cannot be published, by name, so this can never be a
surprise.

---

## If something goes wrong

`13_undo.sql` removes both functions and puts the publish checklist back.

**It does not remove certificates that have already been issued, and it must not.** Somebody
finished a course and was given a qualification. Taking it back because we are rolling back a piece
of code would be dishonest, and the `/verify` link may already have been sent to an employer. To
withdraw one deliberately, use the staff console, which records a reason. That is a different act
from undoing a file.

The undo file carries a query at the top showing you every certificate the Academy issued, so you
can see what exists before changing anything.
