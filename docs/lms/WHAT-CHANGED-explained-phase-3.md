# What Phase 3 built, explained simply

Three public pages, the database behind them, and the work that makes a search engine able to read
any of it. Plus two security holes closed, which were the most important thing in the whole phase.

---

## 1. The two leaks, which were real

You found these and asked me to fix them properly. Before writing anything I loaded the database
files into a copy of PostgreSQL on my own machine and read them as `anon`, which is the role every
visitor to the website uses, signed in or not. Both were exactly as you said.

### Leak one: anybody could get every video

The database had this line in it:

```
grant select on ... lms_lessons ... to anon, authenticated;
```

That gives away the **whole table**, every column. One of those columns is `video_ref`, the YouTube
id of the video.

An older comment said the id was harmless because the player checks whether you are allowed to
watch. That is true of the player and completely untrue of YouTube. An unlisted video is not a
private one: paste the id after `youtube.com/watch?v=` and it plays, for anybody, for ever.

So a stranger with the website's public key could ask once and get the id of every paid video in
the Academy. I measured it: **three video ids and three lesson bodies came straight back**, both
to a stranger and to somebody signed in who had paid for nothing.

**The fix** is to stop handing over the whole table and hand over only the columns a shop window
needs: titles, lengths, positions. Those stay public, so the course page can still show you what is
inside. The video and the lesson notes become unreadable, by anybody, through the table.

Doing it by column rather than by table also fails in the safe direction: a column somebody adds
next year is **not** given away until a person decides to give it away. The old way handed it over
the instant it existed.

### Leak two: anybody could see unfinished courses

`lms_course_cards` is a view, which is a saved question the database answers for you. In
PostgreSQL a view runs with the rights of **whoever made it** unless you say otherwise, and
whoever made it is an administrator. So the rule that hides unfinished courses was simply never
consulted.

I measured it: **two draft courses came back to a stranger**, with their titles and their prices.

The fix is one setting: `security_invoker = true`, which makes the view run with the rights of
whoever is reading it. The rule applies again.

### How I made sure the fix really was a fix

I wrote the tests **before** the fix and ran them first, so I could watch them fail for the right
reason. **Seven passed and twenty two failed.** Then I wrote file 14 and ran them again: **all
twenty nine passed.**

A test that has never failed has never proved anything.

One of the seven that passed beforehand passed for a boring reason, and it is worth saying so
rather than counting it: "no public function returns a video reference" is trivially true when
the public functions do not exist yet. The two that matter, the two leaks, were both in the
failing twenty two.

---

## 2. What else went into the database

| | What it is for |
| --- | --- |
| `lms_open_lesson` | The only remaining way to reach a video. It asks "is this lesson open to you" first and gives you nothing if the answer is no. Phase 4's player uses it |
| `lms_staff_lesson` | The same for staff, who need to see a draft lesson whole |
| Six new columns | What a learner will be able to do, who the course is for, what to have ready, the questions and answers, and the title and description for search |
| A new publish rule | A course cannot go live with fewer than three things a learner will be able to do, because a course page with nothing on it is worse for us than no page at all |
| Two new reading functions | One for the whole catalogue, one for a single course. **The pages and the search engine copy both use these**, so what a stranger reads and what Google reads are built from the same thing and cannot disagree |

I also gave you `14_test_course.sql`: one real course, as a draft, with real words in it, for
testing the pages before the real courses exist. It prints the publish checklist so you can see it
is ready, and the file ends with the one line to put it live and the one line to take it down.

### The older tests

All 177 of them still pass, so 206 in total. Every one of those numbers was counted from a run
on 8 October 2026, on a database with files 01 to 14 applied, not carried over from an older
note: the suites are 43, 36, 28, 52, 18 and 29.

Four older test fixtures had to be brought up to date, because they were written before the new
rule and so had no outcomes. The rule is right; the fixtures were simply older than it.

I also found one older test that was **quietly broken**. In the file 12 suite, P13 checks that a
mailer which has never called in raises an alarm, and P14, four lines later, makes it call in. So
the second time anybody ran that suite on the same database, P13 saw the first run's heartbeat and
passed for the wrong reason. The seed now clears it.

---

## 3. The three pages

**`/lms`** is the front door. The headline and the line under it come from `lms_settings`, so the
Phase 6 control room can change them without a deployment, and there is an announcement line that
can be switched on. Then the tool rack: one key per tool that actually has
a published course, and the course appears underneath when you press one. It cycles slowly on its
own and stops the moment you touch it, when you switch tabs, or if your device is set to show less
movement.

The rack is never a fixed list. It is built from what is really published, so a key for a tool with
nothing behind it cannot appear, and a tool added next month appears on its own.

**One wording change from your concept.** It says "Popular courses". We do not measure how popular
a course is, so the page would have been making up a number in the one place a stranger trusts
least. It says **Latest courses**.

Below the courses, **Learning paths**: several courses in the order that makes sense, built from
the published paths. The section is absent entirely when there are none.

**`/lms/courses`** is every course, with a search box, area filters and a sort.

The address never changes when you filter. That is deliberate: every combination of filters would
otherwise be an address Google could find, and it would find twenty nearly identical thin pages
instead of one strong one. The cost is that you cannot share a filtered view as a link, which for a
dozen courses is a fair trade.

**`/lms/courses/:slug`** is one course: the four facts, a bar showing the whole course with each
module as wide as it is long, what you will be able to do, who it is for, the full curriculum with
every lesson and its length, the certificate, the questions, and related courses.

The price card stays beside the text on a laptop and becomes a bar stuck to the bottom of the
screen on a phone, so the price and the button are always in reach.

It has five states and two of them are reachable today. Which one you see depends on whether you
are signed in and whether the database says you already have the course: section 7, item 3, has
the table. It says nothing about bootcamp emails or who gets anything free.

---

## 4. The search engine work, and why it was needed

Here is the thing that was quietly costing the whole website.

The site is built so that the server sends an almost empty page and your browser fills it in. You
never notice. **A search engine that does not run JavaScript sees the empty page**, and so do most
AI assistants when they read a page.

Worse, the empty page had these two lines written into it by hand:

```html
<link rel="canonical" href="https://dataleadafrica.com/" />
<meta property="og:url" content="https://dataleadafrica.com/" />
```

That empty page is sent for **every address on the site**. So the first thing Google was told about
`/courses`, about every blog post and about every research page was: *this is a copy of the
homepage.*

**This was the biggest SEO problem the site had, and it had nothing to do with the Academy.** Both
lines are gone, and there is a comment where they were explaining why, because the obvious thing to
do when you notice something is missing is to put it back.

### How the Academy pages are now read

There is a small program (`api/academy-meta.js`) that answers the three public addresses before
your browser gets anything. It fetches the page, writes in the real title, the real description,
the right canonical, the sharing tags and **a plain copy of the page's actual content**, then sends
that. React replaces the plain copy the instant it starts, so nobody sees it. A crawler sees real
words.

You can check this yourself with no tools at all. Right click a page and choose **View Page
Source** (not Inspect). That shows what the server sent. The course title should be right there.

The rules it keeps:

- A draft course or a wrong address answers a **real 404**, not a page that says "not found" while
  telling the search engine everything is fine. The second kind keeps the address in Google's index
  for months.
- A query string never reaches the canonical, so `/lms/courses` and `/lms/courses?tool=stata` are
  one page, not two.
- If the database is slow or down, the ordinary page is sent. **Never an error page.** A crawler
  that gets an error comes back less often.

### Also built

- **`/sitemap.xml`**, built from the database, so a course appears in it the moment it is published
  rather than when somebody remembers to edit a file.
- **`robots.txt`**. Three folders closed. Two things deliberately left open, with the reasons
  written in the file so nobody "tidies" them later: `/api/` must stay open or the WhatsApp share
  pictures break, and the sign in pages must stay open or Google can never read the tag telling it
  not to list them.
- **A share picture for each course**, so a link in a WhatsApp group shows a card with the course
  title and three facts instead of a grey box.
- **A band on `/courses`** linking to the Academy. That page has the most visitors on the site, so a
  link from it is worth more than anything the Academy can do for itself. It hides itself until
  there is at least one course, because a link to an empty page is worse than no link.

---

## 5. The address question, now settled

A site that answers on both `dataleadafrica.com` and `www.dataleadafrica.com` has to tell search
engines which one is real, and say the same thing everywhere. You told me it is the bare
**`dataleadafrica.com`**, and that is what the site now says.

It is written in **exactly one place**, `api/_seo-rules.js`:

```js
export const SITE_ORIGIN = "https://dataleadafrica.com";
```

Everything imports it: the three pages, the program that writes the tags, the sitemap and the
share pictures. There is a test that fails if any of those files grows its own copy.

The one thing that is not shared is `public/robots.txt`, because a plain text file cannot import
anything. Its `Sitemap:` line is checked by the same test instead.

**What changed here since the review.** The program that writes the tags used to build the
address out of the host it was answering on. On the vercel.app address that produced a canonical
saying `https://dataleadweb-frontend.vercel.app/...`, which invites Google to index a second
complete copy of the site. A canonical's whole job is to name the one real address, so it cannot
be built from whichever address a visitor happened to type.

The single exception, which is correct: when the program fetches its own `index.html`, it uses
the address it is running on. A preview deployment has to read its own files, not production's.

## 6. Four things I got wrong and caught before you saw them

None were in your brief. Each was found by a test or by looking at a screenshot, not by reading my
own code and deciding it looked right.

**The canonical carried the query string.** The one place it must never be. The test caught it the
first time it ran.

**The course page borrowed the landing page's styles.** It worked by accident, because everything
used to be loaded together. Phase 3 loads each page on its own, so somebody arriving at a course
page from a Google result would have got every heading label and every grid unstyled. It only
looked right if you happened to visit the landing page first. The shared styles now live in the
design system where they belong.

**An unclosed comment in a stylesheet ate the rules after it.** I introduced this while fixing the
one above. The build does not warn about it: it silently throws away everything up to the next
`*/`. I now check every Academy stylesheet for it.

**The WhatsApp button sat on top of the sticky price bar on phones** even though your brief
explicitly asked for that not to happen. The check caught it. It is lifted clear rather than
hidden, because a course page is public and the button belongs there.

---

## 7. What the review found, and what I did about it

Your six items, and two more I found while fixing them.

### 1. Every course page told Google it did not exist when Supabase was asleep

This was the serious one and you were exactly right about it. The function that fetches a course
returned **nothing** for two completely different situations: "there is no such course" and "I
could not reach the database". The page treated nothing as "no such course" and answered a real
404 with a "do not list this" tag on it.

Our Supabase project is on the free plan, which **pauses after a week without visitors**. One
quiet week, Google visits, and every course in the Academy is told to drop out of the index.
Getting back in takes far longer than falling out.

The fix is to tell the two apart and never guess:

| What happened | What the page answers now |
| --- | --- |
| Supabase replied, no such published course | 404, do not list this. A real not found |
| Supabase was slow, down or paused | **200, the ordinary page, no do-not-list tag**, and a thirty second cache so one bad minute is not served all day |

There are now four tests for it, one for each way of failing: slow, down, a paused project
answering 503, and a genuine missing course. I wrote them to fail against the old code first.

The same mistake was one layer up as well, and you had not asked about it: the catalogue page
showed "The first courses are on their way" when the truth was that it could not reach the
database. Somebody reading that leaves believing the Academy is empty. It now says it could not
load them and offers a try again button.

### 2. One address, everywhere

The address now lives in a single line in `api/_seo-rules.js` and every other file imports it.
Section 5 above has the detail. There is a test that fails if any file grows its own copy, and
another that checks no tag is ever built from the host the request arrived on.

While doing it I found something the review had not: the helper that builds an address strips
the query string, which is correct for a canonical and was **silently removing `?course=` from
every share picture**, so every course was sharing the generic picture rather than its own.
There are two helpers now, with different names, so the next person has to choose which they
mean.

### 3. The buy card told signed in people to create an account

It did, on every paid course, including to somebody who had already paid for it. It only ever
asked the price, never who was reading.

It now asks the database, through `lms_has_course_access`, and there are three answers:

| Who is reading | What they see |
| --- | --- |
| Already has it | **Continue learning** |
| Signed in, does not have it, payment not open | The price, **Online payment opens soon**, and **Try module 1 free** if the course offers it. No "create an account", because they have one |
| Signed out | As before: **Create an account** |

Two details worth knowing. A free course is open to anybody signed in, and that rule lives in the
database too, not on the page. And while the answer is still on its way, a signed in person sees
the middle row rather than the signed out one, so the button never changes under them from wrong
to right.

It still says nothing about bootcamp emails or who gets anything free. There is a browser check
that reads the whole page and fails if it ever does.

### 4. Two copies of the structured data

The program that writes the tags now marks its own with `data-edge="1"`, and the page removes
anything carrying that mark before adding its own. Every page ends with exactly one of each.

**You asked for a browser check and that is what caught the rest of this.** A test in Node only
ever sees what the program wrote; the duplicate only exists after the page's JavaScript has run,
so nothing but a real browser can see it. The check loads all three pages in Chromium, counts
the blocks before and after, and found that the catalogue had a visible breadcrumb trail but no
breadcrumb in its markup. Both pages now have both.

### 5. The two things the brief asked for and I had left out

**a. The headline and the subhead** now come from `lms_settings`, on the page and in the program
that writes the tags, falling back to the words that were there. So does the announcement line,
when it is switched on.

The **title** and the **description** deliberately do **not** come from the database. Those are
the two lines a search engine weighs most heavily, and a mistyped headline in the Phase 6 control
room should not be able to move the Academy down the results. They stay in the file, where a
review can see them.

**b. Learning paths** are on the landing page, built from the published paths and their courses,
in order. A path drops any course that has since been unpublished, so it cannot link to a page
that is not there, and a path left with no courses disappears. The whole section is absent when
there are no paths, rather than being an empty heading.

You asked me to list anything I leave out in the CHANGELOG and say why. That is now a standing
section in it, and it is empty for this round.

### 6. The polish

| | What it was | What it is |
| --- | --- | --- |
| a | "Online payment opens soon" floated above the phone bar, over the page | Inside the bar, under the price |
| b | The breadcrumb looked different on the two pages | One component with its own stylesheet, used by both |
| c | "KoboToolbox" spilled out of its key | Long names get smaller type and may wrap, and every key is the same height |
| d | The Academy band sat after the closing call to action | Straight after the programmes, before "Why Data-Lead Africa" |
| e | The plain copy said "1 lessons" | One function counts, and it is tested |
| f | The database tests README was out of date | Rewritten, with every number counted from a run |

**Why the breadcrumb looked different** is worth knowing, because it is the same mistake as the
one in section 6 above. The styles for it lived in the catalogue page's stylesheet. Each Academy
page now loads on its own, so the course page never loaded that file and its trail arrived as
plain blue underlined links. It looked right only if you visited the catalogue first, which is
exactly what somebody arriving from a Google result does not do.

**The tests README** turned up a real problem while I was updating it. It told you to apply files
in an order that **cannot work**: file 13 refuses to apply unless `certificates.certificate_number`
has a UNIQUE rule on it, the real database has one, and the local stand in did not. Anybody
following the README hit a wall. The certification harness now adds the rule, and the README says
why it has to.

I also found the README's numbers were wrong. It said 132 tests in four suites, and the file 12
suite had 25. It is **206 tests in six suites**, and that suite has 52. Every number in it now
comes from a run I did on 8 October, which is also how I found that the "fail first" figure for
file 14 had drifted: it is 7 passed and 22 failed, not 6 and 23.

---

## 8. When you merge this

Two small jobs:

1. **Delete three files.** `database/lms/not-yet-run/10_roles_and_access.sql`, `10_undo.sql` and
   `10_verify.sql`. File 10 was run on 6 October and the current copies are at the top of
   `database/lms/`, so these are old copies sitting in a folder whose name says they have not been
   run.
2. Nothing else. The address question is settled.

And in the database, in this order: run `14_public_catalogue.sql`, then read every row of
`14_verify.sql` (all twenty should say yes), then `14_test_course.sql` if you want a course to look
at.
