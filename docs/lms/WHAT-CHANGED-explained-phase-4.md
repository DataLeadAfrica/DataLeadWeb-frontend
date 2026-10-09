# What Phase 4 built, explained simply

This is the part where people actually learn: watch a lesson, answer the questions, pass the
module quiz, get the certificate.

Before any of that could be built, two rules in the database had to be fixed, because both of
them could lock a learner out of a course they had paid for, permanently, with no way back.

---

## 1. The two traps

You spotted both of these before I did. Here is what they actually were.

### The lesson check could end the course

A lesson check is three or four quick questions after a video. It is not an exam. Its whole job
is to make the lesson stick.

When one is created, the database gives it a **100 percent pass mark** and **20 tries**.

The pass mark is right: you should keep going until you have it. The twenty tries were a
disaster, and here is the chain:

1. Twenty wrong answers, and the function that starts a check returns **nothing**.
2. The lesson cannot be marked done without passing its check.
3. The next lesson does not open until this one is done.
4. So the course can never be finished, and no certificate can ever be issued.

And the learner sees **none of that**. They see a button that does nothing. No message, no
explanation, nowhere to go. The only way out was somebody logging into the database and writing
SQL by hand.

Think about who this actually happens to. Not somebody cheating. Somebody tired, on a phone, on
a slow connection, tapping the wrong option a few times. Three questions.

**The fix:** a lesson check now has **no try limit at all**. None. You have already watched the
lesson, and getting the answer right eventually *is* the lesson.

### The module quiz could lock the certificate away

Same shape. Three failed tries and the quiz never opened again, so the certificate was
unreachable for ever.

**The fix:** after three tries the quiz shuts for **24 hours**, then opens again with **three
fresh tries**. The wait is deliberate: it sends somebody back to the lessons instead of guessing
again straight away. But it always opens.

### How I made sure

The same way as last time: I wrote the tests first and ran them before writing any fix, so I
could watch them fail for the right reason. They printed this:

```
10  FAIL  A LESSON CHECK NEVER LOCKS ANYONE OUT: try 21 still opens
          LOCKED OUT. The lesson, and the course, can never be finished
14  FAIL  NOBODY IS TRAPPED: the quiz says when it opens again
          NO REOPENING TIME. Shut for ever
```

**Nine passed and thirty six failed.** Then I wrote file 15 and ran them again: **all forty
seven passed**, and so did the other 206, which makes 253.

---

## 2. Four other things the database was getting wrong

### Wrong answers hid the explanation

Every question can carry one sentence saying why the answer is what it is. That sentence is the
most useful thing in the whole quiz.

The old rule showed it **only when you got the answer right**.

Read that again. You get it right, you are told why. You get it wrong, you are told nothing.
Exactly backwards. Now a lesson check shows every question, right or wrong, with its
explanation.

### The module quiz gave away too much

The same function also told you which questions you got wrong on a **module quiz**. With three
tries at ten questions, that is solvable by elimination without watching a single lesson.

So now a module quiz tells you **nothing** per question until you have passed it. Once you
have, you get the full review with every explanation, because at that point it is revision
rather than a leak.

Two opposite fixes to the same function, because a check and a quiz are different things.

### Resume sent you to the wrong place

The database stored "the furthest point you ever reached" and called it "where you were".

So: you watch to seven minutes, you do not follow a bit, you rewind to two minutes, you watch it
again, you stop. Come back tomorrow and you are dropped at **seven minutes**. The one number
whose entire job is "where was I" was storing something else.

It stores the latest position now. How much you have watched is counted separately, so nothing
is lost by this.

### The "this week" chart would have erased itself

The obvious way to draw a weekly chart is to count the ten second slices the database records
as you watch.

It cannot work. There is a tidy-up that **deletes a lesson's slices the moment you finish the
lesson**, to keep the database small. So finish three lessons on Monday, open the page on
Tuesday, and Monday shows zero. The harder you worked, the less the chart would show.

So the minutes are now counted once, as they happen, into a tiny table nothing ever deletes.
One row per learner per day, about twenty bytes. Days are counted in **Lagos time**, because a
chart whose days change at 1am local time is wrong for everybody looking at it.

---

## 3. The pages

### My course

One screen for a course you are working through: the ring, the modules, every lesson with its
state, the module quiz, the certificate checklist, and your week.

**One button to carry on.** It goes to the exact lesson and the exact second. Nobody should have
to hunt for where they stopped, and that second is the whole reason the resume bug above had to
be fixed first.

**Every state is a different shape, not a different colour.** Done is a green disc with a tick,
the current one is an orange ring, locked is a padlock. About one man in twelve cannot reliably
tell orange from green, and a course outline that only works in colour does not work.

A locked lesson is **not a link**. Making it one and then refusing on the next page wastes
somebody's data to tell them no.

### The player

This was the hardest part, and four rules matter.

**One slice every ten seconds of real playing.** Not every ten seconds of clock time: a paused
video records nothing, and the slice is worked out from the position in the video, so you can
only ever be credited for a part that was actually on screen.

**No running ahead, on a first watch.** Going back is always fine. Going forward over something
you have already watched is fine. Only jumping past yourself is refused, and you get a line
saying why rather than being silently yanked back.

**1.5x at most, on a first watch.** This is not a preference, it is arithmetic. The server
refuses more than nine slices a minute, because more than that is a script rather than a
person. A player at 2x produces twelve. So at 2x a quarter of your watching is thrown away and
the lesson simply never opens, with nothing on screen to explain it. The cap is enforced even if
you use YouTube's own speed menu rather than ours.

**Nothing is lost when the signal goes.** Slices that do not get through are kept in a queue and
sent when you reconnect, and a note says so. The queue is saved in your browser, so even a flat
battery does not lose them. This matters more here than almost anywhere: two minutes in a lift
is normal, and without the queue those two minutes of watching simply never happened.

**A video that will not play says so.** Removed, private, blocked by the owner: each one gets a
real sentence and a request to tell your tutor, with the lesson name. Never a black rectangle.
A black rectangle tells somebody the site is broken, and they leave instead of telling anybody.

### The lesson check

All the questions on one card. Answer them, press the button, and every one comes back marked
green or red **with its explanation underneath**. Get one wrong and it says how many were right
and lets you go again immediately. No waiting, no limit, no scolding.

### The module quiz

Four steps: the rules, one question at a time, a review, the result.

**The rules come first** because a try is spent. Questions, pass mark, timer, tries: all on
screen before you press anything. Nobody should discover the rules of an assessment by failing
it.

**Your answers are saved as you go**, under that try's id in your browser. Close the tab, flat
battery, wrong tap: the same try carries on. The word "Saved" appears only when the save
actually worked, because claiming to have saved something you did not is worse than saying
nothing.

**The review step stops the avoidable failure.** Nothing is sent until you have seen what you
are sending, and a blank question is named and linked rather than just counted. On a ten
question quiz with three tries, sending it with question seven blank because of a mis-tap is a
try gone for nothing.

### The certificate

The moment the last thing is done, you land on a page of its own with one short burst of
confetti, your certificate card with the real number, and three buttons: view and download,
add to LinkedIn, share on WhatsApp.

It is a page rather than a banner because finishing a course is the thing the whole Academy is
for, and it is the one moment somebody will screenshot and send to somebody else.

The page **asks for the certificate itself** rather than trusting whatever sent you there. The
claim function is safe to call twice by design: it looks for an existing certificate first and
hands the same number back. So somebody who closes the tab at exactly the wrong moment still
ends up with theirs.

No confetti at all if your device is set to show less movement. Not slower, not smaller: none.

### My learning

The full bento from your concept. The one thing to do next is the biggest tile; everything else
is a glance.

**Every tile is absent rather than empty.** A brand new learner has no courses, no minutes and
no certificates, and three empty boxes telling them so is a worse welcome than one designed
card telling them where to start.

---

## 4. Three bugs only a browser could find

None of these show up in a test that does not open a real page.

**The player crashed the whole page.** YouTube's player does not fill the box you give it, it
**replaces** it. React, which builds the page, later tried to remove something that was no
longer there and the whole page fell over. Worse, it happened on any change that swapped the
player out, **including showing the message for a broken video**. So the careful "a video that
will not play says so" path was itself a crash. React now owns an outer box it never looks
inside, and the thing YouTube eats is created separately.

**The certificate would have said "This certifies that learner".** The greeting on My learning
falls back to the part of your email before the at sign, which is fine for "Good morning, ada"
and very much not fine on a certificate. It now reads the real name field, which is the same one
the certificate register uses, so the card and the certificate always match. If it is blank it
says "Add your name" in grey italics rather than printing a guess.

**A full stop drifted off on its own.** The line under the player read "You are at **52%** ."
with a gap before the dot. The paragraph is laid out as a row so the tick can sit beside the
words, and that layout puts a gap between **every** item in it, including a stray full stop.

---

## 5. One thing from Phase 3 that tried to happen again

In Phase 3 the course page arrived unstyled because its styles lived in another page's
stylesheet, and each Academy page is loaded on its own now.

It nearly happened again: the small outlined labels on the learning pages were defined in the
course card's stylesheet, which the learning pages never load. The build does not warn about
this, and it only looks wrong if you happen to arrive without visiting the other page first.

The label has moved into the design system, where anything used by more than one page belongs.

---

## 6. What I deliberately did not build

The CHANGELOG has the full list. The one worth repeating here:

**The concept's My learning tab says "Your bootcamp access is open, so every course is free to
you."** Your standing rule, in three briefs now, is to never say anything about bootcamp emails
or who gets free access. The pass card built in Phase 2 says "Your bootcamp enrolment is active,
so the courses it covers are open to you", which is true of what the server actually granted and
promises nothing about any other course. I kept that wording and did not adopt the concept's.

If you want the concept's line instead, say so and I will change it.

---

## 7. What the review found, and the one that mattered

### A learner could not finish a lesson above 1x

This one is worth understanding, because it is the kind of bug that passes every test.

The player has to tell the server which ten second pieces of the video you have actually seen.
It did that by counting **ten seconds on the clock** and then sending one piece.

At normal speed that is roughly right. At 1.5x it is not, and the reason is simple arithmetic:
ten seconds on the clock at 1.5x is **fifteen seconds of video**. So every ten clock seconds
the player sent one piece and silently skipped the other half of one. Over a whole lesson,
**every third piece never got sent**.

An eight minute lesson has 48 pieces and opens at 92 percent. At 1.5x it stopped at 65 percent.
At 1.25x it was every fifth piece, and it stopped at 79 percent. In both cases you could watch
the whole thing, twice, three times, and the lesson would never open. And piece number zero,
the very first ten seconds, was never sent at any speed, because the first send happened ten
seconds in, by which time the player had moved on.

**The worst part was 1x.** With a perfect clock it just scraped over the line at 97.9 percent.
With the ordinary wobble of a busy phone it came in at 91.67 against a 92 percent mark and
failed. So the same learner, on the same lesson, would finish it on a quiet phone and not on a
busy one. That is worse than always failing, because always failing gets noticed.

My own Phase 5 test used a 90 percent mark, which 97.9 clears. It would have passed at 1x and I
would have shipped this.

**The fix** is to stop counting the clock and start counting the video. Every tick, the player
works out every piece the playhead has just been through and sends all of them. If the playhead
has jumped further than playing could possibly have taken it, that is somebody dragging the
scrubber, and nothing is sent for the part they skipped.

Measured on the real page afterwards, playing a whole lesson end to end:

```
1     48 of 48 pieces, 100%, opens
1.25  48 of 48 pieces, 100%, opens
1.5   48 of 48 pieces, 100%, opens
2     48 of 48 pieces, 100%, opens  (pulled back to 1.5x, as it should be)
```

### A number that said yes while the button said no

The line under the player read "You are at 92%" while the button that opens at 92 percent sat
there refusing to work. 44 of 48 is 91.666..., and rounding that the normal way gives 92.

It rounds **down** now, everywhere it is printed. Rounding down can only ever understate, and
the moment the number reaches the mark the button really is open. A page should never argue
with somebody about what is on their own screen.

### And one I found underneath, which was worse

While fixing the above I checked what happens when the server refuses a piece for coming in too
fast. It turns out **it does not refuse. It answers normally**, as if it had stored it.

The queue, whose whole job is to keep your watching safe when the signal drops, treated that as
"stored" and deleted its copy.

While you are just watching, that almost never bites, because only one or two are ever in
flight. When you come out of a tunnel it is a catastrophe: thirty pieces queued up, the queue
fires them all off at once, the server keeps a dozen and ignores the rest, and the queue throws
away all thirty. **The feature whose entire promise is "nothing is lost" would have lost
almost everything in the exact situation it exists for.**

The queue now sends no faster than the server will accept, the page says "Catching up on 23
parts you watched while the connection was down", and the backlog comes in over the next couple
of minutes. Two minutes offline in the middle of a lesson, tested on the real page: all 48
pieces survived.

### Two smaller things

**The test script started with file 15**, but file 14 has never been run on the live database
either, and file 14 is the one that closes the two security leaks. The script now starts with
file 14 and its 20 checks, then file 15 and its 23.

**The quiz rules argued with themselves.** While a quiz is waiting out its 24 hours, the four
tiles saying "3 tries, then a day's wait" sat at full strength beside a card saying the tries
were gone. The tiles are dimmed now, the tries tile reads "3/3 tries used", and on a phone the
waiting card comes first, because what somebody needs at that moment is when they can come
back.

---

## 8. When you merge this

1. **Run `database/lms/14_public_catalogue.sql`**, then read all **20** rows of
   `14_verify.sql`. File 14 has not been run on the live database yet and it is the one that
   closes the two security leaks. File 15 will refuse to apply without it.
2. **Run `database/lms/15_learning_pages.sql`**, then read all **23** rows of `15_verify.sql`.
3. **Work through `docs/lms/PHASE-5-TEST.md`** on the preview with your unlisted video. It
   builds a throwaway test course, walks every screen click by click, and takes it all down
   again at the end.

Still outstanding from before, and unchanged by this phase: delete the three stale files in
`database/lms/not-yet-run/`.
