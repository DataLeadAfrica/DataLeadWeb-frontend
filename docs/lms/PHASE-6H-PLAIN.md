# Phase 6H, file 28, in plain English

Attendance for bootcamp participants, and the short screen a learner fills in the first time they
sign in.

## The thing it does

A bootcamp meets, in a room or online, and somebody has to record who was there.

**In the room:** a member of staff scans the QR on the participant's ID card with a phone. The
scanner shows the participant's name, so staff are looking at a name and a face at the same moment.

**Online:** the facilitator reveals a code during the class and reads it out. It works for about
twenty minutes, which staff can change, and each account can use it once.

**Either way** there is one attendance record per participant per day, and only somebody who checked
in can open that day's short form. Everybody else sees it locked.

## Why the rules are in the database and not in the page

A page can be changed by the person looking at it. A browser is a program on somebody else's
computer, and anything it is allowed to do, it can be made to do.

So none of the five new tables can be written from a browser at all. Not restricted: not allowed.
The permission is removed, exactly the way file 26 removed the others, and every change goes through
a function that checks who is asking.

This matters more than it sounds. If a learner could write their own check-in, they could set the
method to "scanned" and name a member of staff who never scanned them. The record would look
identical to a real one.

## Two tables cannot even be read from a browser

For the same reason `quiz_options.is_correct` never leaves the server.

`lms_attendance_days` holds the fingerprint of the access code. `lms_participant_cards` holds the
secret token that the QR carries. A permission to read either would hand out the very thing it is
protecting, so neither has one. Learners and staff read what they are allowed to through functions
that do not select those columns.

## The code is never stored as itself

What is kept is a salted SHA-256 of it. Fingerprints work one way: a code can be checked against one
but cannot be read back out of it. So a copy of the database shows `9f2a41bc8e...` and never
`PURPLE42`, and the real code exists only on the facilitator's screen for as long as the window
lasts.

**Said plainly, because it should not be a surprise later:** this does not stop a participant in the
room photographing the revealed code and sending it to somebody within those twenty minutes. That
friend's own account can use it once. The short window, the single use per account and the live
reveal make that narrow, not impossible. The facilitator can reveal a fresh code mid-class, which
kills the old one instantly.

## The four loopholes

**Somebody scans a friend's card.** The scan function refuses any account that is not a facilitator
or an administrator, so there is no learner account on the site that can scan anything at all, their
own card included. The screen then shows the name, large, so staff can check it against the person.

**The code leaks.** Short window, one use per account, revealed live only, and regenerable on the
spot.

**The network dies in class.** The scanner keeps working. Each scan is saved on the phone with its
own receipt number, and the phone sends them when the signal returns. Duplicates cannot happen
because the database physically refuses a second record for the same person on the same day, and the
receipt number means a scan resent by a phone that was not sure writes nothing rather than a
duplicate. The worst case is a scan arriving late, never a person counted twice and never a person
lost.

**Which day a scan belongs to.** The server's clock is UTC, an hour behind Lagos, so at half past
midnight here the server still thinks it is yesterday. Every "what day is it" in this file asks
specifically for the date in Lagos, and a check-in belongs to the day the facilitator opened rather
than to whatever the server thinks today is.

## The ID card

Two values per participant, not one.

**A number people can read,** printed on the front, like `DLA-26-7K4QP`. No character that can be
misread: no capital O beside a zero, no capital I beside a one. This is what somebody quotes on the
phone.

**A secret token,** 32 random characters, which is the only thing inside the QR.

Two rather than one because if the QR held the tidy number, anybody who saw one card would know the
shape of every other and could print a working fake. A random token cannot be guessed.

**The QR holds the token and nothing else. Not a web address.** A QR carrying a link would turn a
lost card into a working door into the system, and would let somebody print a card pointing at a
copycat site. A bare token does nothing at all in an ordinary camera app.

**There is no card lookup.** No function anywhere answers "who is this card". The scanner does show a
name, because you need it to check the face, but it comes back only as the receipt for a successful
attendance write when a day is open. No open day, no name. So the scanner cannot be used to find
people: the only way to learn a name from a card is to mark that person present in a class that is
running now, as staff, on the record.

**A lost card is revoked, not deleted.** Marking it lost replaces the token and keeps the number, so
the old card stops working the instant it is pressed and the participant's paperwork does not
change.

## The first-sign-in screen

Four questions and one optional note, about a minute.

It asks for a preferred name, whether they are working on a laptop or only a phone, how reliable
their internet is, and how much they have done with the topic before. The optional one is what they
want to get out of it.

**It does not ask the six things the sign-up page already asks.** Age band, gender, state, education
level, current status and how they heard about the Academy are all collected by the About you section
of the sign-up page, which nobody can get past. The screen shows those back, read only, with a line
saying to ask staff if they need changing. Re-asking them is how a form teaches people that it does
not know what it already knows.

**Only staff can change a name, and the reason it holds is unusual.** The screen shows the name read
only because the screen has **nowhere to write a name to**: there is no name column in the new table,
no permission, and no parameter on the save function. That is stronger than a disabled text box,
which a determined person can re-enable in their browser.

## Why the new fields are not in `lms_learner_profiles`

That table holds the disability answer, so file 26 stripped it right back: a learner cannot read
their own row at all, and the only way in is one administrator function that writes an audit line
every single time it is used.

That is correct for sensitive personal data. It is wrong for "do you have a laptop". A facilitator
who wants to know who is working on a phone before setting an exercise should not be setting off a
sensitive-data audit entry.

So the practical answers live in a plain table of their own, and the sensitive one is not touched.

## Nothing is deleted

A day is closed, not removed. A record can be corrected by an administrator, which notes who changed
it and why, and the row keeps its history. No function in this file deletes an attendance record or
a form answer.

## What the 14 verify rows mean

| Row | What a NO would mean |
|---|---|
| 1 | File 28 did not finish. Fix this first, nothing below reads correctly. |
| 2 | Part of file 28 is missing, so attendance cannot be taken. |
| 3 | A learner could write a check-in directly, and invent the staff member who scanned them. |
| 4 | A write policy exists, which allows writing every column of a row, not just the safe ones. |
| 5 | The access code fingerprint or the card token can be read out of the browser. |
| 6 | The code is being stored in a readable form. |
| 7 | The same person could be marked present twice, and the register would overcount. |
| 8 | A resent scan is refused with an error rather than a quiet "already in". |
| 9 | Somebody could send the form twice and skew every average. |
| 10 | A scan after midnight in Lagos lands on the day before. |
| 11 | A name column exists that a learner could write. |
| 12 | Some table in this family can be emptied in one statement, which no policy can refuse. |
| 13 | **Expected on day one.** Participants still waiting for an ID card. A worklist. |
| 14 | Something in this file deletes attendance instead of correcting it. |

Row 12 is the one that will still be working in a year. The others check a list of known mistakes.
That one asks the general question, so a table added by a later file with the default grants is
caught without anybody remembering to come back and add a row.

## Rough size

Measured rather than estimated, by building the tables and filling them with 100 participants over
60 days: about **4.2 MB** including every index, which is **0.83%** of the 500 MB the Supabase free
plan allows. A hundred cohorts would fit before the size became a conversation.
