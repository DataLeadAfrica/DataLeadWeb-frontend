# What Phase 2 built, explained simply

Five pages, the way they look, and the plumbing behind them. This is the first part of the Academy
a person can actually look at.

It was built once, looked too plain, and has been rebuilt to your design concept. This explains the
Academy as it stands now.

---

## 1. The look

Think of the Academy as a **table top** sitting under the normal white website header. The table is
a pale grey with a very faint grid printed on it, like graph paper, and one soft orange glow
drifting slowly across it. On top of the table sit **white cards**, each with a thin orange edge in
its top left corner.

That is the whole idea. Everything in the Academy is a white card on a grey table.

The important part is that it is **the same light colours as the rest of dataleadafrica.com**.
There is no dark mode and no switch to flip. If somebody clicks from Courses to the Academy, the
only thing that should change is what is on the page, not what kind of website they are on.

### The one picture that matters

The **watch tape** is the Academy's own invention. Imagine a lesson video chopped into ten second
slices, and one small square drawn for each slice. As you watch, the squares fill with orange. A
black line is drawn across at 92%, and that is the point where the lesson's question unlocks.

It is not a decoration. It is a picture of the actual rule the database enforces. A learner can see
exactly how much is left, and can see that jumping forward does not fill the squares in.

**It is built and tested now, and nobody will see it until Phase 4**, when there are real lessons.
It is deliberately kept off the sign up and sign in pages: showing somebody's progress to a person
who does not yet have an account would make no sense.

---

## 2. The five pages

### /lms, the front door

A card saying the Academy is nearly ready, with a button to create an account.

**It used to name four courses**: STATA, SQL, Power BI and Python. None of those courses has been
built. If somebody turned up expecting a Power BI course, we would have told them something untrue.
So the page names no courses at all. When a course exists, we can name it.

It is marked **noindex**, which asks Google not to list it. That matters more than it sounds: a
placeholder Google has listed outlives the placeholder, so people arrive at a "coming soon" page
months after the real one exists.

### /lms/sign-up, creating an account

The left of the screen says what the Academy is: **Learn one tool at a time**, one short sentence,
and the three steps, Watch, Check, Certify. The right is the card with the form in it.

Above the form sit three short bars: **Details, Verify, Ready**. People give up on a form when they
cannot see the end of it, so the bars say there are three steps and which one you are on before you
have typed anything.

The labels **float**. The word "Email address" starts inside the box and slides up into the corner
when you start typing, instead of vanishing. If you get interrupted halfway through, you come back
to three filled boxes that still say what they are.

Under the password is a bar in **four segments** that fills as the password gets harder to guess.
It is only a hint. The one rule actually enforced is eight characters or more, and nothing you type
leaves the box.

Then six boxes for the code we email.

**Why a code and not a link.** A link opens on whichever device read the email, which is usually the
phone, and people are often sat at a laptop. A code can be carried across the room.

### The code screen

An envelope with two rings leaving it, like a signal going out. Six big boxes. And two little
**dials**, side by side:

- **Code lasts**, counting down from 10:00
- **New code in**, counting down from 60 seconds, which then turns into a Send another code button

The dials exist so nobody has to guess. Without them you press a button that refuses you, with no
idea why or how long to wait.

When the code is right, the six boxes **turn green one after another**, left to right, and a single
clear button appears: Go to My learning.

### /lms/sign-in, coming back

Email and password.

**The careful bit.** When sign in fails, the page says one sentence: the email and password do not
match. It says that whether the password was wrong **or** nobody has ever used that address here.
If it told them apart, anybody could type addresses into the form and find out who has an account.

### /lms/reset, forgotten password

Address, then code, then a new password. Three bars at the top again, saying so.

This page is the most careful of the lot, and section 4 explains why.

### /lms/me, My learning

**Good morning, Ada**, or afternoon or evening, by the clock on their own device.

Then two things. A **pass card**, which is their name, their email and what their account can reach,
drawn as a card they own rather than a line of grey text. Somebody on an active bootcamp gets the
orange version; everybody else gets a plain white one. The plain one is not a broken version with
bits missing: it says what the account is and nothing about what it is not.

Beside it, a **designed empty space** that says "Nothing started yet", with a few squares of a watch
tape as a hint of what is coming. An empty box with nothing in it reads as a fault.

The Continue, This week, Your courses and Certificates tiles from your concept are Phase 4, when
there are real courses to put in them.

---

## 3. The seven problems you found, and what each one is now

### 1. The welcome message never appeared

When somebody's access changes, the database says so **once**. Sign up, sign in and reset each
asked the database that question just before sending the person to My learning, so the one answer
got used up on the way. By the time My learning asked, there was nothing left to say, and the
message was never shown to the one person it was written for: somebody who had just arrived.

Now whoever asks the question **carries the answer with them**. My learning reads it instead of
asking again. It also wipes it afterwards, so pressing reload does not show it a second time.

### 2. The code boxes

Three separate faults, all with the same cause.

**Typing one digit wiped the whole code.** When you tap a box that already has a 2 in it and type a
7, a phone reports **"27"**, both characters together. The old code assumed anything longer than one
character was a pasted code, so it threw everything away and started again. Now three or more
characters at once counts as a paste. For two, it works out which one is new and keeps only that.

**After a wrong code the cursor stayed where it was**, so the next digit landed in the middle. It
now goes back to box 1.

**A digit typed into box 3 jumped to box 1** if boxes 1 and 2 were empty. The old code glued the
boxes into one piece of text, and `["","","7"]` glued together is just `"7"`, which looks exactly
like a digit in box 1. The boxes now keep six separate slots, so the gap survives.

### 3. The reset page had no way to ask for another code

It does now, with the same 60 second dial as everywhere else.

### 4. The leak

This is the subtle one, and it is worth understanding.

Supabase has a rule: you cannot ask for the same email twice inside 60 seconds. But it **only
applies that rule to addresses it knows about**. For an address with no account, there is no email
to send, so there is nothing to rate limit.

So if the page passed that refusal on to the person, the page would be answering a question nobody
asked. Type an address, press the button twice, and the message tells you whether that person has
an account. Everything else on these pages is careful about exactly that, and this one message
would have given it away.

**The pages no longer read the answer at all.** Every reply, success or refusal, produces the same
screen. There is now no way to use these forms to find out who has an account.

### 5. Enter did not work

The steps were ordinary blocks of page with a button stuck on. They are now **real forms**, which is
what makes the Enter key submit them, what makes a password manager offer to save the password, and
what makes a phone keyboard show "Go" instead of "Return".

### 6. Errors argued with you

If you typed a one letter name, the page said "please enter your full name" and then left that
message on screen while you fixed it. Each message now **names the box it belongs to** and
disappears the moment you start editing that box.

### 7. The placeholder

Covered above: no course names, and nothing about who gets what.

---

## 4. The wording that was removed

The sign up page used to say: *"If you are on one of our bootcamps, use the same address you
enrolled with and your courses will be waiting."* `/lms` used to say: *"On a bootcamp with us? Use
the learning portal instead."*

Both are gone, and nothing has replaced them.

Before somebody signs in, the page **has no idea who is reading it**. So a sentence like that is a
promise made to a stranger, and the stranger might be somebody with no bootcamp at all. What an
account can reach is decided by the server, after sign in, and the pass card says it then, from the
server's own answer.

Bootcamp learners are not stranded: the learning portal is still linked from the Certifications
page.

---

## 5. Five more things I found while testing

None of these were in your list. I found them by driving the real pages in a real browser and by
drawing the components with real numbers, rather than by reading my own code and deciding it looked
right.

**The six boxes submitted a code the page could not see.** The boxes finish and tell the page in the
same instant, so the page's own copy was still one digit behind. A full set of six digits was
refused with "please enter all 6 digits". I could see it in the screenshot: six digits on screen and
a message saying they were not all there.

**My own styling beat my own buttons.** A rule I wrote to tidy up buttons was, by the rules of CSS,
stronger than the rule that makes the orange button's text white. The orange button had dark text
and the small links looked like ordinary writing.

**The watch tape drew nothing for a long lesson.** An hour of video is 360 squares. Drawn one each
they do not fit across a phone, and instead of squashing they push each other off the end, so the
tape came out blank. It now groups them above 120, and a group only lights up when every slice
inside it has been watched. A lesson with no length set says "Length not set" instead of drawing one
square the width of the card.

**Switching off animations missed one.** The setting people use when movement makes them unwell
switched off everything except the one thing that never stops: the glow on the table top. One word
wrong in one line.

**Two small pieces of orange text were too pale to read.** Orange text that is fine on white is not
fine on a faint orange background. There are now two oranges, and which one to use depends on what
is behind it.

I also made every call to the database **survive the network dropping**. Before, if the connection
died mid-request, the button would have spun for ever. Now it says so.

---

## 6. How I checked it, which is the part that matters

Not by looking at it and deciding it was fine.

I ran three scripts that **drove the real pages in a real browser**, answering the database's
requests with made up replies. Sixty three checks:

- **12** on the code boxes alone: typing, the "27" case both ways round, pasting, a phone filling in
  the wrong box, backspace, and where the cursor goes after a wrong code
- **41** on everything else: the rate limit behaving exactly like a success on both pages, Enter
  submitting, errors clearing on the right box and not the wrong one, the welcome message appearing
  once and not coming back on reload, and no page before sign in naming a course, mentioning free
  access, or drawing a watch tape
- **10** on the design rules: only the two cheap kinds of movement being animated, a hidden browser
  tab stopping all of it, the reduced motion setting stopping all of it, and the **contrast of 71
  separate pieces of text** across four pages, measured against what is actually behind them

All of those pass, and twenty four more were added after your second review, which section 7
describes. **Eighty seven in total.** Every screen was also photographed at laptop width and at
phone width.

**One thing does not pass, and I am telling you rather than quietly fixing it.** White text on the
orange button is below the accessibility standard, at 2.95 against a required 4.5. That is the
website's own orange button, used the same way in the contact form, the GIZ strip, the footer and
the blog. Making the Academy pass would mean a noticeably browner button here than on every other
page. That is a decision about the whole website, not about the Academy, so I have left it matching
and written down where to change it if you want to: `docs/lms/DESIGN.md`, section 10.

---

## 7. The second review, and the bug in it that was mine

You sent Phase 2 back with four things. One of them was a real bug, and it is worth explaining
because it is a good lesson in not trusting your own reasoning.

### The bug: I was catching an error that never arrived

The Academy talks to Supabase using a library called supabase-js. I assumed that when the network
fails, that library would **throw** the error, the way most code does: it stops what it is doing
and shouts. So I wrapped every call in the thing that catches a shout, and inside the catch I put
the honest "we could not reach the Academy" message.

The library does not shout. It catches its own error and **hands it back quietly as part of the
answer**, looking exactly like a polite refusal from the server. So my catch never fired, not
once. Every single failure fell through to the branch I had written for the one failure that must
be hidden, the one explained in section 3 fix 4.

What that meant in practice. Three real failures were silently treated as success:

1. **No connection.** You press Create my account on a train going into a tunnel. The page takes
   you to the code screen and you sit there waiting for an email that was never requested.
2. **Our hourly email allowance is full.** We have it set to 20 an hour. On a busy day, the
   twenty-first person to sign up gets the code screen and no email, with nothing to tell them.
3. **The mailer is broken.** Same again.

In all three the person is left looking at six empty boxes with no idea that anything is wrong.

### What it does now

It reads the error and decides by **what kind** it is:

| What went wrong | What the page says |
| --- | --- |
| No connection | We could not reach the Academy. Check your connection and try again |
| The 60 second wait for one address | Nothing. It carries on, because this is the one that would give away who has an account |
| Our hourly email allowance is full | We are sending a lot of emails right now. Please try again in an hour |
| The mailer or the server is broken | We could not send your code just now. Please try again in a few minutes |

Only the second row stays hidden, and only because that message is the one Supabase sends for
addresses it already knows about. Every other row is a case where no email went out, so pretending
otherwise would just leave someone waiting.

### Two more places with the same fault, which were not on your list

Once I understood what was happening, I looked for it everywhere else.

**Signing in with no connection said "that email address and password do not match."** That is
worse than unhelpful: it sends somebody off to reset a password that was perfectly fine.

**Typing a code with no connection said "that code was not right."** So they throw away a good
code and ask for another one.

Both now say the connection failed.

### One thing I am telling you rather than quietly accepting

The "the mailer is broken" message can only appear when an email was genuinely being sent, which on
the sign up page means the address was new. So in theory somebody watching very carefully could
learn something from seeing it. I have reported it anyway, because it needs the mailer to be broken
at that exact second, and the alternative is telling a real person a code is on its way when we
know it is not. You should know the trade exists.

### The other three

**The WhatsApp button sat on top of the main button on phones.** It is now hidden on sign up, sign
in, reset and My learning, and still there on `/lms` and the public pages. I used the scoped CSS
rule you suggested rather than editing the Footer, because the Footer is rendered by every page on
the site, so changing it from the Academy would let some other page start hiding the button by
accident. This way it is one rule, in the Academy's own stylesheet, next to the thing it is about.

**The envelope touched the step rail.** The envelope throws out two rings that grow larger than the
envelope itself, and I had measured the gap from the box rather than from where the rings reach. It
now has 27px of clear space, measured in the browser rather than guessed.

**The commit number.** You were right that I was building on an old one, and wrong only that it did
not exist: `e4367d8` is real, just two commits behind `d02c86b`. I checked what those two commits
changed, and it was only database files and a status document, nothing under `src/` or `public/`.
So the package was never affected, but I have rebuilt and re-tested everything on `d02c86b` and
corrected the changelog.

### Two files to delete when you merge

Laying this package over main leaves behind three old copies of database file 10, sitting in a
folder called `not-yet-run` even though file 10 was run on 6 October:

```
database/lms/not-yet-run/10_roles_and_access.sql
database/lms/not-yet-run/10_undo.sql
database/lms/not-yet-run/10_verify.sql
```

Delete those three. The up to date copies are in the package at `database/lms/`.

The duplicate `DataLeadWeb-frontend/` folder you spotted is now written down in `STATUS.md` as a
small separate pull request for after launch. I checked it first: three files, about 100 KB,
nothing imports them and the build ignores them, so they are harmless today. They are only a trap
for whoever next edits the real `Index/page.tsx` and edits the wrong one.

### The testing, now at 87 checks

The twenty four new ones cover the five failure cases on each of the three pages that send an
email, the two places a dropped connection used to be blamed on the person, the WhatsApp button
being gone from the four pages and still there on `/lms`, nothing covering the main button on a
phone, and the gap above the envelope.

One detail I am a little pleased with: the first version of the resend test cheated by switching
the disabled button on and clicking it, and it quietly did nothing at all. Rather than find another
way to force it, the test now winds the browser's clock forward 65 seconds, so the button becomes
pressable the same way it does for a person.

---

## 8. What the next phases inherit

Everything above is written down in `docs/lms/DESIGN.md`: the colours, the fonts, each component
and what it is for, the rules about movement, and the grid My learning's tiles slot into. Phase 3
onwards builds from that file instead of from memory, which is how a page added in Phase 5 ends up
looking like a page added in Phase 2.

One thing Phase 4 cannot build yet. The **This week** tile in your concept shows a small bar chart
of how many minutes were watched on each day of the week. Nothing in the database can answer that
today. It needs a new read only function, written so a learner can see their own week and nobody
else's, with tests proving it. That is now written down in `docs/lms/STATUS.md` so it does not get
forgotten, and the tile is not built until it exists. It will not be faked with made up numbers.
