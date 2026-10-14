# The restructure, explained simply

Think of the Academy as a school that has just doubled in size. This round is mostly about the
filing: where things are kept, who is allowed to look at them, and what happens when somebody sits
an exam.

## Courses can be in more than one place now

A course used to belong to exactly one subject area, because the computer stored that as a single
word in a single box. Python is a programming course. It is also an analysis course, and a
visualisation course, and the one box could only ever hold one of those.

So courses and areas are now kept in a separate list, where one course can appear as many times as
it needs to. One of them is marked as the main one, and that is the one that decides what the
course's picture looks like.

The old single box is still there and still filled in automatically, because quite a lot of the
website reads it, and changing all of that at the same time as this would have been two risky
things at once instead of one.

## The landing page shows tools that do not exist yet

There is a list of every tool the Academy teaches, kept separately from the courses. That sounds
redundant until you notice the point: the list includes tools we have not made a course for yet, so
the landing page can show them and say "Coming soon". You cannot build that list out of the
courses, because the whole point is the ones that are not there.

## Chapters

A facilitator copies the chapter list out of the YouTube description and pastes it in. The computer
reads it into proper rows, so a question can later say "watch from 1 minute 15".

The interesting part is what happens when the paste is wrong. Forty lines, one typo. "Invalid
input" is useless. So every refusal names the line and shows it back: *Line 2 is not a chapter:
"this is just prose"*. There is a second copy of the same reader written in the website's own
language, so a facilitator sees the problem as they type rather than after they save, and there is
a test that feeds both the same thirteen examples and fails if they ever disagree.

## The exam

One exam at the end of a course, and passing it is what earns the certificate.

Twenty questions drawn at random from a bank of at least thirty, so your second try is not your
first try again. Forty minutes, counted by the server and not by your phone, so closing the laptop
does not buy extra time and a dead battery at minute 39 is marked on what you had at minute 40. Two
tries, and then it shuts for a day.

**What a failed result tells you is the careful bit.** It does not say which questions you got
wrong, and it certainly does not say which answers were right. It gives you a list of lessons to
watch again, each with the exact minute to start from. That is enough to go and learn the thing,
and not enough to turn your second try into a corrected answer sheet.

## The sign up form

One form, asked once, before the email code. Most of the questions only appear sometimes: only
someone who went to a university is asked what they studied, only Nigeria has a postal code, only a
corps member is asked about their place of primary assignment.

Those rules are written down twice on purpose, and that is worth explaining because it looks like
duplication somebody should tidy up.

The form knows them, so it is pleasant to fill in: a question that does not apply to you is never
shown, and if something is missing you are told one thing at a time rather than shown a wall of red.

The database knows them too, so the information is actually true. A form is just a web page, and a
web page can be bypassed. Without the second copy, someone could store a university degree on
somebody who ticked "no formal education", and no one would ever know. There is a test that reads
both and fails if they stop agreeing.

## Disability, which gets special treatment

Under Nigerian data protection law this is a special category of personal information, and it is
treated that way rather than as just another field.

Only administrators can see it, one learner at a time. There is deliberately no way to get a list
of them, so there is no screen anybody can build by accident that shows a column of disabilities.
Every single time an administrator opens a learner's record, that is written down with their name
and the time.

Reports only ever get totals, and any total under five comes back as "fewer than five". In a group
of thirty, a count of one is a name.

## One thing that went wrong, and how it was caught

Five of the new tables were left writable by anyone signed in. Not readable by strangers, which is
what you would worry about first, but **writable by any learner with an account**. They could have
renamed a subject area, emptied the tool list on the front page, or rewritten the chapters of a
lesson.

The reason is dull and worth knowing: the database host automatically hands out permissions on
every new table unless you take them away, and an older cleanup routine only takes them away from
signed-out visitors, not from signed-in ones. I had remembered to lock the tables I was thinking
hard about, and not the five I considered boring.

It was caught because the checklist that runs after the restructure has a line that asks, bluntly,
"is anything new readable by a signed out visitor?" That line said no. Chasing why turned up the
bigger problem sitting next to it.

## The eight things Dr Ayoola found afterwards

He ran everything above on his own copy of the database and then went looking for holes, which is
exactly the right thing to do with somebody else's work. He found eight. Here they are in plain
words.

**1. Anybody signed in could read the whole exam, answers and all.** The exam has thirty questions,
and each one has an explanation that is written to be read after you answer, which means the
explanation usually gives the answer away. A rule from much earlier in the project said "anybody
signed in may read the questions of any published quiz", and back then the only quizzes were the
little checks inside a lesson, so that was fine. Then exams arrived, and that old rule quietly
started handing out the exam paper. To anybody. Including somebody who had not bought the course.
Now only staff can read the questions directly. A learner gets them one try at a time, from the
function that hands out an exam, and that function has never included which answer is right.

**2. A refused answer stayed in your pocket for ever.** When somebody fills in the About you form
and one of their answers breaks a rule, the database refuses the lot. The account is kept, and
nothing is stored. That was the idea. But the answers arrive attached to the account itself, in a
little parcel the browser carries about and shows to the server on every request, and the code
only emptied that parcel when the answers were accepted. So the one case where we had decided to
store nothing was the one case where the answers sat there for the life of the account, including
the question about disability, which is the most sensitive thing the form asks. The parcel is now
emptied either way.

**3. The refusal was never written down anywhere.** There was a line that was supposed to record
it, and that line put text into a box that only takes a particular kind of structured note, so it
failed every time. And it was wrapped in a catch-all that threw the failure away without a word. So
a refusal happened, nothing was stored, nothing was recorded, and nobody found out. It is recorded
properly now, and the health page shows a warning for a week afterwards, because a run of refusals
almost always means the form and the database have stopped agreeing about a rule.

**4. Some accounts never got their answers unpacked at all.** The unpacking was set to happen "when
an account's email becomes confirmed". An account that is made already confirmed, which is what
happens when an administrator creates one by hand, never becomes confirmed, because it already was.
So those accounts kept their parcel and never got a profile row. It now also happens when an
account is created, and there is a one-off sweep for any that were already sitting there.

**5. Abandoned sign ups were never deleted.** The brief said unconfirmed sign ups should go after a
day, and the first version simply did not do it. Writing it turned up a trap worth knowing about.
Every new account is automatically given the free courses, by a rule from the very beginning of the
project. So "delete accounts that have no courses" would have matched nobody at all, and the job
would have run every night for ever and deleted nothing, without an error anywhere to say so. It
now ignores the automatic free grants and keeps any account that has a grant somebody had to give
it, plus anything else at all: an attempt, any progress, any watching, any answers, a certificate.

**6. A country could be anything you typed.** Dr Ayoola stored a country called
`<script>alert(1)</script>`, which is both funny and the sort of thing that ends up in a report one
day. The 195 countries and 37 Nigerian states now live in two small tables, and the database checks
against them. The form's list and the database's list are compared by a test, so if somebody edits
one and forgets the other, `npm test` says so.

**7. Two functions were callable that had no business being callable.** They are run by the
database itself and would not have done any harm if a browser had called them, but there is no
reason for anything to be reachable that does not need to be.

**8. The browser has to ask for a new token after confirming.** This one is for the pages, not the
database. The parcel in point 2 is emptied by the database the moment the email is confirmed, but
the browser is holding a copy that was made a moment earlier, and it keeps using that copy for up
to an hour. So the page asks for a fresh one straight after the code is verified. That is part of
Part B.

---

# Part B, the pages, explained simply

Part A was the filing cabinet. Part B is what a learner actually sees. Thirteen things, and the
interesting ones are all the same kind of problem: the easy version of the page is the one that
quietly loses somebody.

## The areas wrap. They do not slide

The seven subject areas are a row of buttons. The ordinary way to fit a row that is too wide is to
let it scroll sideways, and almost every website does. The trouble is that nothing on the screen
says it scrolls. Somebody sees four areas, assumes there are four, and never finds the other three.

So the row wraps onto a second line instead. It is less tidy and it is the right thing.

The same choice turns up again under it. Press a tool and a panel of detail opens. It would be
easier to put that panel at the bottom of the whole grid, but then pressing a key on the top row
makes something appear a long way from where you pressed, and it reads as the page jumping. So the
panel opens immediately after the row the key you pressed is in, and a little arrow points back up
at your key.

## The moving strip stops when you touch it

There is a strip of goals near the top that changes itself every few seconds. Anything that moves
by itself is a small act of rudeness, so it is hedged about:

- it stops the instant a mouse, a finger or the keyboard reaches it
- after a touch it stays stopped, because on a phone you cannot "move away" again
- for somebody whose phone or computer is set to reduce motion, it never moves at all

It deliberately has no pause button. A pause button is what you add when the thing does not stop by
itself, and then people have to find it.

## Filters do not go in the address

The catalogue has two switches: free to start, and under 90 minutes. Press one and the list
narrows, but the web address stays the same.

That is on purpose. If each combination of switches had its own address, Google would find four
different addresses all showing nearly the same list, and we have already told Google there is one
catalogue page. It works in the other direction though: the three "Quick picks" on the landing page
open the catalogue with a switch already on, because somebody arriving from outside needs a way in.

## You have to watch the whole lesson

The old rule was 92 per cent, which sounds like the whole thing and is not: on a twenty minute
lesson it lets you skip the last minute and a half, which is exactly where somebody puts the
summary. It is 100 per cent now, and the strip of cells under the video fills up as you watch so you
can see what is left.

Chapters are a jump list under the video, but you can only jump to a chapter you have already got
to. Otherwise the chapter list is simply a way to skip the lesson. How far you have got is a number
the database keeps, not one the page keeps, so making the page lie about it does not help anybody.

And the speed menu goes up to 1.5 the first time through, and up to 2 after you have finished it
once. Revision at double speed is sensible. A first watch at double speed is not watching.

## A wrong answer gets a place to look, never the answer

Get a check question wrong and the page offers you "Watch this part again", and takes you to the
chapter the question came from. What it never does is tell you which option was right. The reason
is not strictness, it is that the test has to be worth something, and an exam that hands over its
own answer key does not measure anything. The database does not send the right answer either, so
there is nothing on the page to find.

Get it right and you get the explanation, because then there is nothing left to give away.

## One exam, at the end

There used to be a short quiz after each module. Those are gone, and there is one exam at the end of
each course instead: 20 questions out of a bank of 30, 40 minutes, 70 per cent to pass, two tries
and then a day's wait.

The clock is the database's clock. The page shows a countdown, but if the page and the database ever
disagree, the database wins, and an answer that arrives after the deadline is marked as if it
arrived at the deadline. Otherwise the timer is a suggestion.

You can read the rules before the exam opens, which costs nothing and means the numbers are not a
surprise on the day.

## A course you have already done counts

Some courses are in two paths. Finish Python in the Analyst path, start the Engineer path, and
Python is already done. The page could simply tick it, and then it looks like a bug. So it ticks it
AND says which path it came from, and the path counts them up: "2 of 6 courses, 1 counted from
another path".

## What we suggest next, and why

When you finish a course, the page used to offer you the catalogue, which included courses you had
already finished. Now it offers a short list worked out by rule, and every one of them says why it
is there: the next course in your path, the next tool in the same area, and so on.

There is a line on the page saying these are never from what anybody paid to show you. It is there
because it is true and because it will stay true: the list is built from rules in the database, and
there is nowhere in it for somebody to buy a slot.

## The popup

There is one, and it is a card in the bottom corner rather than a sheet over the page, so nothing
behind it is blocked and you can carry on reading. It waits three seconds, and only appears if the
tab is still in front, because a box over a page that has not arrived yet is a box over nothing.

It can appear on the landing page, the catalogue, a course page and My learning. It can never appear
on a lesson, a check or an exam: somebody watching a lesson is doing the thing we asked them to do,
and somebody sitting an exam has a clock running. That rule is written in the page AND in the
database, on purpose, so that adding a popup to a lesson has to be done twice by somebody who means
it.

It has no "do not show again" link. How often it appears is set on the popup by whoever makes it,
because a "never again" promise is one the next campaign breaks, and that is what teaches people to
close a box without reading it.

## The two things you found at 1024 pixels

The tool name "KoboToolbox" was breaking in the middle, as "KoboTo" and then "olbox". A long name
now takes a smaller size, worked out from its longest word rather than its total length, and there
is a test that fails if any name in that rack can break inside a word.

Two of the floating tiles were half off the right edge of the window at exactly 1024. Fixed, and
while measuring it I found a third one I had not been told about: at 1180 a tile was sitting on top
of the card's text. The measurement now runs at fifteen widths and reads the real boxes out of the
browser, and it fails if any tile is off the window or on top of anything.
