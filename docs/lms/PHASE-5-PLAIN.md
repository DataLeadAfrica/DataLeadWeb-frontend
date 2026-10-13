# Phase 5, explained simply

Imagine a shelf of books where every book has a plain white cover with just the title typed on it.
You can read the shelf, but you cannot scan it. Your eye has nothing to land on, so you end up
reading every spine one at a time.

That was the Academy's course list. This phase gives every course a cover.

## The covers are not pictures we drew

Nobody sat down and painted six covers. If somebody had, then the day a seventh course is
published there would be no cover for it, and somebody would have to notice and make one.

Instead the website **draws the cover itself**, from things it already knows about the course: what
area it is in and what it is called. A course about analysing data gets a scatter plot with a line
through it. A course about collecting data gets a form being filled in. A course about programming
gets lines of code. Add a new course tonight and it has its picture by morning, with nobody doing
anything.

There is one clever bit. The computer needs to scatter the dots about, and normally when a computer
picks random numbers it picks different ones every time. That would mean the cover changed slightly
every time you opened the page, which would look broken. So the course's own web address is used as
the starting point for the "random" numbers. Same address, same numbers, same picture, forever, on
every phone and every computer. Like a dice that always rolls the same way for the same person.

## The words are not in the picture

This sounds like a detail and it is actually the most important decision in the whole thing.

The picture is only shapes: dots, bars, lines. The words on top of it, like "Power BI", are real
text sitting over the picture, not part of it. That means you can select them, a screen reader can
read them aloud to somebody who cannot see, and they are in the same typeface as the rest of the
page.

It also means something safer. Course titles are typed in by staff. If those titles went inside the
picture, somebody could type something sneaky into a title and it could end up being treated as
instructions by the web browser instead of as a title. Because the title never goes anywhere near
the picture, that cannot happen. There is a test that tries exactly that trick and checks it fails.

## The front page now asks a question

It used to say "Latest courses" and show three. Now it asks **"What do you want to do?"** with
buttons like "Analyse data" and "Build dashboards", because that is what somebody actually arrives
thinking. They do not think "I would like the Visualisation area please".

Those buttons are not a list somebody typed out. They are counted up from the courses that actually
exist. Add a course in a brand new area and a new button appears, with the right number on it. An
area with no courses gets no button, because a button that leads to an empty shelf is worse than no
button.

## Two things went wrong, and the useful part is how they were found

**The share picture could not draw the logo.** When you paste a course link into WhatsApp, WhatsApp
shows a picture. That picture is drawn by a different piece of the website, on a server. I put the
Data-Lead logo into it using the same logo file the website uses. The server could not read that
kind of file. It gave up halfway and quietly showed a plain grey card instead for every single
course.

Here is the part worth noticing: **everything passed**. The code compiled. All the other tests were
green. Nothing anywhere said there was a problem. The only way to find it was to actually make one
of the pictures and look at it, which is now a test that runs every time.

**The front page secretly got heavier.** One small helper word-function was borrowed from the wrong
file, and borrowing it dragged in four kilobytes of code meant for the lessons area, onto a page
visited by people who have not even signed in. Nothing looked wrong. It only showed up when the
page was weighed before and after, file by file.

## The map

There is a faint dotted map of Africa behind the box of tool names. It is decoration, nothing more.
It has no city names, no numbers, and it does not claim anything about where learners are, because
a decoration that makes a claim is a claim that can turn out to be wrong.

The first version placed it "a third of the way across the page". That looked right on the screen
size it was chosen on, and on other sizes it slid underneath the headline and made it hard to read.
The fix was to stop giving it a position at all, and instead put it **inside the same column as the
box of tool names**. Now it cannot reach the headline, because it is not in the headline's half of
the page. That is the difference between a measurement that happens to work and an arrangement that
cannot go wrong.

---

# Round 2, in plain words

## What went wrong on 9 October

Think of the website as one big folder that everybody shares, called **main**. When you want to
change something you take a copy of main, change the copy, and then ask for your copy to be folded
back in. Somebody looks at what is different between your copy and main, says yes, and in it goes.

On 9 October somebody wanted to add a registration page for an Excel class. But instead of taking
their copy from **main**, they took it from **the Academy's copy**, which was a different folder
with eight weeks of unfinished work in it.

So when their change was folded back into main, the whole Academy went with it. Every page. And
nobody saw it, because the thing you look at before saying yes is "what is different between this
copy and the one it came from", and this copy came from the Academy, so the Academy was not
different. It was invisible in exactly the place you look.

The Academy has been on the real website since that afternoon.

## What that cost

Three things, and the first one is the one that matters.

**There was a test course on the live site that anybody could sign up for.** It was built to test
the lesson player: a throwaway with somebody's unlisted video in it. But the real website was
offering it, and finishing it would have handed out a real certificate with a real verification
number on it, the same kind the bootcamp graduates get. Big Sam hid the course, which stopped that.

**A file that tells the website where things live got overwritten with an old copy.** Four lines
went missing. One of them is the line that makes `/sitemap.xml` work. A sitemap is the list a
website hands to Google saying "here is every page I have". The website was still telling Google
"my list is at /sitemap.xml", and that address was now handing back the home page instead of a
list. The other three lines are what gives each Academy page its own title in search results, so
all three were showing the home page's title instead of their own.

And here is the part worth remembering: **nothing broke.** No error, no red light, nothing failed.
A missing line of that kind does not break a page, it just quietly makes it a different page. That
is the sort of mistake that can sit there for months.

**Two files ended up in the wrong place**, in the top level of the folder rather than in the
documents folder where the rest of the Academy's notes live.

## What this round does about it

### A switch

There is now one line in one file that says whether the Academy is open to the public. It is set to
**no**.

While it says no, the Academy still works perfectly. You can go to it, sign up, watch a lesson, do
everything. What changes is that nothing **sends** anybody to it:

- The box on the bootcamps page advertising the Academy does not appear.
- Every Academy page quietly tells search engines "do not list me".
- The Academy's pages are taken off the list the website hands to Google.
- A small grey line appears at the top of every Academy page saying "Preview. The Academy is not
  open to the public yet."

On launch day somebody changes that one word from `false` to `true` and all four of those things
reverse at once. Not four separate changes that could be half done. One.

The reason it is one line in one file and not several is that a switch you can half flip is worse
than no switch at all. If the list handed to Google said "here are the Academy pages" while the
pages themselves still said "do not list me", that is a worse state than either of the two ends.

And the tests really do check both ends. The test makes its own copy of the code, flips the switch
in the copy, and runs everything again. So the launch day change is already proven to work before
anybody writes it.

### A test that would have caught it

The file that got overwritten now has a test watching it. It lists the six lines that something
real depends on, and if any of them goes missing the test fails and says which page stops working.

This is the useful kind of test, because the mistake it catches is a silent one. Nobody would have
noticed. The test notices.

### Three fixes to the pictures

**The map.** The Academy's front page has a dotted map of Africa behind the box of tools, with
Nigeria picked out in orange and a ring of glow on Abuja. That orange country is the whole reason
that picture was chosen, and on a laptop it was sitting behind the box, so all you saw was a faint
orange blur through the frosted glass.

The box of tools is now a bit narrower and pushed to the right, which leaves a clear strip down the
left of it, and the map is sized so Nigeria lands in that strip. You can see the country now, and
the glow is centred on it instead of floating in the middle of nowhere.

The sizing is arithmetic, not an eye. Nigeria sits between 29.9 and 46.8 percent of the way across
that picture, so 46.8 percent of however wide the map is drawn has to fit in the strip. That sum is
written in the stylesheet, and the check reads the same two numbers back out of the picture file,
so if the map is ever redrawn with the country somewhere else, the check fails rather than the page
quietly going back to a blur.

**The question mark.** One of the four little white tiles floating around the box of tools had a
"?" on it. A question mark in a white square on a web page means "help", and people tap it. That
tile is decoration. It does nothing. So it is a small bar chart now, which is what the original
design had.

**The arrows.** The row of cards further down the page had little arrow buttons for scrolling it
along. They were supposed to disappear on a phone, where you just swipe. They did not always, and
the right hand arrow was sitting on top of the second card, covering the thing it was supposed to
help you get to. They are now hidden on anything you touch rather than point at, and on any narrow
window at all.

### Tidying

The two files that ended up in the wrong place have been moved into the documents folder. A folder
called `not-yet-run` has been deleted: it held a second copy of a database file that was actually
run a week ago, and a stale copy of a database file is one wrong click away from being the one
somebody runs. And the written test for the Academy's lessons now starts by switching the test
course back on, since it already exists, rather than building a new one.

## The rule

Every change from now on starts from **main**, goes on its own branch, and comes in by request.
Never from another branch. The Academy's old branch is finished and can be deleted, and it should
be, because leaving it there is leaving the thing that caused all this for somebody to copy from
again.
