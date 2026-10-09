# FRONTEND-MAP.md

A map of what exists before any Academy page is built. **Nothing was changed to produce this.** No
code, no files, no branches, no database rows, no settings.

Everything here was read from the actual `main` branch of
`github.com/DataLeadAfrica/DataLeadWeb-frontend` at commit `e4367d8`, and from the actual database
built from files 01 to 07, 10, 11 and 12. Where I checked a fact against Supabase's documentation
rather than memory, I say so.

Plain words throughout. There is a glossary at the end.

---

# 1. WHAT EXISTS ON THE WEBSITE TODAY

## 1.1 How the site is put together

It is a **single page app**. One HTML file, `index.html`, is sent for every address, and React
decides what to draw once it is running in the browser. That one fact shapes everything in the SEO
section later, because a search engine arriving at a page sees the same empty shell every time
unless something intervenes.

- **Build**: `npm run build` runs `tsc -b && vite build`. TypeScript runs **first**, and
  `tsconfig.app.json` has `strict`, `noUnusedLocals` and `noUnusedParameters` all on. An unused
  import is a **build failure**, not a warning. This is the single most common way a pasted change
  turns the Vercel preview red.
- **No path shortcuts.** `vite.config.ts` defines no aliases, so every import is relative:
  `../../pages/routes`, `./page.css`. Deep pages carry long `../../../` chains.
- **Hosting**: Vercel, configured by `vercel.json`.
- **A second, stale deploy exists.** `.github/workflows/react-deploy.yml` still builds on every push
  to `main` and publishes to GitHub Pages. It ignores `vercel.json` entirely, so that copy has none
  of the rewrites. It is not what visitors see, but it is running.

## 1.2 Every route, and the file that serves it

Routes are declared in `src/pages/routes.ts` and mounted in `src/main.tsx`, which pulls in six
smaller routers.

| Route | File | What it does |
| --- | --- | --- |
| `/` | `src/pages/Index/page.tsx` | Home page |
| `/who-we-are` | `src/pages/WhoWeAre/page.tsx` | About |
| `/contact-us` | `src/pages/ContactUs/page.tsx` | Contact |
| `/privacy-policy` | `src/pages/PrivacyPolicy/page.tsx` | Privacy |
| `/studio` | `src/pages/Studio/Studio.tsx` | Blog editor for staff |
| `/our-team` and 13 person pages | `src/pages/OurTeam/router.tsx` | Team |
| `/blog` and 8 post pages | `src/pages/Blog/router.tsx` | Blog |
| `/research` and 7 study pages | `src/pages/Research/router.tsx` | Research |
| `/courses` and 13 course pages | `src/pages/Courses/router.tsx` | The marketing course pages |
| `/consultancy`, `/training` | `src/pages/Consultancy/router.tsx` | Services |
| `/courses/data-analytics/payment-success` and similar | `src/pages/Success/router.tsx` | After payment |
| `/certifications` | `src/pages/Certifications/page.tsx` | Certifications overview |
| `/my-certificate` | `src/pages/Certificates/Claim/page.tsx` | Claim your certificate |
| `/certificate/:number` | `src/pages/Certificates/Showcase/page.tsx` | Public shareable certificate |
| `/verify/:number` | `src/pages/Certificates/Verify/page.tsx` | Public verification |
| `/staff/certificates` | `src/pages/Certificates/Staff/page.tsx` | Issue certificates by hand |
| `/sign-in` | `src/pages/Learning/Login/page.tsx` | Bootcamp portal sign in |
| `/my-learning` | `src/pages/Learning/Dashboard/page.tsx` | Bootcamp progress |
| `/my-learning/:slug` | `src/pages/Learning/Assessment/page.tsx` | Sit a section assessment |
| `/staff/portal` | `src/pages/Learning/Staff/page.tsx` | Enrol and manage participants |
| anything else | `src/pages/NotFound/page.tsx` | Not found |

**`/lms` does not exist.** Nothing in `routes.ts` mentions it. Every Academy page is new.

Two directories exist but are **not routed**: `src/pages/ComingSoon/` and `src/pages/Plan/`. And
`routes.careers` is defined but points at a static folder in `public/careers/`, not at a React page.

## 1.3 The shared pieces we must reuse

All components live at `src/components/<Name>/component.tsx`, with `component.css` beside them.

| Component | What it gives us |
| --- | --- |
| `Header/` | The fixed site header, 5rem tall, plus a `.header__spacer` that pushes content down. **A new page must not add its own top offset.** |
| `Footer/` | Footer and the floating WhatsApp button |
| `Seo/` | Sets the page title, description, canonical link, optional `noindex`, optional structured data |
| `ScrollToTop/` | Scrolls to the top on every route change |
| `CallToAction/` | A gradient panel: `{ heading: string; btns: ReactElement[] }` |
| `LeadForm/`, `EnrolForm/` | Modal forms for brochures and bootcamp enrolment |
| `Partners/`, `TrainingGallery/`, `GizStrip/` | Marketing strips |

**There are no generic Button, Input, Card, Tab or Modal components.** Buttons are the global `.btn`
class in `src/global.css`. Everything else is written per page in that page's own `page.css`. The
Academy will need its own small set, which is the normal pattern here, not a departure from it.

**Header and Footer render on every single route**, because they sit outside `<Routes>` in
`src/main.tsx`. That includes `/sign-in`, `/my-learning` and `/staff/portal`. The Academy pages will
get them too unless we deliberately change that.

## 1.4 The look: colours and fonts

`src/global.css` holds one `:root` block. The ones that matter:

```css
--clr-orange: #f56e0f;        --clr-orange-medium: #f9a971;
--clr-orange-light: #fde9da;  --clr-blue: #e7f5fe;
--clr-gray: #2c2b2d;          --clr-gray-light: #dae2e7;
--radius-1: 4px; --radius-2: 8px; --radius-3: 12px; --radius-4: 16px; --radius-5: 20px;
--padding-1: 1rem; --padding-2: 2rem; --padding-3: 3rem;
--font-xs: 1rem; --font-sm: 1.25rem; --font-md: 1.562rem; --font-lg: 1.938rem;
```

**Fonts**: Poppins for body text, loaded from Google Fonts. ClashDisplay for headings, self hosted
from `public/fonts/clash-display/`. Nerd Fonts for the icons in the header and footer, loaded from
`nerdfonts.com`.

**Dark mode is deliberately switched off.** The dark block in `global.css` repeats the light values
with the real ones commented out. New pages should not try to support it.

**One thing to be careful of.** `src/pages/Learning/portal.css` defines a *second* `:root` block
with its own names (`--paper`, `--orange`, `--txt`) and sets `body { background: var(--paper) }`.
Because Vite bundles all CSS together, those rules apply site wide once any portal page has loaded.
The Academy should either reuse that theme deliberately or define its own scoped one, and not
assume `global.css` is the only source of truth.

## 1.5 How pages talk to Supabase today

**Two clients, two projects, both with their keys written into committed files.**

| Client | File | Project | Used for |
| --- | --- | --- | --- |
| `supabase` | `src/lib/supabase.ts` | `ssxqlpaioozqopelssqd` | The blog and Studio |
| `certDb` | `src/lib/certificates.ts` | `zndjhvcqrgusorflnkxd` | Certificates, the bootcamp portal, and the Academy |

The Academy lives in the second one, so Academy pages will use `certDb`. There are no environment
variables anywhere; the keys are string literals. That is by design and it is safe for these keys,
because they are the publishable kind and row level security is what actually protects the data.

**The twenty two database functions the site calls today**, and none of them begins with `lms_`:

`verify_certificate`, `verify_certificate_code`, `request_certificate_code`, `participant_login`,
`participant_logout`, `participant_session_ok`, `participant_dashboard`, `module_start_attempt`,
`module_submit_attempt`, `staff_login`, `staff_logout`, `staff_programmes`, `staff_modules`,
`staff_recent_certificates`, `staff_enrol_participant`, `staff_set_enrolment_status`,
`staff_issue_certificate`, `staff_revoke_certificate`, `staff_restore_certificate`,
`staff_reopen_module`, `staff_rename_participant`, `get_readership`.

## 1.6 Branches, and whether the file 12 changes are merged

```
main                      the live site
origin/feature/certification   a branch, not merged
```

**The file 12 frontend changes are NOT merged and NOT on main.** I checked by searching the whole of
`src/` for the names they introduce:

| Name | Found in `src/`? |
| --- | --- |
| `request_sign_in_code` | No |
| `send_email_hook` | No |
| `mail_limits` | No |
| `system_health` | No |
| anything starting `lms_` | No |

So the live site still calls `request_certificate_code`, which still works, because file 12
deliberately kept that name as a wrapper. Nothing is broken. The four changed files are waiting in
the zip to be uploaded on branch `lms-file-12-applied`.

**`feature/certification` should be treated as suspect.** It does not contain the live learning
portal. Diff it before merging it into anything.

---

# 2. THE OLD PORTAL, IN PLAIN WORDS

There are **two separate sign in systems on the site today**, and neither is Supabase Auth.

## 2.1 The participant portal

**`/sign-in`.** You type your email address. The site asks the database for a code, the database
puts a six digit code in the outbox, the Apps Script mailer posts it, and you type it in. If it
matches, the database hands back a long random token which the page keeps in the browser's
`localStorage` under `dla_learner_token`. There is no password anywhere.

Calls: `request_certificate_code(p_email)` then `participant_login(p_email, p_code)`.

**`/my-learning`.** Your list of sections. Each shows your best score, how many attempts you have
used, the pass mark, and either a link to your certificate or a link to sit the assessment.

Calls: `participant_dashboard(p_token)`, and `participant_session_ok(p_token)` when the first
returns nothing, so an empty enrolment is not mistaken for being signed out.

**`/my-learning/:slug`.** Sitting one assessment. The questions come from the database with **no
answer key attached**, the page shuffles them, and marking happens on the server. It warns you if
you try to close the tab part way through.

Calls: `module_start_attempt(p_token, p_module_slug)`, `module_submit_attempt(p_token, p_attempt,
p_answers)`.

## 2.2 The staff portals

There are **two** of them and they share one passcode. Not an email and password: a single shared
passcode typed into the page, exchanged for a token kept in `sessionStorage` under
`dla_staff_token`. Signing in to one signs you in to the other.

**`/staff/portal`** enrols participants, withdraws them, reopens a section for a resit, fixes a
name, and revokes or restores certificates.

**`/staff/certificates`** issues a certificate by hand and revokes or restores from a recent list.

Both call `staff_login(p_passcode)` first.

## 2.3 The certificate pages

**`/my-certificate`** is the graduate's own page: email, then a six digit code, then every
certificate on that address drawn onto a canvas, with download, print and share buttons. Calls
`request_certificate_code` then `verify_certificate_code(p_email, p_code)`.

**`/certificate/:number`** is the public shareable page, with a QR code pointing at the verify page.
**`/verify/:number`** is the plain public check: valid, revoked or not found. Both call
`verify_certificate(p_number)`.

**This matters for the Academy.** The certificate claim page gates on *holding a certificate*, so
its reply must stay vague: an honest answer there would tell a stranger who has graduated. File 12
already handles this, and it is why `request_certificate_code` kept its name and its yes-or-no
answer.

---

# 3. THE ACADEMY DATABASE, AS THE PAGES WILL SEE IT

Fifty `lms_` functions exist, one view, and twenty tables. Most of the functions are internal
guards and triggers. **These are the ones a page will actually call**, grouped by screen.

A note on the shape: most return a **table of one row**, so in JavaScript the answer arrives as an
array and the page reads `data[0]`. The existing `learning.ts` already does this with
`Array.isArray(data) ? data[0] : data`.

## 3.1 Landing and catalogue

> **Updated 8 October 2026, after database file 14.** The rows below marked with a warning are
> what this section said before file 14, and they are **no longer how the pages read anything**.
> They are kept so the change is visible rather than silent. The Phase 3 pages were built on the
> new rows.

| What the page needs | How | Returns |
| --- | --- | --- |
| The landing words | `select headline, subhead, announce_on, announce_text from lms_settings where id = 1` | the four landing fields. **Named columns, not `*`**, so a column added later is not handed out by accident |
| The welcome video | `lms_settings.welcome_provider`, `welcome_ref`, `welcome_seconds` | Phase 4. Not read by any page today |
| The catalogue | `lms_public_catalogue()` | id, slug, title, summary, tool, area, level, cover_code, price_kobo, first_module_free, published_at, updated_at, module_count, lesson_count, quiz_count, total_seconds |
| One course, in full | `lms_public_course(p_slug text)` | everything above, plus outcomes, audience, prerequisites, faq, seo_title, seo_description, and the modules with their lesson lists |
| Learning paths | `select ... from lms_paths where status = 'published'`, with `lms_path_courses(position, lms_courses(...))` nested | each path and its published courses in order |
| ~~The catalogue~~ | ~~`select * from lms_course_cards`~~ | **Do not.** The view existed but ran with its creator's rights, so a signed out visitor could read **draft** courses through it. File 14 set `security_invoker = true`, which fixed that, but the two functions above are what the pages use: they return the counts and nothing else, and the edge function uses the same two, so a crawler and a person cannot be shown different numbers |

`p_settings_public` lets everyone read `lms_settings`, and the two functions above are granted to
`anon` and `authenticated`. The counts and total length are **counted live** from the rows, so
they can never disagree with reality.

## 3.2 Course page

| Need | How |
| --- | --- |
| Everything the page shows | `lms_public_course(p_slug text)`. One call. Published courses only |
| May I open this course? | `lms_has_course_access(p_course uuid) -> boolean` |
| How far am I? | `lms_course_progress(p_course uuid) -> numeric` |
| ~~The course~~ | ~~`select * from lms_courses where slug = ?`~~ Use the function |
| ~~Its modules~~ | ~~`select * from lms_modules where course_id = ?`~~ Use the function |
| ~~Its lessons~~ | ~~`select * from lms_lessons where module_id in (...)`~~ **Never. See below** |

### Nothing may select from lms_lessons

Before file 14 the whole table was granted to `anon` and `authenticated`, every column. One of
those columns is `video_ref`, the YouTube id. An older comment said that was harmless because
the player checks whether you are allowed to watch; that is true of the player and completely
untrue of YouTube. An unlisted video is not a private one: paste the id after
`youtube.com/watch?v=` and it plays, for anybody, for ever.

A stranger with nothing but the site's public key could ask once and get the id of every paid
video in the Academy. It was measured, not guessed: three video ids and three lesson bodies came
straight back, to a signed out stranger and to somebody signed in who had paid for nothing.

File 14 replaced the table grant with a **column** grant: the titles, lengths and positions a
shop window needs stay public, and `video_ref` and `content_md` are unreadable through the table
by anybody. Doing it by column also fails safely, because a column somebody adds next year is
not given away until a person decides to give it away.

**So no client code may use `select('*')` on `lms_lessons`.** The two ways to reach a video:

| Who | Function |
| --- | --- |
| A learner | `lms_open_lesson(p_lesson uuid)`. Asks "is this lesson open to you" first, and returns nothing if the answer is no. This is what the Phase 4 player calls |
| Staff | `lms_staff_lesson(p_lesson uuid)`, which returns a draft lesson whole |

There is a test, file 14 test 15, that reads the column names of every public function and fails
if one ever looks like a video reference or a lesson body.

Modules and lessons remain visible to a signed out visitor **only for a published course**, and
only through `lms_public_course`, which is what lets the course page show its contents list to
somebody not signed in.

## 3.3 Lesson player

| Need | Function | Returns |
| --- | --- | --- |
| Is this lesson open to me? | `lms_lesson_is_open(p_lesson uuid)` | boolean |
| Is it unlocked by progress? | `lms_is_lesson_unlocked(p_lesson uuid)` | boolean |
| Record ten seconds watched | `lms_record_watch(p_lesson uuid, p_bucket integer, p_position integer)` | `coverage numeric, unlocked boolean` |
| How much have I watched? | `lms_watch_coverage(p_lesson uuid)` | numeric |
| Mark it finished | `lms_complete_lesson(p_lesson uuid)` | `completed boolean, reason text` |

**How the non skippable rule actually works.** The video is cut into ten second slices. As the
YouTube player passes through slice 7, the page calls `lms_record_watch(lesson, 7, position)`. The
**server** writes that slice down, so dragging the progress bar forward fills nothing. The lesson
counts as watched when coverage passes the lesson's `coverage_percent`, which defaults to 92.

Two things the page author must know, both learned the hard way in testing:

- **`lms_record_watch` throttles on purpose.** It accepts roughly `(60 / bucket_seconds) + 3` calls
  in a burst. A page that fires every slice at once will find about ten recorded out of twelve. Call
  it as the video actually plays, not in a loop.
- `lms_lesson_progress.last_position_seconds` is where the player resumes from, and it survives the
  housekeeping that deletes the slices, so resume still works after a lesson is complete.

## 3.4 Lesson check and module quiz

Both use the same three functions. The difference is which column the quiz hangs off:
`lms_quizzes.lesson_id` makes it a lesson check, `lms_quizzes.module_id` makes it a module quiz.

| Need | Function | Returns |
| --- | --- | --- |
| Which kind is this? | `lms_quiz_kind(p_quiz uuid)` | text |
| Start | `lms_start_quiz(p_quiz uuid)` | `attempt_id, question_id, prompt, qtype, marks, option_id, option_label, option_position` |
| Submit | `lms_submit_quiz(p_attempt uuid, p_answers jsonb)` | `kind, correct_count, question_count, score, max_score, percent, passed, pass_mark, feedback` |
| See what I got wrong | `lms_attempt_marks(p_attempt uuid)` | `question_id, prompt, was_right, explanation` |

`lms_start_quiz` returns **one row per option**, not per question, so the page has to group them.
The existing assessment page does exactly this and is the model to copy.

**The answer key never leaves the server.** `option_label` is the text; nothing says which is right.
Marking happens inside `lms_submit_quiz`.

A lesson check reports counts only and never a score. A module quiz has `pass_percent`, default 70,
and `max_attempts`, default 3.

## 3.5 Progress, resume and access

| Need | Function | Returns |
| --- | --- | --- |
| Refresh my access on every page open | `lms_sync_my_access()` | `role text, bootcamp boolean, changed boolean, message text` |
| Claim bootcamp access | `lms_claim_bootcamp_access()` | `granted boolean, message text` |
| Give me the free courses | `lms_grant_free_courses(p_user uuid)` | integer |
| What am I? | `lms_my_role()` | `learner`, `facilitator` or `admin` |

`lms_sync_my_access()` is the one to call after every sign in and on every page open. It re-checks
the two email lists in both directions, so somebody taken off a cohort loses access and somebody
newly added gains it. It returns a sentence meant to be shown to the person.

## 3.6 Staff control room

| Need | Function | Returns |
| --- | --- | --- |
| May I edit? | `lms_can_edit()` | boolean |
| Am I staff? | `lms_is_staff()` | boolean |
| Am I the administrator? | `lms_is_admin()` | boolean |
| What is stopping this course publishing? | `lms_course_blockers(p_course uuid)` | `ok boolean, label text`, one row per item |
| Publish | `lms_publish_course(p_course uuid)` | `published boolean, message text` |
| Unpublish | `lms_unpublish_course(p_course uuid)` | boolean |
| Make a quiz | `lms_create_quiz(p_lesson uuid, p_module uuid, p_title text)` | uuid |
| Import questions | `lms_import_questions(p_quiz uuid, p_items jsonb)` | `imported integer, message text` |
| Add a facilitator | `lms_add_facilitator(p_email, p_name, p_note)` | `ok boolean, message text` |
| Remove a facilitator | `lms_remove_facilitator(p_email)` | `ok boolean, message text` |
| Storage | `lms_storage_report()` | one row per table plus a total |

**`lms_course_blockers` is the function the control room should lean on hardest.** It returns the
publish checklist as rows, each with a yes or no and a human sentence, so the page can show a tick
list rather than a single unhelpful refusal.

**Facilitators build, only the administrator publishes.** Seven guard triggers enforce this at the
database level, so the page does not have to be the only thing standing in the way. The page should
still hide what it knows will be refused, because a refusal the user could have been spared is a
poor experience.

**Importing questions never deletes.** It retires the old ones with `active = false` and numbers the
new ones above the highest position in use, so a learner part way through an attempt is unaffected.

---

# 4. GAPS

These are the things the pages will need that the database does not yet provide, or where a setting
has to be made to match a promise we have already put in writing.

## 4.1 Nothing fills in a lesson's video length

`lms_lessons.duration_seconds` is **nullable and nothing sets it**. The non skippable rule needs it,
because coverage is a percentage of the total.

YouTube does not tell a web page how long an unlisted video is without the YouTube Data API, which
needs an API key, which means a new secret and a new dependency. Three honest options:

1. **The facilitator types it in.** A box in the control room, one number per lesson, and
   `lms_course_blockers` refuses to publish while any video lesson has no length. Simple, no new
   dependency, relies on a human getting it roughly right.
2. **The player fills it in on first load.** The YouTube embed knows its own duration once playing;
   the page writes it back once. Free and automatic, but the first person to open the lesson is
   doing the measuring, and the lesson would have to be publishable without it.
3. **The YouTube Data API.** Accurate and automatic. Needs a key, and this project has no
   environment variables.

**My recommendation is 1 plus 2**: a typed box that the player quietly corrects on first play. The
blocker keeps the discipline, the correction removes the error.

**This is an open question for you, not a decision I have made.**

## 4.2 Nothing issues a certificate when an Academy course is finished

`lms_course_progress` tells you how far along somebody is. Nothing turns 100 percent into a
certificate.

The certification side has `staff_issue_certificate`, but that is gated behind the staff passcode
and is meant for a human issuing by hand. An Academy learner finishing a course at midnight should
not have to wait for somebody to notice.

What is missing is one function, something like `lms_claim_course_certificate(p_course uuid)`, that
checks every lesson is complete and every module quiz passed, then writes the certificate row using
the course's existing `programme_id` so the numbering and the `/verify/:number` page keep working
with no change. **That is a file 13, and it does not exist yet.**

## 4.3 Supabase Auth settings that must match the emails we already wrote

The emails say **"The code expires in 10 minutes."** For the bootcamp codes that is true: the
database sets `expires_at = now() + interval '10 minutes'`.

**For the Academy codes it is currently false.** Those codes are made by Supabase Auth, and
Supabase's documentation says the email OTP expires after **1 hour by default**, configurable at
Authentication, then Sign In / Providers, then Email, then **Email OTP expiration**. Either set it
to 600 seconds or change the wording. I would set it to 600: a short lived code is better, and the
email is already written.

The same page notes a user can only request a code **once every 60 seconds**, which the sign up page
needs to respect in its "send another" button or people will tap it and see an error.

The full list of settings that must be right:

| Setting | Where | Must be |
| --- | --- | --- |
| Email OTP expiration | Auth, Sign In / Providers, Email | 600 seconds, to match the emails |
| Confirm email | Auth, Sign In / Providers, Email | **On.** Every right hangs on a proven address |
| Send Email hook | Auth, Hooks | On, Postgres function, `public.send_email_hook`. **Already done** |
| Email rate limit | Auth, Rate Limits | 150 an hour |
| Site URL | Auth, URL Configuration | `https://www.dataleadafrica.com` |
| Redirect URLs | Auth, URL Configuration | both `www` and bare domain with `/**` |

## 4.4 Smaller gaps worth naming now

- **No function returns a course with its modules and lessons in one call.** The course page will
  make three reads. That is fine and it is what the policies allow, but it is worth knowing it is
  three round trips rather than one.
- **Nothing links an Academy account to a participant record** except by confirmed email.
  `lms_link_participant(p_user, p_email)` exists for this, and it is only as good as people using
  the same address in both places. Somebody who enrolled with a work address and signs up with a
  personal one will not get their free access, and will have no idea why.
- **Paystack is not started.** `lms_orders` and `lms_payment_events` exist and are empty. Every
  paid course is unbuyable until that is built.
- **The daily email allowance is 100**, measured today. That covers every email the whole site
  sends. It is enough for testing and not enough for a launch.

---

# 5. THE PAGE PLAN

No code. Routes, what each screen is for, what it reuses, and where it goes next.

Everything follows the house rules: plain CSS, one `.css` file per component, no Tailwind, no new
dependencies without your approval, British English, short pages, and no photographs of identifiable
people.

## 5.1 The learner

| Route | Screen | Reuses | Goes to |
| --- | --- | --- | --- |
| `/lms` | Landing. Headline, subhead and announcement from `lms_settings`, the tool rack, Latest courses, Learning paths, the certificate check and the FAQ. The welcome video is Phase 4 | `Seo`, `AcadStage`, `ToolRack`, `CourseCard`, `Faq` | a course, or sign up |
| `/lms/courses` | Catalogue. Every published course as a card with tool, level, length and price | `Seo`, new `CourseCard` | a course |
| `/lms/courses/:slug` | Course page. What it is, what is in it, how long, the price or the word Free, and a contents list | `Seo` with Course structured data | sign up, or the first lesson |
| `/lms/learn/:slug` | My course. The modules and lessons with locks, ticks and a resume button | new `LessonList` | a lesson |
| `/lms/learn/:slug/:lesson` | **The lesson player.** YouTube embed, the coverage bar, and the lesson check underneath once the video is done | new `Player`, `QuizCard` | the next lesson |
| `/lms/learn/:slug/quiz/:quiz` | Module quiz. Pass mark and attempts shown before starting | `QuizCard` | back to the course |
| `/lms/me` | My learning. Every course I can open, how far through, and my certificates | new `ProgressBar` | a course |
| `/lms/sign-up` | Create an account. Email, password, then the six digit code | new `CodeBoxes` | `/lms/me` |
| `/lms/sign-in` | Sign in | `CodeBoxes` | where they were going |
| `/lms/reset` | Forgot password. Email, code, new password | `CodeBoxes` | `/lms/sign-in` |

**The lesson player is the hard screen and the one to build first after sign in.** Everything else is
a list or a form. It is the only place where the YouTube player, the ten second slices, the coverage
bar and the unlock rule all have to agree with each other.

## 5.2 The facilitator and the administrator

| Route | Screen | Who |
| --- | --- | --- |
| `/lms/studio` | Control room home: my courses, what is draft, what is live, what is blocked | both |
| `/lms/studio/course/:id` | Build a course: modules, lessons, videos, the publish checklist from `lms_course_blockers` | both, publish button administrator only |
| `/lms/studio/quiz/:id` | Build a quiz: questions, options, import | both |
| `/lms/studio/people` | Facilitators and administrators | administrator only |
| `/lms/studio/health` | The health check rows, the storage report, the email counters | administrator only |

**The publish button should be visible to a facilitator and disabled, with the reason beside it.**
Hiding it makes the rule invisible and people ask why nothing happens. Showing it greyed, next to
"Only the administrator can publish", teaches the rule once.

## 5.3 How a learner moves through

```
/lms  ->  /lms/courses  ->  /lms/courses/:slug
                                   |
                    not signed in  |  signed in and allowed
                                   v
                           /lms/sign-up  ->  code  ->  /lms/me
                                   |
                                   v
                  /lms/learn/:slug  ->  lesson  ->  check  ->  next lesson
                                   |
                            last lesson passed
                                   v
                           certificate at /certificate/:number
```

The last arrow is the one that does not exist yet. See gap 4.2.

## 5.4 Components to build, and roughly in what order

1. `CourseCard`, used on the landing page and the catalogue
2. `CodeBoxes`, the six digit entry, already written twice on this site. Copy the one in
   `Certificates/Claim/page.css` (`.claim__otpbox`) rather than inventing a third
3. `ProgressBar`, course and lesson progress
4. `LessonList`, the contents list with locks and ticks
5. `Player`, the YouTube embed plus the coverage reporting
6. `QuizCard`, used for both the lesson check and the module quiz

Six new components. Everything else is page level CSS, which is the convention here.

---

# 6. SEO PLAN

## 6.1 Public and private

| Public, must be found | Private, must carry `noindex` |
| --- | --- |
| `/lms` | every `/lms/learn/...` page |
| `/lms/courses` | `/lms/me` |
| `/lms/courses/:slug` | `/lms/sign-up`, `/lms/sign-in`, `/lms/reset` |
| | every `/lms/studio/...` page |

The `Seo` component already takes `noindex`, and the existing `/sign-in` page uses it. Copy that.

## 6.2 The single page app problem, and the pattern that solves it

A search engine or a WhatsApp preview asking for `/lms/courses/stata` gets `index.html`, which
carries the home page's title and description. Every Academy page would share one title.

**The site already solves this once**, for `/certificate/:number`, and that is the pattern to copy.
`vercel.json` rewrites that address to `api/certificate-meta.js`, an edge function which:

1. looks the certificate up in Supabase over the REST interface,
2. fetches the deployed `index.html`,
3. strips the site-wide `<title>`, description, canonical, `og:` and `twitter:` tags,
4. injects its own, and
5. returns the HTML, so React still boots normally for a human visitor.

A new `api/course-meta.js` doing the same for `/lms/courses/:slug` is roughly eighty lines, needs no
new dependency, and reads the published course straight from `lms_course_cards`.

**One thing it does not do today, and the Academy needs.** `certificate-meta.js` injects **no
structured data at all**. For a course page we want `Course` structured data so Google can show it
as a course. Two ways, and they are not equivalent:

- Put it in the React page with `<Seo jsonLd={...} />`. Easy, and Google does execute JavaScript, so
  it usually works.
- Put it in `api/course-meta.js` with the rest of the tags. Harder, and it is there on the very
  first response for every crawler, including those that do not run JavaScript.

**I would do both:** the edge function for crawlers, the `Seo` prop for correctness in the page. They
do not conflict as long as only one emits the script tag. Put it in the edge function and leave the
`jsonLd` prop unused on those three pages.

## 6.3 robots.txt and sitemap.xml

**Neither file exists.** I checked `public/` and there is nothing. The site has a Google Search
Console verification token in `index.html`, so somebody set up Search Console without ever adding a
sitemap.

Both should be added with this work:

`public/robots.txt`
```
User-agent: *
Allow: /
Disallow: /lms/learn/
Disallow: /lms/studio/
Disallow: /lms/me
Disallow: /staff/
Disallow: /my-learning
Sitemap: https://www.dataleadafrica.com/sitemap.xml
```

`public/sitemap.xml` listing the public marketing pages plus `/lms`, `/lms/courses`, and one entry
per published course.

**A sitemap that lists courses has to be generated, not typed**, or it goes stale the first time a
course is published. The simplest version that cannot rot is another small edge function at
`/sitemap.xml` that reads `lms_course_cards`. That is a decision for you; a typed file is fine to
start with if we accept updating it by hand.

---

# 7. ONE LOGIN DECISION

Today there are two sign in systems: the bootcamp portal uses an emailed code with a bespoke token,
and the Academy is designed for Supabase Auth with a password. Leaving both means two sign in pages,
two session mechanisms and two places to be signed out of.

**Option A. Leave them separate.** The Academy uses Supabase Auth with a password; the bootcamp
portal keeps its code. Nothing to migrate, and the smallest amount of work now. The cost is that one
person with one email address has two accounts on one website, and can be signed in to one and not
the other, which is confusing to explain and worse to support.

**Option B. Move everything to Supabase Auth with a password.** One account, one session, one sign
out. The cost falls on existing bootcamp participants, who have never had a password and would all
have to set one, and on us, because `/sign-in`, `/my-learning` and `/my-learning/:slug` would all
have to be rewritten against a different session mechanism.

**Option C. One Supabase Auth account, two ways in: a password or an emailed code.** Supabase
supports both against the same account natively. New Academy learners set a password. Existing
bootcamp participants carry on typing a code, exactly as they do now, and never notice the change.
The cost is that the bootcamp portal's three pages still have to be rewritten onto Supabase Auth, and
the Academy's sign in page carries two routes in rather than one.

**My recommendation, in three sentences.** Take option C. It gives one account per person and one
place to sign out, which is what makes the staff portal and the certificates and the Academy feel
like one website rather than three, and it is the only option that does not force every existing
participant to invent a password before they can get back in. The extra work over option B is small,
because the code route is a setting on the same Supabase Auth call rather than a second system.

**Not building anything for this.** Your decision.

---

# 8. THE TEST PLAN, WITH ONE UNLISTED YOUTUBE VIDEO

## 8.1 Making the first administrator

Nothing in the website can make somebody an administrator. That is deliberate: if the website could,
that would be the way in. It is also the recovery route if everything else fails.

1. **Create the account properly.** In the Supabase dashboard, Authentication, then Users, then
   **Add user**, and tick **Auto Confirm User**. Use your own address. Auto confirming matters
   because the trigger that makes a profile fires on the account being created, and the access rules
   need a *confirmed* address.
2. **The break glass statement.** In the SQL editor:

```sql
update lms_profiles set role = 'admin'
 where id = (select id from auth.users where email = 'you@dataleadafrica.com');
```

3. **Check it took:**

```sql
select lms_my_role();
```

It must say `admin`. If it says `learner`, the email did not match exactly.

## 8.2 The three test accounts

| Account | How to make it | What it should prove |
| --- | --- | --- |
| Bootcamp participant | An address that is on `participants` with an **active** row in `participant_enrolments`. Use `/staff/portal` to enrol them, which is the real route | Gets the whole catalogue free |
| Member of the public | Just sign up on the site with an outside Gmail address | Sees paid courses locked |
| Facilitator | As the administrator: `select * from lms_add_facilitator('tutor@dataleadafrica.com','Test Tutor','testing');` then that person signs up | Can build, cannot publish |

Use **outside Gmail addresses**, not addresses on dataleadafrica.com. Mail between two accounts on
one domain often never leaves Google, so it proves nothing about whether real email arrives.

## 8.3 Building the test course

As the administrator, in the SQL editor until the control room exists. The order matters, because
file 11 forbids publishing anything with an empty quiz.

1. Make a course as a **draft**, with `price_kobo = 0` to start.
2. Add one module.
3. Add one video lesson: `video_provider = 'youtube'`, `video_ref` set to the unlisted video's id,
   `duration_seconds` set to its real length in seconds, `bucket_seconds = 10`,
   `coverage_percent = 92`.
4. Make the lesson check: `select lms_create_quiz('<lesson id>', null, 'Check');` then import at
   least one question.
5. Make the module quiz: `select lms_create_quiz(null, '<module id>', 'Module quiz');` then import
   at least three.
6. **Ask what is stopping it**, before trying: `select * from lms_course_blockers('<course id>');`
   Every row should say ok.
7. Publish: `select * from lms_publish_course('<course id>');`

**The order is fixed: draft, then questions, then publish.** You cannot create a live quiz and fill
it in afterwards.

## 8.4 The checklist that proves it works

Accounts and email:

- [ ] Sign up with an outside Gmail address. The code arrives within two minutes.
- [ ] **Check the spam folder before deciding it failed.**
- [ ] The email is worded as a sign up confirmation, not as a certificate code.
- [ ] The code is refused after it expires, and a fresh one works.
- [ ] Sign in with the password.
- [ ] Reset the password. The new one works and the old one is refused.
- [ ] On the bootcamp portal, request a code for an address that is **not** enrolled. The page says
      exactly the same thing as for an enrolled one, and no email arrives.

Access:

- [ ] The bootcamp participant sees the test course as free and can open it.
- [ ] The member of the public sees it locked, or priced if it has a price.
- [ ] Set the enrolment to withdrawn, then sign in again as that participant. Access is gone.
- [ ] Set it back to active. Access returns.

The video and the unlock rule:

- [ ] Drag the progress bar to the end. The lesson does **not** count as watched.
- [ ] Watch it properly. The coverage bar fills as it plays.
- [ ] The next lesson stays shut until coverage passes the threshold **and** the check is passed.
- [ ] Leave half way, come back, and the player resumes where you stopped.

Quizzes:

- [ ] The lesson check reports counts only and never a score.
- [ ] The module quiz shows its pass mark and attempts before you start.
- [ ] Fail it. The attempt count goes up.
- [ ] Use up every attempt. It refuses a fourth.
- [ ] Open the browser's developer tools on a question. **No answer key is anywhere in the page.**

Staff rules:

- [ ] As the facilitator, create a lesson. It works.
- [ ] As the facilitator, try to publish. It is refused.
- [ ] As the facilitator, try to change the price. It is refused.
- [ ] As the administrator, publish. It works.

The certificate:

- [ ] Finish every lesson and pass the module quiz. **This is where gap 4.2 bites**: there is no
      function to issue the certificate yet, so this step will fail until file 13 exists. Note it
      and move on.
- [ ] Once file 13 exists, the certificate appears and `/verify/:number` says valid.

## 8.5 Removing the test data afterwards

This is more delicate than it looks, and the reason is file 12: **a question that an attempt has
been served can never be hard deleted**, by anybody, including you, including in the SQL editor.

So delete in this order, and accept one thing stays:

```sql
-- 1. the learner data, which deletes cleanly
delete from lms_watch_buckets   where lesson_id in (select id from lms_lessons where module_id in (select id from lms_modules where course_id = '<course id>'));
delete from lms_lesson_progress where lesson_id in (select id from lms_lessons where module_id in (select id from lms_modules where course_id = '<course id>'));
delete from lms_quiz_attempts   where quiz_id   in (select id from lms_quizzes where lesson_id in (select id from lms_lessons where module_id in (select id from lms_modules where course_id = '<course id>')) or module_id in (select id from lms_modules where course_id = '<course id>'));

-- 2. NOW the questions will delete, because no attempt points at them any more
delete from lms_options   where question_id in (select id from lms_questions where quiz_id in (select id from lms_quizzes where ...));
delete from lms_questions where quiz_id in (select id from lms_quizzes where ...);

-- 3. then the structure
delete from lms_quizzes where ...;
delete from lms_lessons where module_id in (select id from lms_modules where course_id = '<course id>');
delete from lms_modules where course_id = '<course id>';
delete from lms_entitlements where course_id = '<course id>';
delete from lms_courses where id = '<course id>';
```

**Delete the attempts first and the questions become deletable.** The guard counts attempts that
reference the question; with none left, it allows the delete. That is the whole trick, and it is why
the order matters.

**What cannot be undone**: the test accounts in `auth.users`, which should be deleted from the
dashboard under Authentication, Users; and any certificate issued during testing, which should be
**revoked** rather than deleted, because revoking is what the certification system is built to do.

**A cleaner alternative worth considering**: do not delete at all. Set the course to `archived`
rather than `draft`, and leave it. It disappears from the catalogue, the data stays consistent, and
you have a working example to look at the next time somebody asks how a course is put together.

---

# 9. THE READINESS CHECK

One query. **It only reads.** Paste it whole into the Supabase SQL editor.

```sql
select 'file 12 objects'                         as item,
       case when count(*) = 6 then 'yes' else 'NO, only ' || count(*) || ' of 6' end as answer,
       string_agg(p.proname, ', ' order by p.proname) as detail
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('request_sign_in_code','sign_in_caller_ip','send_email_hook',
                     'system_health','lms_set_health_token','mail_limit_per_day')

union all
select 'the Send Email Hook function',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='send_email_hook')
            then 'yes' else 'NO' end,
       'switch it on under Authentication, then Hooks'

union all
select 'the health token is set',
       case when exists (select 1 from lms_health_token where id = 1) then 'yes' else 'NO' end,
       'if NO: select lms_set_health_token(''a-long-random-string'');'

union all
select 'the lowered email ceiling',
       case when (select per_day from mail_limits where id = 1) between 1 and 90
            then 'yes' else 'NO' end,
       coalesce((select per_hour || ' an hour, ' || per_day || ' a day'
                   from mail_limits where id = 1), 'the mail_limits row is MISSING')

union all
select 'no function deletes without a where clause',
       case when not exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          cross join lateral regexp_matches(p.prosrc, '(delete\s+from\s+[a-zA-Z_][a-zA-Z0-9_]*\s*;)', 'gi') m
          where n.nspname = 'public' and m[1] !~* 'where')
            then 'yes' else 'NO, Supabase will refuse it through the API' end,
       'this is what broke the health check on 7 October'

union all
select 'nightly access sweep', lms_nightly_job_status(), 'from file 10'

union all
select 'nightly watch prune', lms_prune_job_status(), 'from file 11'

union all
select 'pg_cron is installed',
       case when exists (select 1 from pg_extension where extname='pg_cron') then 'yes' else 'NO' end,
       'without it both jobs exist but are never run on a timetable'

union all
select 'the mailer is alive',
       coalesce((select case when now() - at < interval '5 minutes' then 'yes'
                             else 'NO, last at ' || to_char(at,'YYYY-MM-DD HH24:MI') || ' UTC' end
                   from lms_system_heartbeat where name='mailer_fetch'), 'NO, it has never run'),
       'the mailer collects every minute, and this is stored in UTC'

union all
select 'database size',
       case when pg_database_size(current_database()) < 450*1024*1024 then 'yes' else 'NO' end,
       pg_size_pretty(pg_database_size(current_database())) || ' of 500 MB ('
         || round(100.0*pg_database_size(current_database())/(500*1024*1024), 1) || ' percent)'

union all
select 'emails sent in the last 24 hours',
       case when (select count(*) from sign_in_attempts
                   where outcome='sent' and at > now() - interval '24 hours')
                 < (select per_day from mail_limits where id=1)
            then 'yes' else 'NO, at the ceiling' end,
       (select count(*)::text from sign_in_attempts
         where outcome='sent' and at > now() - interval '24 hours')
       || ' of ' || (select per_day::text from mail_limits where id=1);
```

**What a good answer looks like**: `yes` on every row, and `scheduled` on the two job rows. The
mailer row says `NO` with a time in UTC if it has stopped; remember UTC is one hour behind Lagos, so
a time that looks an hour old is usually a minute old.

If **pg_cron is not installed**, the three job rows say so. That is a real finding, not a failure of
this query: the jobs would exist but never run, and would have to be run by hand.

## 9.1 The second query, only if the first says pg_cron is installed

Whether the jobs have actually **run successfully** lives in a table that only exists when pg_cron
is installed. PostgreSQL works out which tables a query touches **before** it runs any of it, so a
single query mentioning that table fails outright on a database without the extension, rather than
skipping the row. That is why it is separate rather than one more `union all`.

Run this one second, and only if the row above says yes:

```sql
select jobname,
       max(start_time)                                        as last_run,
       count(*) filter (where status <> 'succeeded')           as failed_runs,
       max(status)                                             as latest_status
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
 where start_time > now() - interval '7 days'
 group by jobname
 order by jobname;
```

Two rows, `lms-nightly-access` and `lms-prune-watch`, each with `failed_runs` at 0. No rows at all
means the jobs are scheduled but have not run yet, which is normal on the first day.

**One honest note on this second query.** pg_cron is not installed on my local test copy, so unlike
the main query I could not run it here. The column names come from pg_cron's own documented tables.
If it complains about a column, send me what it says and I will correct it.

---

# 10. OPEN QUESTIONS

1. How should a lesson's video length get filled in: typed by the facilitator, measured by the
   player on first play, or both? See gap 4.1.
2. Shall I build file 13 to issue a certificate when an Academy course is finished? Nothing does it
   today. See gap 4.2.
3. Which login option do you want: A separate, B password only, or C one account with a password or
   a code? See section 7.
4. Shall I set the Email OTP expiration to 600 seconds so it matches the emails that already promise
   ten minutes, or change the emails?
5. Is `/lms` the right home for this, or should the Academy sit at `/academy`? Changing it later
   means redirects.
6. Should the Academy pages carry the existing site Header and Footer, which currently appear on
   every route including the portal, or should the lesson player be a quieter full screen page?
7. Is a course certificate the same thing as a bootcamp certificate, sharing the numbering and the
   `/verify` page, or a different kind with its own look?
8. Who is the second administrator? There is one today, and that is a single point of failure.
9. Do you want the sitemap generated from the live catalogue, or typed by hand and updated when a
   course is published?
10. Should the staff control room be at `/lms/studio`, or merged with the two staff portals that
    already exist so there is one place rather than three?
11. Is Paystack in scope for the first release, or will the first courses all be free or
    bootcamp only?
12. The daily email allowance is 100, which is enough to test and not enough to launch. When do you
    want to move the mailer to the Workspace account?

---

# GLOSSARY

**Single page app.** A website that sends one page and then redraws itself in the browser as you
click about, instead of fetching a new page from the server each time. Faster for people, harder for
search engines.

**Route.** An address on the site, like `/lms/courses`, and the piece of code that draws it.

**Component.** A reusable piece of a page, like the header or a button, written once and used in
many places.

**Edge function.** A small program that runs on the hosting company's servers before the page
reaches you. We use one to put the right title on a certificate page.

**Structured data.** Hidden text on a page that describes it to a search engine in a format the
search engine understands, so it can show it as a course rather than just a link.

**noindex.** A note on a page asking search engines not to list it. Used on anything private.

**robots.txt.** A file at the root of a site telling search engines which parts to stay out of.

**sitemap.xml.** A file listing every page you want found, so a search engine does not have to
discover them by following links.

**Row level security.** The rule inside the database about who may see which rows. It is what makes
it safe for the website's key to be public.

**Publishable key.** The key the website carries. It is meant to be seen. It can only do what row
level security allows.

**RPC.** Remote procedure call. Asking the database to run one of its own functions, rather than
reading a table directly.

**Token.** A long random string that proves who you are after you have signed in, so you do not have
to type a password on every page.

**OTP.** One time password. The six digit code sent by email.

**Watch bucket.** One row saying "this person really did watch seconds 40 to 50 of this video". The
server writes them, which is why dragging the bar forward does not fill them.

**Coverage.** How much of a video the server has actually seen you watch, as a percentage. The next
lesson stays shut until it passes the threshold.

**Draft and published.** A course being built is a draft and only staff can see it. Published means
visitors can.

**Guard trigger.** Code the database runs by itself when somebody tries to change a row, which can
refuse the change. It is how "only the administrator publishes" is enforced in the one place nobody
can route around.

**Entitlement.** A row saying a person may open a course, whether they bought it, were given it, or
earned it by being on a bootcamp.

**pg_cron.** An optional extra that lets the database run a job on a timetable. If it is off, the
jobs still exist and can be run by hand.

**UTC.** The world clock the database stores times in. Lagos is one hour ahead, so a database time
that looks an hour old is often a minute old.
