# CHANGELOG

One cumulative package. Every phase adds to it, and this file says what each phase changed.

Everything sits at its real path in the repository, so the package can be laid on top of `main` as
it is.

---

## PHASE 4 REVIEW ROUND, 9 October 2026

Your three items, plus one thing I found underneath the first.

### What was left out of this round, and why

Nothing. The standing section stays, and it is empty this time.

### 1. SERIOUS. A lesson could not be finished above 1x

You were right in every detail, including the arithmetic. Reproduced with Playwright's fake
clock, so with no timer jitter at all, on the same 8 minute, 48 slice, 92 percent lesson:

```
1     47 of 48,  97.92%  OPEN     missing 0
1.25  38 of 48,  79.17%  LOCKED   missing 0, 4, 9, 14, 19, 24, 29, 34, 39, 44
1.5   31 of 48,  64.58%  LOCKED   missing 0, 2, 5, 8, 11, 14, 17, 20, 23, 26, ...
2     26 of 48,  54.17%  LOCKED   capped to 1.5x, same every-third pattern
```

Every fifth at 1.25x, every third at 1.5x, and slice 0 missing at every speed. `onTick` counted
ten seconds of **wall** time and sent one slice numbered from the playhead, so at 1.5x, where
ten wall seconds is fifteen video seconds, a third were never sent. Slice 0 was never sent
because the first send happened ten seconds in, by which time the playhead was in slice 1.

The only place my run differs from yours is 1x, and that difference is the real problem: with a
perfect clock it reaches 97.9 and opens, with real jitter it reaches 91.67 and does not. **At 1x
it passed or failed depending on how busy the phone was**, which is worse than failing outright
because it would have looked fine in testing.

| Changed | What |
| --- | --- |
| `src/pages/Academy/Learn/Player/slices.js` (new) | The arithmetic, on its own, in plain JavaScript so the package's own test can run it with no browser and no new dependency. `slices.d.ts` is the typed doorway, the same pattern `api/_seo-rules.js` already uses |
| `Player/page.tsx` | The tick sends **every slice the playhead crossed** since the last tick. A move further than playing could manage is a seek and credits nothing for the gap. Slice 0 goes when play starts; the final slice goes on the ENDED event, because the last slice is usually a part of one and the playhead can stop inside it without any tick seeing the boundary |
| `Player/page.tsx`, `ui/WatchTape.tsx`, `Learn/MyCourse/page.tsx` | Coverage is rounded **down** wherever it is printed. 91.67 rounds to 92, and "you are at 92%" beside a locked button that opens at 92% is the page calling the learner a liar about their own screen |
| `database/lms/15_learning_pages.sql` | The throttle is now `ceil(60 / bucket_seconds * 1.5) + 3`, which is 12 at ten second slices, rather than `(60 / bucket_seconds) + 3`, which was 9. Honest 1.5x produces exactly 9 a minute, and because the window is rolling the busiest minute actually holds **10**, so real watching was being thrown away at a speed the player itself offers |
| `tests/watch-slices.test.mjs` (new) | 18 tests. A whole lesson at 0.75x, 1x, 1.25x and 1.5x must each reach 100 percent and open, with and without a phone that cannot keep time |
| `database/lms/tests/file_15_tests.sql` | Tests 48 and 49: an honest 1.5x minute is never refused, and a script is still refused |
| `database/lms/15_verify.sql` | Row 23, on the throttle. 23 rows now |
| `docs/lms/PHASE-5-TEST.md` | 4.3c and 4.3d: watch a whole lesson at 1.5x, and another at 1.25x, and both must reach 100 percent |

**On what the throttle change concedes.** It is the only thing making a faked watch take about
as long as a real one, and 12 instead of 9 makes a fake a third faster. That is exactly the
speed up an honest learner already gets from the 1.5x the player offers, so it concedes nothing
that was not already conceded. The limit now says what it always meant: nobody may record
faster than somebody genuinely watching at the fastest allowed speed.

### The thing underneath it: the offline queue was throwing away the backlog

Chasing your jitter point led somewhere worse.

**`lms_record_watch` does not fail when it throttles. It answers normally, with the coverage
unchanged.** The queue treated "answered" as "stored" and deleted its own copy.

While playing that is nearly invisible, because only one or two are ever in flight. On reconnect
it is a disaster: somebody who goes through a tunnel comes back with thirty slices queued, the
queue fires them off as fast as the network allows, the database stores a dozen and ignores the
rest, and the queue deletes all thirty. **The feature whose entire promise is "nothing is lost"
would have lost almost everything in the one situation it exists for.**

`useWatchQueue` now keeps to the same rate the database accepts, with the number defined once in
`slices.js` beside a note saying it mirrors the SQL. A backlog drains at the speed of an honest
1.5x watch, the retry comes back every five seconds instead of twenty so it actually drains, and
the page says "Catching up on 23 parts you watched while the connection was down". Measured end
to end on the real page: **two minutes offline mid lesson, 48 of 48 slices survived.**

### One older test had to change

File 11's N8 asked for 12 slices and required fewer than 12 back, so it was testing the constant
rather than the rule and failed the moment the limit became 12. It bursts 40 now, which no
player at any allowed speed could produce in a minute, so it tests the thing it is named after
and survives the limit being tuned again.

### 2. The test script started in the wrong place

`PHASE-5-TEST.md` began with file 15. File 14 has never been run on the live database either,
and it is the one that closes the two leaks. The first section is now a table: file 14, then
`14_verify` (20 rows, all yes), then file 15, then `15_verify` (23 rows, all yes), with a line
saying to stop if rows 1 or 2 of `14_verify` say NO, because those are the leaks.

### 3. The quiz rules contradicted the waiting card

While the quiz is waiting, the four rule tiles are dimmed and greyed, the fourth reads "3/3
tries used" rather than "3, tries then a day's wait", and on a phone the waiting card comes
**first**. Dimmed rather than removed, because they are still the answer to "what am I coming
back to". Added to the test script as 6.10b.

### What was checked

| | |
| --- | --- |
| `npm run build` on top of `main` `d02c86b` | passes |
| Node tests | **76 pass, 0 fail** (was 58) |
| Database, files 01 to 15 | **255 pass, 0 fail** across seven suites |
| `15_verify.sql` | **23 rows**, all yes |
| Test 48 against the old throttle | FAILS, with "The throttle threw real watching away" |
| The new watch tests against the old player | FAIL at 1.25x and 1.5x |
| A whole lesson on the real page at 1x, 1.25x, 1.5x and 2x | **48 of 48 slices, 100%, OPEN** every time |
| Two minutes offline mid lesson | **48 of 48 slices survived** |
| Browser: the six pages and Part C | 73 checks, all pass |

---

## PHASE 4, 8 October 2026. The part where people learn.

Database file 15, then the six pages. The database went first because the pages needed several
things it could not give them, and because two of its rules would have trapped learners.

### What was left out of this phase, and why

The standing section. It is not empty this time.

| Left out | Why |
| --- | --- |
| **The concept's bootcamp wording.** The My learning tab shows a notice reading "Your bootcamp access is open, so every course is free to you", and a pass card reading "Every course is free while your bootcamp enrolment is active" | Your standing rule is "never say anything about bootcamp emails or who gets free access", and it has been repeated in three briefs. The pass card built in Phase 2 says "Your bootcamp enrolment is active, so the courses it covers are open to you", which is true of what the server actually granted and promises nothing about any other course. I kept that and did not adopt the concept's stronger line. **Say so if you want the concept's wording instead** |
| **The "Active learner / Brand new" switch** on the My learning tab | It is a device for showing you two states in one HTML file. On the real page the state is whatever the learner actually has |
| **The welcome video on `/lms`** | `lms_settings` has had `welcome_provider`, `welcome_ref` and `welcome_seconds` since file 02 and nothing has ever read them. It was not in this brief and it is not in the concept's landing tab, so it is still unread. It is a small Phase 6 job |
| **A short answer question type** | `lms_questions` supports `short_text`, and `lms_start_quiz` correctly returns it with no options. No course has one, and the marking is a string comparison that needs thinking about before it is put in front of anybody. The question renders with a line saying it cannot be answered here and to tell the tutor, rather than as a broken empty box |

### The two traps, which were live faults

Both are reachable by an ordinary learner having an ordinary bad day, and the only way out of
either was somebody writing SQL against the live database.

**A lesson check locked the course for ever.** `lms_create_quiz` gives a check a 100 percent
pass mark, which is right, and 20 tries, which is not. `lms_start_quiz` returns an empty table
once the tries are used, and with `retake_after_minutes` at 0 there is no reopening clause at
all. So the twentieth wrong answer on three questions meant `lms_complete_lesson` refused the
lesson, `lms_is_lesson_unlocked` refused the next one, and the course could never be finished.
The learner saw a button that did nothing and no explanation anywhere. **A check now ignores the
try limit completely.**

**A module quiz locked the certificate away for ever.** Three failed tries and the same thing,
permanently. **It now reopens 24 hours after the last try, with a fresh set of tries.** The wait
is the point: it sends somebody back to the lessons rather than guessing again.

### Database file 15

| | What |
| --- | --- |
| `lms_my_course(slug)` | **new.** One call for a whole learning page: the ring, the resume target, every module and lesson with its state, each quiz's status, the certificate |
| `lms_quiz_status(quiz)` | **new.** `lms_start_quiz` returns nothing for six different reasons, so a page could only say "something went wrong". This says which, in a sentence written for a person |
| `lms_start_quiz` | **replaced.** The two rules above |
| `lms_attempt_marks` | **replaced.** It had the rule backwards in both directions at once: it marked every question for any submitted try, module quizzes included, which is solvable by elimination across three tries; and it showed the explanation only when the answer was **right**, which is the one time nobody needs it. Now: a check gives everything, a module quiz gives nothing until it has been passed |
| `lms_record_watch` | **replaced.** It stored `greatest(old, new)` as the position, so somebody who rewound to re-watch a hard part and stopped there was sent back to the furthest point they had ever reached. It stores the latest position now. It also counts new slices into the day |
| `lms_watch_days` | **new table.** One row per learner per day. The This week chart cannot be counted from the slices, because `lms_progress_tidy_up` deletes a lesson's slices the moment it is completed: the harder somebody worked, the less the chart would show |
| `lms_my_week()` | **new.** Seven rows, always, today last |
| `lms_my_courses()`, `lms_my_certificates()` | **new.** The whole of `/lms/me` in two calls |

Plus `15_verify.sql` (22 rows at the time, 23 after the review round), `15_undo.sql`, `15_test_course.sql`'s successor in
`docs/lms/PHASE-5-TEST.md`, and the tests.

### Three things I found while writing file 15

**My own version of the bug I was fixing.** The first `lms_quiz_status` reported `tries_used: 0`
and `tries_left: 3` on a quiz that was shut, because three tries divide exactly by three and I
was reading the remainder. A page built on that would have shown "3 tries left" above a button
that refuses to work. Test 46 caught it; it is fixed in both places that do the arithmetic.

**`lms_watch_days` could be written to by any signed in learner.** Not through a policy, there
is none, but Supabase's default privileges hand `INSERT`, `UPDATE` and `DELETE` on every new
public table to `authenticated`, and `lms_tidy_table_privileges` only takes those back from
`anon`. Row security refused the write anyway, so nothing was exploitable, but a table whose
whole job is to be a record the learner cannot fake should not depend on one policy being
present. The grants are revoked explicitly now, and `lms_watch_buckets` was in the same state
and got the same treatment.

**`15_undo.sql` would have run even while refusing.** The guard raises an exception, which in
the Supabase editor rolls the whole script back, so it works where you use it. Run through psql
it printed the refusal and then carried on undoing. File 15's undo is wrapped in a transaction
so it refuses either way. **Files 10, 11, 13 and 14 have the same shape**; I have not touched
them, and it is in STATUS.md.

### The pages

| Address | What |
| --- | --- |
| `/lms/learn/:slug` | My course: the ring, one resume button to the exact lesson and second, the modules, the certificate checklist, the week tape |
| `/lms/learn/:slug/:lessonId` | The player |
| `/lms/learn/:slug/quiz/:quizId` | The module quiz: intro, one question at a time, review, result |
| `/lms/learn/:slug/complete` | The certificate moment |
| `/lms/me` | The full bento |

All four learning pages are behind `RequireAccount`, carry `noindex`, are registered in
`api/_site-routes.js` as deliberately out of the sitemap, and hide the site's floating WhatsApp
button through the `focus` prop `AcadStage` already had.

**The player keeps four rules, and each one has a reason:**

- **One slice every ten seconds of real playing.** Not of wall clock: a paused video records
  nothing, and the slice index comes from the position in the video, so a slice can only be
  credited for a part that was actually on screen.
- **First watch: no running ahead.** Going back is always allowed, and so is going forward over
  ground already watched. Only running past yourself is refused, with a line saying so rather
  than a silent jump.
- **First watch: 1.5x at most.** This is arithmetic, not a preference. `lms_record_watch`
  refuses more than nine slices a minute as script-like and a player at 2x sends twelve, so a
  quarter would be thrown away and the lesson would never open. The cap is enforced against
  YouTube's own speed menu too, not just ours.
- **A slice that does not get through is kept**, in a queue mirrored into this browser so it
  survives the tab closing, and sent when the connection comes back. Sending the same slice
  twice is safe by design, which is also what makes two tabs harmless.

### Three bugs only a browser could find

**The player took the whole page down.** YouTube's API does not fill the element you hand it, it
**replaces** it with an iframe. React then tried to remove a node that was no longer there and
threw `The node to be removed is not a child of this node`. It fired on any re-render that
swapped the player out, which includes the message for a video that will not play, so the
handle-a-broken-video-gracefully path was itself a crash. React now owns an outer frame it never
looks inside, and the inner div handed to YouTube is created by hand.

**The certificate would have said "This certifies that learner".** `getSession().fullName` falls
back to the part of the email before the at sign, which is right for a greeting and wrong on a
certificate. The card reads `lms_profiles.full_name` now, the same field
`lms_claim_course_certificate` writes into the register, so the two always agree. A blank one
says "Add your name" in grey italic rather than printing a guess.

**A flex gap split a sentence.** The gate read "You are at **52%** ." with the full stop floating
off on its own: the paragraph is a flex row so the tick can sit beside the words, and a flex
container puts its gap between every child, bare text nodes included.

### One Phase 3 fault this phase repeated and fixed

`.acad-chip` lived in `CourseCard.css`. The learning pages use it and never load that file, so
it would have arrived unstyled, which is exactly the trap found on the course page in Phase 3.
It has moved into `academy.css`, where anything used by more than one page belongs.

### What was checked

| | |
| --- | --- |
| `npm run build` on top of `main` `d02c86b` | passes |
| Node tests | **58 pass, 0 fail** |
| Database, files 01 to 15 | **253 pass, 0 fail** across seven suites |
| File 15 before it is applied | **9 pass, 36 FAIL**, with the four traps named in words |
| `15_verify.sql` | 22 rows, all yes. 19 say NO beforehand. A 23rd was added in the review round |
| `15_undo.sql` | refuses while guarded, undoes properly when changed |
| File 15 run twice | 47 still pass |
| Browser: the six pages and Part C | **73 checks, all pass**, at 1360px and 390px |

---

## PHASE 3 REVIEW ROUND, 8 October 2026

Your six items, plus three things I found while fixing them. Everything below is on top of the
Phase 3 package, not instead of it.

### What was left out of this round, and why

Nothing. You asked me to list anything I leave out and say why, so this section stays here and
stays honest. It is empty for this round.

### 1. SERIOUS. A course page told Google it did not exist whenever Supabase was asleep

`getCourse` returned nothing both for "no such course" and for "the call failed", and the handler
treated nothing as not found, so a slow, down or paused Supabase produced a 404 with `noindex`.
The free plan pauses after a week without visitors, so one quiet week and a crawl would have
dropped every course from the index.

| Changed | What |
| --- | --- |
| `api/_academy-data.js` | `callRpc` and the new `callRest` return `{ ok, data }`. `getCourse` now has three answers: a course, a real empty reply, and could not ask |
| `api/academy-meta.js` | 404 with `noindex` **only** when Supabase replied with no row. Any failure serves the ordinary page: 200, no `noindex`, `s-maxage=30` and no `stale-while-revalidate` |
| `api/sitemap.js` | the same idea: a shorter cache when the courses are missing |
| `src/lib/catalogue.ts` | `getCatalogue` returns `{ ok, courses }`; `getCourse` keeps its three way answer |
| `src/pages/Academy/Courses/page.tsx` | **not in your list.** The catalogue showed "The first courses are on their way" when it could not reach the database, which sends a reader away believing the Academy is empty. It now says it could not load them, with a try again button |
| `src/components/AcademyBand/component.tsx` | only a successful answer sets the count, so a failure hides the band rather than claiming a number |
| `tests/academy-meta.test.mjs` | four new tests: slow, down, a paused project answering 503, and a genuine missing course. Written against the old code first, where three of the four failed |

### 2. One address, everywhere

| Changed | What |
| --- | --- |
| `api/_seo-rules.js` | `SITE_ORIGIN = "https://dataleadafrica.com"`, plus `siteUrl` and the new `siteAsset` |
| `src/lib/site.ts` | imports it rather than declaring it |
| `api/academy-meta.js`, `api/sitemap.js`, `api/og.js` | every canonical, `og:url`, `og:image`, structured data url and sitemap `loc` comes from it |
| `tests/seo-agreement.test.mjs` | fails if any of those files grows its own copy, and checks the `Sitemap:` line of `robots.txt` |
| `tests/academy-meta.test.mjs` | sends a request with the `dataleadweb-frontend.vercel.app` host and fails if that string appears anywhere in the answer |

The edge still fetches its own `index.html` from the host it is running on, which is correct: a
preview deployment has to read its own files.

**Found while doing it, not in your list.** `siteUrl` strips the query string, which is right for
a canonical and was silently removing `?course=` from every `og:image`, so every course was
sharing the generic picture rather than its own. There are two helpers now, `siteUrl` and
`siteAsset`, with a test showing the difference.

### 3. The buy card for signed in people

`src/pages/Academy/Course/BuyCard.tsx`, `BuyCard.css` and `Course/page.tsx`.

A fifth state, `waiting`. The page now calls `lms_has_course_access` for anybody signed in
looking at a paid course:

| Who | What they see |
| --- | --- |
| Has access | "Continue learning", to `/lms/me` until Phase 4 |
| Signed in, no access, paid, payments closed | The price, "Online payment opens soon", and "Try module 1 free" when `first_module_free`. **No** "Create an account" |
| Signed out | "Create an account", as before |

A free course is open to anybody signed in, which is the database's rule in `lms_lesson_is_open`,
so the page does not ask about those. While the answer is on its way, a signed in person sees the
middle row, so the button never changes under them from wrong to right. The same on the phone
bar, because it is the same component.

Still nothing about bootcamp emails or who gets anything free, and there is now a browser check
that reads the whole page and fails if it ever says so.

### 4. Two copies of the structured data

| Changed | What |
| --- | --- |
| `api/academy-meta.js` | its JSON-LD scripts carry `data-edge="1"` |
| `src/components/Seo/component.tsx` | removes anything carrying that mark before adding its own |
| `src/pages/Academy/Courses/page.tsx` | **found by the check:** the catalogue had a visible breadcrumb and no `BreadcrumbList` in its markup. It has both now, on both sides |
| `api/academy-meta.js` | one `breadcrumbJsonLd` builder for both pages, instead of the trail being written out inside the course builder |

The browser check is new and lives with the other checks, outside the repository. A Node test
only ever sees what the edge wrote, so nothing but a real browser can see a duplicate that only
appears after React runs. It loads all three pages in Chromium and counts the blocks before and
after.

### 5. The two things the brief asked for that were missing

**a. The landing headline and subhead from `lms_settings`.**

| Changed | What |
| --- | --- |
| `api/_seo-rules.js` | `LANDING`, `CATALOGUE`, `NOT_FOUND` and `landingWords`, so the words exist once rather than twice |
| `api/academy-meta.js` | imports them instead of declaring its own |
| `src/lib/courseSeo.ts` | the typed doorway onto them |
| `src/lib/catalogue.ts` | `getSettings` |
| `src/pages/Academy/Landing/page.tsx` | reads the headline, subhead and announcement, with the current words as the fallback |
| `src/pages/Academy/Landing/page.css` | the announcement line |

The `<title>` and `<meta description>` deliberately do **not** come from the database. They are
the two lines a search engine weighs most, and a mistyped headline in the Phase 6 control room
should not be able to move the Academy down the results. There is a test.

The landing title and description had been written out twice, once in the page and once in the
edge function, as two constants that happened to match with nothing checking them. That is gone.

**b. Learning paths.**

`src/lib/catalogue.ts` gains `getPaths`; `src/pages/Academy/Landing/page.tsx` and `page.css` gain
the section. Built from published `lms_paths` and `lms_path_courses`, in `position` order. A
course inside a path that has since been unpublished is dropped, because a path must never link
to a page that is not there, and a path left with no courses disappears. The whole section is
absent when there are none.

### 6. The polish

| | Changed | What |
| --- | --- | --- |
| a | `Course/BuyCard.tsx`, `BuyCard.css` | "Online payment opens soon" is inside the phone bar, under the price, instead of floating above it over the page |
| b | `ui/Breadcrumb.tsx` and `.css` (new), `Courses/page.tsx`, `Course/page.tsx`, `Courses/page.css` | One component with its own stylesheet. The two looked different because the styles lived in the catalogue's stylesheet and the course page never loads it, so its trail arrived as plain blue links. Same family of mistake as the one caught in Phase 3 |
| c | `ui/ToolRack.tsx`, `ToolRack.css` | A long tool name gets smaller type and may wrap. Keys are a grid, so one that wraps does not leave its neighbours short. Checked in a browser by measuring "KoboToolbox" against its key |
| d | `src/pages/Courses/page.tsx` | The Academy band moved to just before "Why Data-Lead Africa". **A choice worth flagging:** it sits after the kids bootcamp section rather than between the two grids, so the two programmes stay together. When there are no kids courses that section is absent and the band follows the main grid directly |
| e | `api/_seo-rules.js`, `api/academy-meta.js` | One `plural` function, used everywhere a count is written in the plain HTML, with tests |
| f | `database/lms/tests/README.md`, `tests/DO-NOT-RUN-ON-SUPABASE_certification-harness.sql` | See below |

**The tests README was not just out of date, it was unfollowable.** File 13 refuses to apply
unless `certificates.certificate_number` has a UNIQUE rule, the real database has one and the
local stand in did not, so anybody following the README hit a wall with no way past it. The
certification harness now adds the rule if it is missing, and the README explains why the two
harness files have to go in a particular order.

Its numbers were wrong too. It said 132 tests in four suites with 25 in the file 12 suite. It is
**206 tests in six suites** and that suite has 52. Every number in it is now counted from a run
on 8 October, which is also how I found that the "fail first" figure for file 14 had drifted: it
is 7 passed and 22 failed, not 6 and 23. `docs/lms/WHAT-CHANGED-explained-phase-3.md` is
corrected to match.

### For later, in STATUS.md

The main JavaScript bundle is 1.17 MB, 354 KB compressed, because every page outside the Academy
loads at once. Lazy loading the other route groups the way the Academy's are done would make the
whole site faster on phones. A separate pull request after launch.

### What was checked

| | |
| --- | --- |
| `npm run build` on top of `main` `d02c86b` | passes |
| Node tests | **58 pass, 0 fail** (was 42) |
| Database suites, files 01 to 14 applied | **206 pass, 0 fail** across six suites |
| Browser: structured data | 12 checks, all pass |
| Browser: the review's visual items | 31 checks, all pass |

---

## SITE WIDE, 8 October 2026. Two fixes that are not about the Academy.

Listed first and separately, because they change every page on dataleadafrica.com.

### 1. Every page told Google it was a copy of the homepage

`index.html` carried these two lines:

```html
<link rel="canonical" href="https://dataleadafrica.com/" />
<meta property="og:url" content="https://dataleadafrica.com/" />
```

`index.html` is served for **every** address on the site. So the first HTML a search engine
received for `/courses`, for every blog post and for every research page said "this is a copy of
the homepage". A crawler that does not run JavaScript never saw anything else. One that does still
read it first.

Both lines are gone. There is a comment where they were, saying why, because the obvious thing to
do when you notice they are missing is to add them back.

They are now set per page: by the `Seo` component once React boots, and by the edge functions
before the HTML is even sent.

**This is the largest SEO problem the site had, and it had nothing to do with the Academy.**

### 2. robots.txt and sitemap.xml did not exist

`public/robots.txt` is new. `/sitemap.xml` is new, built by an edge function from the site's own
route list plus every published course.

| Changed existing file | What changed |
| --- | --- |
| `index.html` | The two lines above removed, and a comment left in their place |
| `src/components/Seo/component.tsx` | An optional `canonicalPath`, and `SITE_ORIGIN` instead of `window.location.origin`. Every page that does not pass the new prop behaves exactly as before |
| `vercel.json` | Four rewrites, all placed BEFORE the catch all |
| `src/pages/Courses/page.tsx` | One band at the bottom linking to the Academy catalogue, which hides itself when no course is published |

---

## Phase 3, 8 October 2026. The three public Academy pages, and the database behind them.

**`npm run build` passes on top of `main` at commit `d02c86b`.** Fresh clone, package laid over it,
real build: exit code 0, `tsc -b` clean, `eslint` clean on every new file.

### Part A. Database file 14: two leaks closed

Both were real on the live database, and both were found by loading files 01 to 13 into a local
PostgreSQL and reading as the `anon` role. The tests were written to fail first: **6 passed and 23
failed before the fix, 29 pass after.**

**Leak 1. Every lesson's video id was readable by anybody.** `grant select on ... lms_lessons ... to
anon` is a grant on the whole table, every column, and the row policy then let anon see every
lesson of every published course. So `video_ref` and `content_md` came back with the rest.

File 10's comment said the reference was "useless without `lms_lesson_is_open`". That is true of a
player and false of YouTube: an unlisted video is not a private one, and the id plays for anybody
who has it, for ever. One request with the publishable key returned the id of every paid video.

Measured before the fix: **3 video references and 3 lesson bodies readable by anon**, and the same
by a signed in learner with no entitlement.

Fixed by granting the columns a shop window needs and no others. Titles, lengths and positions stay
readable, so the course page's curriculum still works. Granting columns rather than the table also
fails safe: a column added next year is not handed over until somebody says so.

**Leak 2. Draft courses were readable by anybody.** `lms_course_cards` is a view, and a view runs
with its OWNER's rights unless told otherwise, so the policy that hides draft courses was simply
not consulted. Measured before the fix: **2 draft courses visible to anon**, with their titles and
their prices. Fixed with `security_invoker = true`.

Also in file 14:

| | What |
| --- | --- |
| `lms_open_lesson(uuid)` | The only way to a video. Asks `lms_lesson_is_open` first, returns no row when the answer is no. For the Phase 4 player. `authenticated` only |
| `lms_staff_lesson(uuid)` | The same for staff, for the Phase 6 control room |
| The sweep | Every `lms_` view checked for `security_invoker` and every function for reading the video with the caller's rights. Both are also permanent tests, so a view added later cannot bring the leak back |
| Six new columns | `outcomes`, `audience`, `prerequisites`, `faq`, `seo_title`, `seo_description`, with length rules the database enforces and an FAQ shape check |
| The publish checklist | Now refuses a course with fewer than three outcomes. The empty summary rule was already there, as "Has a short description" |
| `lms_public_catalogue()` | One call, published only, with lesson, module and quiz counts and total seconds |
| `lms_public_course(slug)` | One call, with the modules and lessons as JSON. **Neither returns a video reference or a lesson body, and there is a test that reads their column names and fails if one ever does** |

`14_test_course.sql` puts one real course in, as a draft, with outcomes and an FAQ, for the Phase 5
test. It prints the checklist so you can see it is ready before publishing, and the file ends with
the one line to publish it and the one line to take it down.

**All five older suites still pass: 43 + 36 + 28 + 52 + 18, plus 29 new, is 206 tests.**

Four older fixtures needed bringing up to date, not because the new rule is wrong but because they
were written before it. One older test was also repaired: the file 12 suite was **not repeatable**.
P13 checks that a mailer which has never called in raises an alarm, and P14 four lines later makes
it call in, so the second run on the same database saw the first run's heartbeat and P13 passed
incorrectly. The seed now clears it.

`14_verify.sql` had the same fault as the Phase 1 readiness query and is now fixed: PostgreSQL
resolves function names at parse time, so a half applied file 14 made the whole verify return
nothing instead of a list of NOs. Row 19 runs its query through `query_to_xml`. With file 14
deliberately undone, the verify now reports **14 honest NOs** rather than erroring.

`14_undo.sql` refuses to run unless you edit one line in it, because undoing file 14 means putting
two security leaks back. It keeps the six columns, which hold words somebody wrote.

### Part B. The three pages

| Route | What it is |
| --- | --- |
| `/lms` | Hero, the tool rack, How it works, Latest courses, Check any certificate, FAQ, the dark closing band |
| `/lms/courses` | Breadcrumb, live count, search, area filters, sort, and a designed empty state |
| `/lms/courses/:slug` | Breadcrumb, chips, the four facts, the course map bar, outcomes, who it is for, the curriculum, certificate, FAQ, related courses, and the buy card |

**"Latest courses", not "Popular courses".** The concept says Popular; we do not measure popularity,
so the page would have been making up a number in the one place a stranger trusts least.

**The tool rack is never a hard coded list.** It is the tools that actually have a published course,
and it falls back to pills below four tools. It stops cycling when anybody touches it, when the tab
is hidden and when reduced motion is on.

**The catalogue's address never changes.** Filters and search change the list and nothing else: no
query string, no history entry. Every combination would otherwise be an address a search engine
could find, and it would find twenty thin pages instead of one strong one.

**The buy card has four states and exactly one is live.** Free, paid with payments open (not used:
Paystack comes later), paid with payments not open (this release: "Create an account", with "Online
payment opens soon"), and signed in with access. It says nothing about bootcamp emails or who gets
anything free.

**The Academy is loaded separately from the rest of the site**, with `React.lazy` and a dynamic
import, so somebody reading the blog never downloads it. Every loading state is a block the exact
size of the thing it is holding a place for, so nothing jumps.

### Part C. SEO

`api/academy-meta.js` answers the three public addresses with the real title, description,
canonical, sharing tags, structured data and **a plain HTML copy of the page's content inside
`#root`**, before any JavaScript runs. React replaces it on boot.

The rules it keeps, each with a test: a draft or unknown slug answers a real **404** and `noindex`,
never a 200; any query string is dropped from the canonical; if Supabase is slower than 1.5 seconds
or down, the ordinary page is served and **never a 500**; `s-maxage=300, stale-while-revalidate=86400`.

`api/sitemap.js` builds `/sitemap.xml` from the site's routes plus every published course with its
`updated_at`. The route list is a second copy of `routes.ts`, which an edge function cannot import,
so `tests/sitemap-routes.test.mjs` reads `routes.ts` and fails if the two ever drift. A new route
has to be classified as public or explained, on purpose.

`api/og.js` gains `?course=<slug>`: a 1200 by 630 card with the title and three facts, drawn with
the Poppins already in that file.

**One copy of the title and description rules.** They are needed in TypeScript for the page and in
JavaScript for the edge function. An earlier attempt wrote them twice with a test comparing the two,
and that test had to turn TypeScript into JavaScript with regular expressions to do it. They now
live once, in `api/_seo-rules.js`, which both sides import.

### Four faults found while building, none of them in the brief

| What | Why it mattered |
| --- | --- |
| The canonical carried the query string | The one place it must never appear. Found by the test, not by looking |
| The course page used styles defined in the landing page's stylesheet | Harmless until Phase 3 made each page load on its own. A visitor arriving at a course page from a search result got every eyebrow and every grid unstyled; it only looked right if you visited the landing page first. The shared styles now live in `academy.css` |
| An unclosed CSS comment ate the rules after it | Introduced while fixing the above. The build does not warn: it silently drops everything to the next `*/`. Every Academy stylesheet is now checked for it |
| The WhatsApp button sat on the sticky buy bar | The brief asked for this not to happen; it was still happening until the check caught it. The button is lifted clear on course pages rather than hidden, because a course page is public and the button belongs there |

### How it was checked

- **29 database tests** for file 14, failing first, against a real local PostgreSQL as the real
  `anon` and `authenticated` roles, plus 177 older ones. 206 in all
- **42 Node tests** for the edge functions, with a stubbed `fetch`: the five Supabase cases
  (normal, draft, unknown, slow, down), the canonical, the 404, the structured data, escaping, the
  sitemap, the route drift and the title rules
- **29 browser checks** on the three pages at 1360px and 390px: one h1 each, headings in order,
  filters not touching the address, the empty catalogue, the sticky bar, the WhatsApp button, and
  no sideways scroll

### Changed existing files

Ten. Four are the site wide fixes listed at the top of this entry.

| File | Change |
| --- | --- |
| `index.html` | The homepage canonical and `og:url` removed |
| `vercel.json` | Four rewrites before the catch all |
| `src/components/Seo/component.tsx` | Optional `canonicalPath`, and one site origin constant |
| `src/pages/Courses/page.tsx` | The Academy band |
| `src/pages/routes.ts` | Two public Academy routes |
| `src/main.tsx` | Mounts `academyRouter()` (Phase 2) |
| `src/lib/learning.ts`, `src/lib/certificates.ts`, `src/pages/Learning/Login/page.tsx`, `src/pages/Certificates/Claim/page.tsx` | The file 12 changes, written on 7 October and still unmerged |

`api/og.js` is also changed, by addition only: the certificate card is untouched.

### Two things to do when this is merged

1. Delete `database/lms/not-yet-run/10_roles_and_access.sql`, `10_undo.sql` and `10_verify.sql`.
   File 10 was run on 6 October and the current copies are at the top of `database/lms/`.
2. Check the primary address and, if it is the www one, change the single line in `src/lib/site.ts`
   and the `Sitemap:` line in `public/robots.txt`. `docs/lms/SEO.md` section 3 says how to check in
   thirty seconds. **This is the one thing in Phase 3 I could not verify from here.**

---

## Phase 2, 8 October 2026. The Academy, built on the design concept.

**`npm run build` passes on top of `main` at commit `d02c86b`.** I cloned the repository, laid
this package over it and ran the real build: exit code 0, `npx tsc -b` clean, and `npx eslint`
clean on every new file. That is a check I ran, not a claim.

An earlier version of this entry said `e4367d8`. That commit is real but two behind: `01292b1` and
the merge `d02c86b` came after it, and they added `database/lms/` and `docs/lms/STATUS.md` and
**touched no file under `src/` or `public/`**. So nothing in this package depended on the stale
copy, and the build is the same on both. Thank you for catching it. Verified by diffing
`e4367d8..d02c86b`.

### Two files to delete when this is merged

Laying this package over `main` leaves two things behind that it cannot remove by itself.

1. **`database/lms/not-yet-run/10_roles_and_access.sql`, `10_undo.sql` and `10_verify.sql`.** File
   10 was run on 6 October, and its three files are at the top of `database/lms/` in this package.
   The copies in `not-yet-run/` are stale, and the folder's name now says something untrue about
   them.
2. Nothing else. `DataLeadWeb-frontend/` is a separate job, after launch, in its own pull request.
   It is in `docs/lms/STATUS.md`.

Phase 2 was built once, looked too plain, and has been rebuilt to the design concept. This entry
describes the package as it stands, not the difference from the first attempt.

### The second review round, 8 October

Four things came back. All four are in.

**1. A real bug in swallowing the error, and it was mine.** supabase-js does **not** throw when the
network fails: `_request` builds an `AuthRetryableFetchError` and throws it, and then every public
method catches it again with `if (isAuthError(error)) return { error }`. So the try/catch I had
wrapped every call in never fired once. "Nothing was thrown" was read as "the server answered", and
every failure was treated as the one failure that has to be hidden. Three real ones were hidden
with it, and in all three the person was shown the code screen and left waiting for an email that
was never going to arrive: no connection, the project's hourly email allowance used up, and the
mailer or hook being down. With the allowance set to 20 an hour, the middle one would have happened
on a busy day.

The error is now read, and the decision is made on its kind:

| What came back | What happens |
| --- | --- |
| `status 0`, the request never left the device | *We could not reach the Academy. Check your connection and try again.* |
| `429` matching `after N seconds`, the per address wait | **Treated exactly as success.** This is the only one that leaks, because Supabase sends it only for an address it already knows |
| `429` anything else, the project's hourly allowance | *We are sending a lot of emails right now. Please try again in an hour.* |
| `500` and above | *We could not send your code just now. Please try again in a few minutes.* |
| anything else | success |

Applied to sign up, send another code, and reset. **Fifteen tests, five cases on each.**

While in there I found the same fault in two more places the review did not list. A dropped
connection during **sign in** was reported as *that email address and password do not match*, which
sends somebody off to reset a password that was fine; and a dropped connection while **a code was
being checked** was reported as *that code was not right*, which burns a good code. Both now say
the connection failed. Two more tests.

**One residual leak, written down rather than quietly accepted.** The `500` can only happen when an
email was really being sent, which on sign up means the address was new, so in principle somebody
watching very closely could read something into it. Reporting it anyway is the right trade: it
needs the mailer to be broken at that exact moment, and the alternative is telling a real person a
code is coming when we know it is not.

**2. The WhatsApp button over the main button on phones.** Hidden on `/lms/sign-up`,
`/lms/sign-in`, `/lms/reset` and `/lms/me`, and kept on `/lms` and the public Academy pages.

I used the scoped rule rather than editing `Footer`, as suggested:

```css
body:has(.acad-stage--focus) .wa-float { display: none; }
```

`AcadStage` takes a `focus` flag which adds that class, and the four pages pass it. The reason for
preferring it: the button belongs to `Footer`, which every page on the site renders, so reaching
into Footer from here would let a page outside `/lms` start hiding it by accident. This way the
whole arrangement is one rule in the Academy's own stylesheet, beside the thing it is about. A
browser too old for `:has()` drops the rule and shows the button exactly as it does today, which is
the right way for it to fail. The Phase 4 lesson player will pass `focus` too.

**3. The beacon touching the step rail.** Its top margin goes from 30px to 54px. The two rings
leaving the beacon grow to 1.7 times its size, about 26px past the top of the box, which is what
was closing the gap. Measured in the browser afterwards: 27px of clear space between the rail and
the furthest the rings reach.

**4. The commit.** Covered above.

**Agreed, no change:** the orange button keeps white text, like the rest of the site.

### New pages

| Route | What it is |
| --- | --- |
| `/lms` | The Academy is opening soon, until Phase 3 |
| `/lms/sign-up` | Name, email, password, then six boxes for the emailed code |
| `/lms/sign-in` | Email and password, with a route back for an unconfirmed account |
| `/lms/reset` | Address, code, new password |
| `/lms/me` | Greeting, access notice, pass card, and the space Phase 4 fills |

Every one carries `noindex`.

### The design system

Built from the attached concept and written down in `docs/lms/DESIGN.md`, so Phases 3 to 6 build
from one place rather than from memory.

```
src/pages/Academy/academy.css        tokens, type, button, link, messages
src/pages/Academy/ui/AcadStage       the stage: grid, glow, page width
src/pages/Academy/ui/AcadCard        the white card with the orange edge
src/pages/Academy/ui/StepRail        Details, Verify, Ready
src/pages/Academy/ui/Field           one input with a floating label
src/pages/Academy/ui/PasswordStrength
src/pages/Academy/ui/CodeBoxes       the six code boxes
src/pages/Academy/ui/MeterRing       a circular countdown
src/pages/Academy/ui/WatchTape       one cell per ten seconds. Built now, used in Phase 4
src/pages/Academy/ui/PassCard        who you are and what your account reaches
src/pages/Academy/ui/EmptyState      before anything has been started
src/pages/Academy/ui/Icons           the line icons, drawn inline
src/pages/Academy/ui/format.ts       asClock
src/pages/Academy/CodeStep           the whole code screen, shared by three pages
src/pages/Academy/Pitch              the left hand side of the account pages
src/pages/Academy/useCodeTimers.ts   the two countdowns, worked out from one timestamp
```

**Every token is on `.acad`, and nothing touches `:root`, `html` or `body`.** `portal.css` already
rewrites `:root` and sets a `body` background, and Vite bundles every stylesheet together, so those
apply site wide the moment any portal page loads. The Academy must not add a second source of that.

### One new font, self hosted

`public/fonts/jetbrains-mono/`, weights 400, 500 and 600, latin only, 63.3 KB, SIL Open Font
License, with `OFL.txt` beside the files. Declared in `academy.css`, not `global.css`, so the rest
of the site never downloads it. **No new npm dependency.**

Clash Display and Poppins are already in the repository and no new files were added for them.

| | Raw | Over the wire |
| --- | --- | --- |
| Academy CSS | 31.5 KB | 8.5 KB |
| JetBrains Mono | 63.3 KB | 63.3 KB |
| **Total added** | **94.9 KB** | **71.8 KB** |

The budget was 120 KB.

### The seven fixes

| # | What was wrong | What it is now |
| --- | --- | --- |
| 1 | The welcome notice never appeared, because the sync after sign up, sign in or reset used up `changed = true` before `/lms/me` ever asked | Whoever calls the sync carries the answer to `/lms/me` in the navigation, which also wipes it from the history entry so a reload does not show it twice. `/lms/me` uses the role from that same answer and no longer calls `lms_my_role` |
| 2a | Typing one digit into a filled box wiped the whole code, because the box reports two characters and anything over one was treated as a paste | Three or more at once is a paste. For two, whichever is not the old digit is kept |
| 2b | After a wrong code the cursor stayed where it was | It goes back to box 1 |
| 2c | A digit typed into box 3 while 1 and 2 were empty jumped to box 1 | The boxes keep an array of six cells, so the gap survives |
| 3 | The reset code screen had no way to ask for another code | It has Send another code, with the same 60 second ring as the others |
| 4 | Supabase answers "you can only request this after 60 seconds" **only for addresses that have an account**, and both pages passed that straight on | Sign up and reset do not read the reply at all. Every answer produces the same screen |
| 5 | The steps were divs with click handlers | Every step is a real `<form>` with a real submit button, so Enter works and password managers offer to save |
| 6 | An error stayed on screen while the person fixed it | Each message names the box it is about and clears the moment that box is edited |
| 7 | `/lms` named four courses that do not exist and pointed bootcamp people somewhere else | It names no courses, promises nothing about who gets what, and says only that the Academy is nearly ready |

### Wording removed from every account page

Nothing before sign in says anything about who gets which courses, or about which address to sign
up with. Two lines are gone:

- Sign up: *"If you are on one of our bootcamps, use the same address you enrolled with and your
  courses will be waiting."*
- `/lms`: *"On a bootcamp with us? Use the learning portal instead."*

Before somebody is signed in the page has no idea who is reading it, so any such sentence is a
promise made to a stranger. What an account reaches is settled by the server and said by the pass
card on `/lms/me`. The learning portal is still linked from `/certifications`, so nobody is
stranded.

The watch tape appears on no account page.

### Five more faults, found while testing this phase

None of these were in the brief. They were found by driving the pages and by rendering the
components rather than by reasoning about them.

| What | Why it mattered |
| --- | --- |
| The six boxes submitted a code the page could not see | The boxes finish and tell the page in the same tick, so the page's own copy is one digit behind. A complete code was refused with *please enter all 6 digits*. The boxes now hand the finished code over as an argument |
| My own CSS reset beat my own buttons | `.acad button { color: inherit }` scores higher than `.acad-btn`, so the orange button had dark text and inline links looked like ordinary writing. The reset now uses `:where()` and carries no weight |
| The watch tape drew nothing for a long lesson | An hour is 360 cells, and at `1fr` each they refuse to shrink and push each other out of the grid. It now groups buckets above 120 cells and uses `minmax(0, 1fr)`. A lesson with no length says so instead of drawing one cell the width of the card |
| Reduced motion left one animation running | The rule said `.acad *`, which does not match `.acad::after`, and that is exactly where the glow that never stops is drawn |
| Two pieces of small orange text missed AA | `#c2500a` is 4.7:1 on white but 4.0:1 on the faintest orange wash. There is now a second orange, `--acad-signal-deep`, for text on a tint |

Also hardened while there: every Supabase call is wrapped, so a dropped connection says *We could
not reach the Academy* instead of leaving a button spinning for ever. A returned error can depend
on the address and is swallowed; a thrown one means the request never left the phone and is
reported honestly.

### How it was checked

Not by looking at it. Three scripts drove the real pages in a real browser against intercepted
Supabase replies, with nothing added to the website:

- **12 checks** on the code boxes: typing, the two character case both ways round, paste, autofill
  into the wrong box, backspace, and the cursor after a refusal
- **41 checks** on the rest: the 429 behaving exactly like a success on both pages, Enter
  submitting, errors clearing on the right box only, the notice appearing once and not returning
  on reload, and no page before sign in naming a course, mentioning free access or drawing a tape
- **10 checks** on the design rules: only `transform` and `opacity` animated, a hidden tab stopping
  everything, reduced motion stopping everything, and the contrast of **71 runs of text** across
  four pages, composited against what is actually behind them
- **24 checks** from the second review round: the five failure cases on each of the three pages
  that send an email, the two places a dropped connection used to be blamed on the person, the
  WhatsApp button gone from the four task pages and still there on `/lms`, nothing covering the
  main button on a phone, and the gap above the beacon measured in the browser

All 87 pass. Both widths, 1360px and 390px, were screenshotted at every step.

The resend tests wind the browser's clock forward 65 seconds rather than forcing the disabled
button, so they go through the path a person actually takes.

### Existing repository files this package changes

Six, and four of them are the file 12 website changes written on 7 October and never merged.

| File | Change | Why |
| --- | --- | --- |
| `src/pages/routes.ts` | Five entries added at the end | The Academy routes |
| `src/main.tsx` | One import, one line in the route list | Mounts `academyRouter()` |
| `src/lib/learning.ts` | Calls `request_sign_in_code` instead of `request_certificate_code` | File 12 |
| `src/lib/certificates.ts` | The same change | File 12 |
| `src/pages/Learning/Login/page.tsx` | Shows the shared sentence | File 12 |
| `src/pages/Certificates/Claim/page.tsx` | Shows the shared sentence | File 12 |

**Nothing else is touched.** No existing component, no existing stylesheet, no `global.css`, no
`vercel.json`, no `package.json`. **No new dependencies.**

### Decisions worth recording

| Decision | Why |
| --- | --- |
| The orange button keeps white text at 2.95:1, below AA | It is the site's own button, `#f56e0f` with white text, used identically in `LeadForm`, `GizStrip`, the Footer and the blog. Reaching AA means a noticeably browner button here than everywhere else on the site, which is a decision about the whole site rather than about `/lms`. `docs/lms/DESIGN.md` section 10 names the two places to change if you want it |
| Sign up and reset do not read Supabase's error at all | Reading it is the leak. See fix 4 |
| The code screen is one component shared by three pages | The three copies had already drifted: only two had a resend button, and the third was the one people most needed it on |
| The two countdowns are worked out from one timestamp, not counted down | A browser slows timers in a background tab, so a counter drifts and eventually tells somebody their code has four minutes left when it expired a while ago |
| `WatchTape` is built now and used in Phase 4 | It is the signature element, and building it with the system means Phase 4 inherits something already proven rather than inventing it under pressure |
| The pass card's sheen is masked rather than blurred | A blur on a permanently rotating element is the most expensive thing on a page and the first thing to stutter on a cheap Android phone |
| `/lms/me` shows the pass card only once the sync has answered | Showing the plain card first and swapping it a moment later would tell somebody their access had changed when all that happened was the page finished loading |
| Only the first code box carries `autocomplete="one-time-code"` | On all six, some browsers offer the code six times over |

### One row to add to the Supabase settings checklist

**Authentication, Sign In / Providers, Email, Minimum password length = 8.**

It is in `docs/lms/SUPABASE-AUTH-SETTINGS.md` as setting 7, with how to confirm it took. The pages
already refuse anything shorter, but a rule enforced only in the browser is not a rule.

### Still waiting

- The real email test. Every code in this phase is sent by Supabase through the hook and the Apps
  Script mailer, and none of that is reachable from a preview. Phase 5.
- `/lms/me` has two tiles. The Continue, This week, Your courses and Certificates tiles are
  Phase 4, and This week needs a new database function first: see `docs/lms/STATUS.md`.
- `/lms` is a placeholder. Phase 3 replaces it.

---

## Phase 1, 7 to 8 October 2026. The database.

Files 01 to 07, 10, 11, 12 and 13, all applied to the live database, with 177 tests across five
suites. See `docs/lms/STATUS.md` for the decisions log and `docs/lms/test-evidence-file-*.md` for
the evidence.

Also in this package from Phase 1: `scripts/lms/mailer.gs` and `scripts/lms/alarm.gs`, which are
pasted into Apps Script projects rather than run from the repository, and the documents in
`docs/lms/`.
