# SEO.md

How the public Academy pages are found, and how to check each piece yourself.

Everything here is built, not planned. The last section is a checklist you can work through with
nothing but a browser.

---

## 1. The problem this solves

The website is a single page app. The server sends an almost empty `index.html` and the browser
builds the page from JavaScript. A person never notices.

A crawler that does not run JavaScript sees an empty page. Until Phase 3 it also saw the
**homepage's** title and canonical on every single address, because both were written into
`index.html` by hand. So the first HTML Google received for `/courses`, for every blog post and for
every research page said, in effect, "this is a copy of the homepage".

Most AI assistants that read a page do not run JavaScript either.

Phase 3 fixes it in two layers:

| Layer | What it does | Who it is for |
| --- | --- | --- |
| The edge functions in `api/` | Write the real title, description, canonical, sharing tags and a plain copy of the page's content into the HTML **before it is sent** | Crawlers, AI assistants, link previews |
| The `Seo` component | Sets the same tags again once React has booted | Crawlers that do run JavaScript, and the browser tab |

They must agree. Section 6 explains how that is kept true.

---

## 2. The site wide fix

`index.html` no longer carries a `canonical` or an `og:url`. Both pointed at the homepage, on every
page of the site.

This is listed separately in `CHANGELOG.md` because it is **not an Academy change**. It affects
every page on dataleadafrica.com, and it is the single largest SEO problem the site had.

There is a comment in `index.html` where they used to be, saying why, because the obvious thing to
do when you notice they are missing is to add them back.

---

## 3. The primary address

**Settled on 8 October 2026: the primary address is the bare `https://dataleadafrica.com`.**

A site that answers on both `dataleadafrica.com` and `www.dataleadafrica.com` has to tell search
engines which one is real, and say the same thing in every canonical, every `og:url`, every
`og:image`, every url inside the structured data, every line of the sitemap and the `Sitemap:`
line of `robots.txt`. Saying one in one place and the other elsewhere splits the site's standing
in search between two addresses that are really one.

### It is written in one place

```js
// api/_seo-rules.js
export const SITE_ORIGIN = "https://dataleadafrica.com";
```

Everything imports it:

| File | What it uses it for |
| --- | --- |
| `src/lib/site.ts` | the typed doorway the React pages use |
| `api/academy-meta.js` | every canonical, `og:url`, `og:image` and structured data url |
| `api/sitemap.js` | every `<loc>` |
| `api/og.js` | the share picture's own address |

**To change it, change that one line.** The only other place the address appears is the
`Sitemap:` line at the bottom of `public/robots.txt`, because a plain text file cannot import
anything. A test in `tests/seo-agreement.test.mjs` checks that line and fails if any of the four
files above grows its own copy.

### Never from the request

The edge functions used to build the address from the host header they were answering on. That
is correct for exactly one host and wrong for every other, and there are several: the preview
address of each deployment, `dataleadweb-frontend.vercel.app`, and the other spelling of the
domain. On the vercel.app address the canonical read
`https://dataleadweb-frontend.vercel.app/lms/courses/...`, which is an invitation to Google to
index a second complete copy of the site.

A canonical's whole job is to name the one real address, so it can never be built from whichever
address the visitor happened to use. There is a test that sends a request with the vercel.app
host and fails if that string appears anywhere in the answer.

**The one exception, which is correct:** when an edge function fetches its own `index.html`, or
`og.js` fetches an image, it uses the host it is running on. A preview deployment has to read its
own files, not production's.

---

## 4. What each address answers

| Address | Status | In search | In the sitemap | Notes |
| --- | --- | --- | --- | --- |
| `/lms` | 200 | yes | yes | Title, description and canonical written at the edge. Headline and subhead from `lms_settings` |
| `/lms/courses` | 200 | yes | yes | The list of course links is in the HTML itself |
| `/lms/courses/<slug>` | 200 | yes | yes | Course and breadcrumb markup, share picture, last updated date |
| `/lms/courses?tool=stata` | 200 | no | no | Canonical points at `/lms/courses` |
| `/lms/courses/<a draft or wrong slug>` | **404** | no | no | A real 404, not a soft one. **Only when Supabase answered** |
| `/lms/courses/<any slug>` while Supabase is slow, down or paused | **200** | yes | n/a | The ordinary page, no `noindex`, cached for 30 seconds |
| `/lms/sign-up`, `/lms/sign-in`, `/lms/me` | 200 | no | no | `noindex`, as built in Phase 2 |
| `/lms/learn/...`, `/lms/studio/...` | 200 | no | no | `noindex`, and blocked in `robots.txt` |
| `/sitemap.xml` | 200 | n/a | n/a | Built from the database, so a new course appears at once |

### Why a draft course is a real 404

A "not found" page that answers 200 is called a soft 404, and it is worse than it sounds. A search
engine takes the 200 as "this address is real" and keeps it in the index for months, sometimes
showing it. A real 404 is dropped quickly.

### Why "we could not ask" is NOT a 404

This is the rule that matters most on this page, and it was wrong in the first version of
Phase 3.

The function that fetches a course returned nothing both when there was no such course and when
the call failed, and the handler treated nothing as not found. So a slow, down or paused Supabase
produced a 404 with `noindex` on it, for a course that exists.

**Our project is on the Supabase free plan, which pauses after a week without visitors.** One
quiet week and a crawl in the wrong moment would have told Google to drop every course in the
Academy. Falling out of an index takes a moment; getting back in takes months.

So the two are now told apart, and the rule is:

> **Answer 404 only when Supabase replied and said there is no such published course.**
> On any failure, serve the ordinary page: status 200, no `noindex`, and `s-maxage=30` with no
> `stale-while-revalidate`, so one bad minute is not served for a day.

React then loads and shows the course, or shows its own "we could not load this" message. Nothing
is said to anybody about the course not existing, because we do not know that it does not.

Four tests cover it, one for each way of failing, in `tests/academy-meta.test.mjs`:

| Test | What it does |
| --- | --- |
| slow | the fetch takes five seconds and is aborted by the timeout |
| down | the fetch throws, the way a dead host does |
| paused | Supabase answers 503 with an HTML body, the way a paused project does |
| missing | Supabase answers properly with no rows, and this one **must** be the 404 |

---

## 5. Titles and descriptions

| Where it comes from | Rule |
| --- | --- |
| `lms_courses.seo_title` | Used when somebody has written one. The database refuses anything over 60 characters |
| Otherwise | `Learn {title} Online \| Data-Lead Academy` |
| `lms_courses.seo_description` | Used when written. The database refuses anything over 155 |
| Otherwise | `{lessons} video lessons, {time}, at your own pace. {summary}` |

Both are cut at a word, never mid word, and nothing is added in place of what was cut: a sentence
that stops reads better than one that trails off.

Sixty and a hundred and fifty five are roughly what Google shows. Longer is not punished; it is
simply not read.

---

## 6. How the two copies are kept identical

The rules above are used in two languages: by the React page, in TypeScript, and by the edge
function, in JavaScript.

If they ever disagreed, the title would change under a crawler that does run JavaScript, somewhere
between the HTML arriving and React starting. That is worse than having no title at all, and nobody
would catch it by looking at the page.

So there is **one copy**, in `api/_seo-rules.js`, in plain JavaScript with no imports. Both sides
import it:

```
api/_seo-rules.js          the rules, the site address, and the fixed words
  -> api/_academy-data.js  re-exports them for the edge functions
  -> src/lib/courseSeo.ts  a typed doorway onto the same file
  -> src/lib/site.ts       the site address, for the React pages
```

What lives there:

| | |
| --- | --- |
| `SITE_ORIGIN`, `siteUrl`, `siteAsset` | the site's address, and the two ways of building one |
| `MAX_TITLE`, `MAX_DESCRIPTION`, `clip` | the lengths, and the cut-at-a-word rule |
| `courseTitle`, `courseDescription` | a course page's two lines |
| `LANDING`, `CATALOGUE`, `NOT_FOUND` | the fixed words of each page |
| `landingWords` | the landing page's words, from `lms_settings` or the fallbacks |
| `plural` | "1 lesson", not "1 lessons" |

The last three were added in the review round. The landing title and description had been
written out twice, once in the page and once in the edge function, as two separate constants
that happened to match. Nothing checked that they agreed.

`tests/seo-agreement.test.mjs` checks that neither side has quietly written its own copy, and tests
the rules against the awkward inputs: a title too long, no lessons, an empty summary, a hand
written title that is itself too long.

### Two helpers for an address, on purpose

`siteUrl` strips any query string, because a canonical with one in it splits one page into two.
`siteAsset` keeps it. They are separate because `siteUrl` was being used for the share picture
and was silently removing `?course=` from every one of them, so every course shared the generic
picture rather than its own.

### What the database may and may not change

`lms_settings` holds the landing page's `headline`, `subhead`, `announce_on` and `announce_text`,
so the Phase 6 control room can change the words without a deployment. If the row is missing or
blank, or Supabase cannot be reached, the words written in `LANDING` are used, and those are the
words that are on the page today, so a failure looks like no change at all.

**The `<title>` and the `<meta description>` deliberately do not come from the database.** They
are the two lines a search engine weighs most heavily, and a mistyped headline in a form should
not be able to move the Academy's front page down the results. They stay in the file, where a
review can see them. There is a test for this.

---

## 7. The structured data

`EducationalOrganization` on `/lms`, an `ItemList` of course addresses plus a `BreadcrumbList` on
`/lms/courses`, and a `Course` plus a `BreadcrumbList` on each course page. The breadcrumb markup
matches the trail a person reads at the top of the page, because one without the other is a
disagreement a search console reports.

### Exactly one of each, never two

Both sides write this: the edge function so a crawler that runs no JavaScript sees it, and the
React page so a crawler that does still sees it after React has replaced the page. Written
naively, a finished page carries **two** of each and a reader has no way to know which to
believe.

The edge marks its own with `data-edge="1"`. The `Seo` component removes anything carrying that
mark before adding its own, so it can tell the edge's copies from any other structured data on
the page and leave everything else alone.

**A Node test cannot see this**, because it only ever sees what the edge wrote; the duplicate
only exists once the page's JavaScript has run. So it is checked in a real browser, which loads
all three pages, counts the blocks before React and after, and fails if any page ends with more
than one of each or with any block still marked as the edge's.

**Google stopped showing course rich results in 2025**, so none of this earns a special box in a
Google result any more. It is here for the search engines that still read it and the AI assistants
that have started to. That makes accurate and small the whole brief:

- No ratings and no review counts. We do not collect either, and inventing them is the kind of
  thing that gets a site penalised.
- No `FAQPage`. Google retired that too, and it would be weight on the page for nothing.
- The price is real, in NGN, from `price_kobo`.
- `timeRequired` is the real total, as an ISO duration: 5760 seconds is `PT1H36M`.

---

## 8. The share picture

`/api/og?course=<slug>` draws a 1200 by 630 card with the course title and three facts: lessons,
length and price. Most links to a course will be shared in a WhatsApp group, and a link with no
picture is a grey box nobody taps.

It uses the Poppins already embedded in `api/og.js`, so it adds no fonts and no dependency. The
price is written `NGN 10,000` rather than with the naira sign, because that font is a subset built
for certificates and a character it does not carry would draw as a blank box in the one place
everybody looks.

---

## 9. robots.txt

Three folders are closed: `/lms/learn/`, `/lms/studio/` and `/staff/`. Everything else is open.

**Two things are deliberately NOT blocked**, and the file says so, so that nobody adds them later
thinking it was an oversight.

`/api/` stays open. The share pictures come from `/api/og`, and several link preview robots read
`robots.txt` before fetching a picture. Blocking `/api/` would mean a grey box in WhatsApp.

`/lms/sign-up`, `/lms/sign-in` and `/lms/me` stay open. They each carry a `noindex` tag, and a
crawler has to be allowed to fetch a page in order to read the tag telling it not to index that
page. Blocking them would mean the `noindex` is never seen, and the addresses could still be listed
from links elsewhere.

---

## 10. Internal links

A band on `/courses` links to `/lms/courses`. That page has the most links to it and the most
visitors of anything on the site, so a link from it is worth more to the Academy than anything the
Academy can do to itself.

**It hides itself when no course is published**, because a link to an empty catalogue is worse than
no link.

### Blog posts that should link to a course later

Not edited now, because there is no course to link to yet. When there is, one sentence in the body
of each, in the place it is already talking about the tool:

| Post | Link to |
| --- | --- |
| `excel-vs-power-bi-vs-python-which-tool-should-you-learn-first` | The Power BI and Python courses. This is the single best fit on the site |
| `sql-for-beginners-why-every-nigerian-graduate-should-learn-it` | The SQL course |
| `top-7-data-analytics-skills-employers-want-in-nigeria-2025` | The catalogue, where it lists tools |
| `from-beginner-to-analyst-12-weeks-to-a-data-career-in-abuja` | The catalogue, as the self paced alternative |
| `how-nysc-members-can-launch-a-career-in-data-analytics-during-service-year` | The catalogue |

A link inside a sentence that was going to be written anyway is worth several in a box at the
bottom. Resist adding a "related courses" block to every post.

---

## 11. Checking it yourself, after launch

### With View Page Source

**View Page Source is not Inspect Element.** Inspect shows what the browser built; View Page Source
shows what the server sent, which is what a crawler sees. That difference is the whole point of
this phase.

In Chrome: right click, View Page Source, or Ctrl+U.

| Page | What should be in the source |
| --- | --- |
| `/lms` | `<title>Data-Lead Academy: self paced data courses online</title>` |
| `/lms/courses` | Every course title, as a real `<a href="/lms/courses/...">` |
| A course page | The course title in `<title>`, and every module and lesson title in the body |
| Any of them | One `<link rel="canonical">`, pointing at the address you are on without any `?...` |
| The homepage | **No** canonical and **no** `og:url`. Those are set per page now |

### A draft course

Publish nothing, and open `/lms/courses/some-made-up-slug`. You should see "Course not found". To
confirm it is a real 404 rather than a page that merely says so: open the browser's developer
tools, go to the Network tab, reload, and look at the status of the first request. It should say
404.

### The sitemap

Open `/sitemap.xml`. Every public page should be listed, each published course should be there with
a `lastmod` date, and **nothing** under `/lms/sign-up`, `/lms/me` or `/staff/` should appear.

### The share picture

Paste a course address into a WhatsApp message to yourself. The card should show the course title
and three facts. If it does not appear at once, WhatsApp has cached the old grey box; add `?x=1` to
the address to make it fetch again.

### In Google Search Console, after launch

1. **URL Inspection** on `/lms/courses/<a real slug>`. Press "Test live URL", then "View tested
   page", then "HTML". The course title should be in it. This is Google telling you what it sees.
2. **Sitemaps**, add `sitemap.xml`. Come back in a few days and check Discovered is more than zero.
3. **Pages**, after a week or two. Look for "Excluded by noindex", which should contain the sign up
   and sign in pages and nothing surprising. Also look for "Duplicate, Google chose a different
   canonical", which is the symptom of the primary address in section 3 being set wrong.
4. **Page indexing**, after a month. The three public pages and each published course should be in
   "Indexed".

Do not expect anything in the first week. A new address usually takes days to be crawled and longer
to be indexed, and nothing you do speeds that up except links from pages Google already knows,
which is what section 10 is for.
