# The control room, explained simply

The Academy has two sides. Learners see one. The people who build it see the other, and that other
side is what this round is: a room at `/lms/studio` with everything in it.

## Two kinds of staff, and the difference is not a menu

**Facilitators build.** They write courses, write the questions, and send a course to be looked at
when it is ready.

**Administrators also publish, set prices, look after people and run the site.**

The interesting part is where that rule lives. It would be easy to build this by hiding buttons: no
Publish button for a facilitator, no Learners link, done. That is not a rule, it is a decoration.
Anybody who knows the address can type it, and anybody who knows how the site talks to the database
can ask the database directly.

So every one of those rules is written into the database itself. A facilitator who finds the
publish function and calls it is refused by Postgres, with a message explaining why. The hidden
button is a courtesy on top of that; the refusal is the thing. There are tests that sign in as a
facilitator and try.

## A facilitator never sees a learner's name

Not in a list, not in a report, not in the activity log, not in an export. The functions that
return learner information all begin by refusing anybody who is not an administrator, and there is
no facilitator-shaped version of any of them anywhere.

That is easier to keep than it sounds, because the way to keep it is to have nothing to hide: a
facilitator's version of a report is not a report with the names blanked out, it is a report that
was counted without them.

## The nine checks

A course cannot be published until nine things are true: it has a title, a description, an area and
a tool, at least one lesson, at least three things a learner will be able to do, a video and a
length on every video lesson, a check on every video lesson, a certificate programme, and enough
questions in its exam.

The useful part is that there is **one** list. The panel a person looks at and the function that
decides whether to publish are the same list, so the panel cannot show nine green ticks beside a
refusal. Each failing row has a button that takes you to the thing that is wrong.

### The one that would have deadlocked

Check 7 is "every video lesson has a lesson check". The obvious way to write it is to ask whether
the check is published. That would have been a trap: only an administrator may publish a set of
questions, so a facilitator could never get their own course to nine green ticks. The last thing
standing in their way would have been something they are not allowed to do, and they would have
sent it for review with a red row and no way to explain it.

So check 7 asks whether a check exists and has a question in it, and **publishing the course
publishes its checks**. One deliberate act by an administrator rather than fourteen.

Nobody would have found that by reading the code. It turned up when I wrote the test that builds a
whole course from nothing to published: every piece worked on its own.

## What a live course will let you change

Words, yes. Video, length and order, no.

Fixing a typo on a live lesson should not require taking the course down, because a rule like that
is how typos stay. But changing the video under somebody who is halfway through, or shuffling the
lesson order, moves the ground beneath them.

The same idea applies to questions. Once anybody has been **served** a question, its options and its
answer are frozen: a learner marked wrong against option B stays marked against the B that was
there on the day. The wording can still be improved. To change an answer you retire the question
and write a new one, and retiring keeps the row, so every old attempt still makes sense.

Note "served", not "answered". Somebody with the paper open has already seen those options.

## Pasting a sheet of questions

Columns: Question, A, B, C, D, Right, Why, Lesson, Time. Copy the rows out of Excel and paste them
in.

Every row is judged and the answer says which were skipped and why, row by row. The alternative,
refusing the whole paste because three rows out of forty are wrong, is what makes somebody paste
eight times.

Nothing is written until every row has been read. A paste that half worked is worse than one that
did not: you fix the sheet, paste again, and now you have duplicates.

## The log nobody can edit

Every publish, price change, access change, exam wait lifted, export and staff change goes into one
table. A trigger refuses every change and every delete on that table, to everybody, including an
administrator. The only thing anybody can do to it is add a line.

That is what makes it worth reading six months from now. A log you can edit is not a log.

It also never fails the thing it is recording. A log that can refuse a publish is a log that will
one day stop somebody publishing, so if it cannot write, the work still happens and the problem
turns up on the health page instead.

## Sensitive answers

Some of what learners tell us at sign up is sensitive personal data under the Nigeria Data
Protection Act 2023. Disability is the clearest case.

- Only administrators can read it.
- One learner at a time, never in a list.
- Every read is recorded.
- What somebody wrote in their own words is behind a button, not on the screen by default. An
  administrator who opened the record to check an exam wait has no reason to read it, and a page
  that shows it anyway makes that decision for them.
- Reports show totals only, and any group smaller than five people shows as the words "fewer than
  5" rather than a number.

The last one has a subtlety worth writing down. If one row said 3 and the rest were exact, next to
a grand total, the 3 would be recoverable by subtraction. So when any group in a report is small,
**every** group in that report is suppressed. And the suppressed rows draw no bar at all, because a
small bar would put the number back on the screen in a different form.

## Four things found while building it

**1. Giving somebody access could silently do nothing.** A learner may hold only one live grant per
course. Giving a scholarship to somebody who already had the free grant did nothing at all, and the
log recorded that access had been given. A silent failure is recoverable. A log that says a thing
happened when it did not is what you later make decisions from. It now lifts the existing grant,
and the log carries what it was before.

**2. Nothing could publish a lesson check.** Described above.

**3. Two of my own permission tests were proving nothing.** The test harness connects as the
database's owner, and row level security does not apply to an owner. One test returned zero and
looked like a pass purely because the table it read happened to be empty. Both now run as an
ordinary signed in user, which is the situation a browser is actually in.

**4. I overwrote the blog studio's stylesheet.** The control room went into `src/pages/Studio`,
which already belonged to the blog tool, and one file with the same name was replaced. Caught before
delivery, restored from git, and the control room moved to a folder of its own. The lesson is older
than the mistake: look at what is already there before writing into it.

## What it does not do

**It cannot make an administrator.** That is done in Supabase by somebody who already holds the
project keys. The page that can make an administrator is the page worth attacking, so there is no
such page.

**It cannot revoke a certificate.** The Certificate console already does that, already records it,
and two places that can revoke a certificate is one too many for something nobody can take back.

**It cannot delete a lesson somebody has watched.** Nothing a learner has touched is hard deleted,
which has been the rule since the third database file.

## What each check in 17_verify_EDITOR.sql means

The file Big Sam pastes into the Supabase SQL Editor says only "check 1", "check 2" and so on,
with nothing in the note column. That is deliberate: the Editor appears to choke on explanatory
prose, and the short version is the one that runs. The full `17_verify.sql` carries the same checks
with their explanations, and is for reading and for psql.

Here is what each number is checking, and what a NO would mean.

| # | What it checks | What a NO means |
|---|---|---|
| 1 | The activity log can only be added to | Item 11. Without this an administrator could quietly edit or remove a line. A log you can edit is not a log. |
| 2 | A course is born with a programme, a module and an exam | Item 1. A course missing any of the three cannot be published and nobody can see why. |
| 3 | A facilitator cannot publish a course | Item 12. The check is in the database, not only in the page. Test 3a in file_17_tests signs in as a facilitator and tries it. |
| 4 | A facilitator cannot read another facilitator course | Item 12. One function decides it, so the course list, the builder, the banks, the reports and the log cannot disagree. |
| 5 | A facilitator cannot read lms_learner_profiles | Item 12. A facilitator sees no learner name or email anywhere, and the lms_learner_profiles rows are behind file 16 policies as well. |
| 6 | The nine publish checks exist, with a fix it target each | Item 1. The page draws what this returns, so the panel and the publish gate are one list rather than two opinions. |
| 7 | And lms_course_blockers was left exactly as file 11 wrote it | File 11 step 0 looks up that exact signature and refuses to run if it has changed. Widening it would have made file 11 unrunnable for ever. |
| 8 | Publishing a free course still opens it to everyone who already has an account | File 05 did this and it had to survive the rewrite. Without it only people who sign up after today would ever get a free course. |
| 9 | Publishing a course publishes its lesson checks | Item 1. File 10 says only an administrator publishes questions, so without this a facilitator could never reach nine green ticks. |
| 10 | On a published course the words can change | Item 1. File 10 refused every change including a typo fix. This loosens that one part and keeps the rest. |
| 11 | But the video, the length and the order cannot | Item 1. Changing those moves the ground under somebody halfway through. |
| 12 | There is one lesson guard, not two | Two triggers that have to agree about one rule is one too many, and the second one would never fire anyway. |
| 13 | A question anybody has sat is frozen | Item 3. Changing an option after the fact changes what a mark meant. Wording can still be improved. |
| 14 | A question counts as sat the moment it was SERVED | Item 3. Somebody with the paper open has already seen those options, whether or not they have answered yet. |
| 15 | A pasted sheet skips bad rows rather than refusing the lot | Item 3. Refusing forty rows because of three is what makes somebody paste eight times. |
| 16 | And nothing is written until every row has been read | Item 3. A paste that half worked is worse than one that did not: they fix the sheet, paste again, and now have duplicates. |
| 17 | Access cannot be given without a reason | Item 4. Why does this person have the paid course is a question that gets asked. |
| 18 | And giving access lifts an existing grant rather than doing nothing | Item 4. There is one live grant per learner per course, so on conflict do nothing meant a scholarship silently did nothing while the log said it had worked. |
| 19 | Bootcamp access is not given by hand | Item 4. Bootcamp access follows the enrolment. Given by hand it would be undone by the next roster sync and nobody would know why. |
| 20 | Removing access revokes rather than deletes | Nothing a learner has touched is hard deleted, which has been the rule since file 03. Their progress stays exactly where it is. |
| 21 | Lifting an exam wait does not hand anybody a pass | Item 4. It moves the clock so the exam opens again with fresh questions. The tries are still spent and the scores still stand. |
| 22 | Who our learners are is administrators only and counted by file 16 | Item 7. File 16 already returns fewer than 5 and suppresses every group when any one is small. A second count here would be a second chance to get that wrong. |
| 23 | And every read of it is logged | Item 7. The page where the sensitive answers are should leave a trace that it was looked at. |
| 24 | CSV downloads are logged | Item 7. Who asked for which file and when. An export is the moment data leaves the place that protects it. |
| 25 | A facilitator cannot export learner data | Item 7. |
| 26 | A hard question needs at least five answers before it is called hard | Item 7. Under five is a new question, not a hard one, and putting it top of the list sends somebody to rewrite a question two people happened to miss. |
| 27 | A popup can never be put over a lesson, a check or an exam | Item 9. Said in the function, in the check constraint and in the page, on purpose. |
| 28 | A new popup starts as a draft | Item 9. A box over the whole site is the one thing in here where a slip of the hand is seen by everybody. |
| 29 | Starting one popup stands the others down | Item 9. One at a time, in the same statement, so there is no moment when two are live. |
| 30 | Nobody can be made an administrator by any page | The page that can make an administrator is the page worth attacking, so there is no such page. |
| 31 | Nor can anybody change their own role | An administrator who demotes themselves by accident has locked everybody out. |
| 32 | Adding and removing a facilitator is still file 10 work | File 10 raises somebody only if their account is confirmed, and guards against demoting an administrator. My replacement did neither, so file 17 leaves it alone. |
| 33 | A price change records the old number and the new one | Item 2. A price that moved and nobody remembers moving is an argument with a learner that staff cannot win. |
| 34 | The activity log shows a facilitator nothing about a learner | Item 11. The whole row is dropped rather than blanked: access given to somebody, with the name removed, still tells them a thing they have no business knowing. |
| 35 | Nothing in file 17 is callable by a signed out visitor | Item 12. Supabase grants execute on every new function to anon by default. A signed out visitor has no business in the control room. |
| 36 | And the log writer and the triggers are callable by nobody | Item 12. These are called by the database and never by a browser. |
| 37 | A lesson check can be published at all | lms_publish_exam reads serve_count and raises No such exam when it is null, which it always is for a lesson check. Until file 17 there was no way to publish one. |
| 38 | Sending a course back needs a note | Item 1. A course sent back with no note is a course nobody knows how to fix. |
| 39 | Ready for review is a draft that was sent, not a new enum value | Postgres will not let a new enum value be USED in the transaction that adds it, and file 17 is one transaction. Being sent is also an event with a sender, a time and a note, which an enum value cannot hold. |
| 40 | The log writer never fails the thing it is recording | Item 11. A log that can refuse a publish is a log that will one day stop somebody publishing. The failure is recorded in system_health instead. |
| 41 | Nor can an administrator demote the other administrator | Refusing to CREATE an administrator and refusing to change your OWN role feel complete together and are not. Without this, either administrator could make the other a learner, and with two of them that is one press away and then no one can publish at all. |

## What each check in 18_verify_EDITOR.sql means

Nine rows. The Editor copy says only "check 1", "check 2" and so on, for the same reason as file
17's, so this is where to look when one says NO.

**Rows 2 to 6 are one fault, and it was live.** A signed in learner could write any column of
their own profile. A policy can say which ROW somebody may change, and it cannot say which
COLUMNS, so the table-wide grant meant every column was fair game.

| # | What it checks | What a NO means |
|---|---|---|
| 1 | A person can set their own name | There is no way to save a name, so the greeting falls back to the first part of the email address. Somebody signed up as a.samuel@example.com is greeted as "a.samuel" and told that is their name. |
| 2 | A signed in person cannot write every column of their own profile | The serious one. Table-wide UPDATE is still granted, so rows 3 and 4 cannot be relied on either. |
| 3 | A learner cannot point themselves at somebody else's certification record | **The hole.** A learner can set their own `participant_id` to any certification record nobody has linked yet, and the certificate pages then show them that person's certificates. An unlinked record is the normal case for anybody certified before they made an Academy account. File 05 says in its own comment that linking is only ever done on a proven address. |
| 4 | A learner cannot write their own role | The policy refuses this too, by checking `role = lms_my_role()`. It should be refused twice, by privilege and by policy, so that neither has to hold on its own. |
| 5 | The only columns a person may write are their name and their phone | Says exactly which columns are writable rather than only which are not, so a column somebody adds later is refused by default instead of being allowed because nobody thought about it. That is how this fault happened. |
| 6 | A visitor who is not signed in can write nothing | Nobody signed out should be able to change a profile at all. This row says yes even before file 18, because it was already true. |
| 7 | Only a signed in caller may run the name function | The function writes a profile row, so a signed out caller must not reach it. |
| 8 | The name function refuses an empty name | A blank name saved over a real one leaves somebody worse off than before they tried. |
| 9 | The name function only ever writes the caller's own row | It takes no id, so there is nothing to point elsewhere. A NO would mean somebody had given it one. |

### What to do if row 3 says NO

Run `18_profile_name_EDITOR.sql`. If it has already been run and the row still says NO, stop and
say so: it would mean the grant has been handed back by something else, and the undo file is the
only thing in the package that does that on purpose.
