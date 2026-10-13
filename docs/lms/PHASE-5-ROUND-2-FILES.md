# Phase 5 round 2: every file in the package

Laid on `main` **226e3f0**. The package holds **only the files that differ from it**, at their real
paths, so it can be unzipped straight over a fresh copy of `main`.

This is a change to a live site, so there is no cumulative copy of the repository in here any more.

**New branch from `main`, then a pull request.** Never from `lms-academy`, never a commit to `main`.

---

## Deleted. Remove these six after unzipping

The zip cannot delete anything, so these have to be removed by hand on the branch.

| Path | Why |
| --- | --- |
| `CHANGELOG.md` | moved to `docs/lms/CHANGELOG.md` |
| `PREVIEW-DATA.md` | moved to `docs/lms/PREVIEW-DATA.md` |
| `database/lms/not-yet-run/10_roles_and_access.sql` | a second copy of file 10, which was run on the live database on 6 October |
| `database/lms/not-yet-run/10_undo.sql` | same |
| `database/lms/not-yet-run/10_verify.sql` | same |
| `database/lms/not-yet-run/README.md` | the folder's own note |

On the GitHub website: open each file, press the bin icon, commit to the branch. The whole
`not-yet-run` folder disappears when its last file goes.

---

## The launch switch

| File | What changed |
| --- | --- |
| `api/_seo-rules.js` | **`ACADEMY_PUBLIC = false`**, the one constant, and the `PREVIEW_NOTICE` sentence. The comment above it says the launch PR flips that line and changes nothing else. |
| `api/_seo-rules.d.ts` | The two new names, so TypeScript can see them. |
| `api/_academy-data.js` | Re-exports both, the same way it re-exports the rest of the rules. |
| `api/academy-meta.js` | `noindex` on the HTML for `/lms`, `/lms/courses` and `/lms/courses/:slug` while the switch is off. Canonical, title, description and share picture untouched. |
| `api/sitemap.js` | No `/lms` address is listed while the switch is off. Every other page still is. `buildSitemap` takes the value as a third argument so one test can check both. |
| `src/lib/site.ts` | Brings `ACADEMY_PUBLIC` and `PREVIEW_NOTICE` across to the React side, so a page has one import for them. |
| `src/components/AcademyBand/component.tsx` | The band on `/courses` never shows while the switch is off, and does not even ask Supabase for the catalogue. |
| `src/pages/Academy/ui/PreviewNotice.tsx` | **New.** The one line notice. |
| `src/pages/Academy/ui/PreviewNotice.css` | **New.** Slim, light, centred, no close button, never fixed or sticky, hidden when printed. |
| `src/pages/Academy/router.tsx` | Renders the notice once, inside `page()`, so all eleven `/lms` routes have it. |
| `src/pages/Academy/Landing/page.tsx` | Passes `noindex` to `<Seo>` while the switch is off. |
| `src/pages/Academy/Courses/page.tsx` | The same. |
| `src/pages/Academy/Course/page.tsx` | The same. |
| `src/components/Seo/component.tsx` | A `robots` prop, so the three public pages can say `noindex, follow`, which is word for word what the edge function already wrote. Its default is unchanged, so every other page that passes `noindex` still gets `noindex, nofollow`. |
| `tests/launch-switch.test.mjs` | **New. 15 tests.** Both values of the switch, really run: it copies `api/` to a temporary place, rewrites the one line to `true`, and drives the sitemap and all three edge pages against the copy. |

## vercel.json

| File | What changed |
| --- | --- |
| `vercel.json` | **Dr Ayoola's merged file, byte for byte.** Main's, with the Excel basics rewrites, plus our four, before the catch-all. |
| `tests/vercel-rewrites.test.mjs` | **New. 5 tests.** Fails if any of six rewrites goes missing, if the catch-all is not last, or if anything is listed twice. |

## The three design fixes

| File | What changed |
| --- | --- |
| `src/pages/Academy/Landing/page.tsx` | The rack and its four tiles are wrapped in a new `.acad-hero__card`, so the rack can be narrowed without taking the map with it. The fourth tile is the chart, not the question mark. |
| `src/pages/Academy/Landing/page.css` | From 1024 up: the card has a width of its own and sits right of its column, and the map is sized so Nigeria and the Abuja rings land in the band this frees. The soft glow follows Nigeria. |
| `src/pages/Academy/ui/Icons.tsx` | **`ChartIcon` added.** Three bars and a baseline, as the concept drew it. `AskIcon` is left in place; nothing on the landing page uses it now. |
| `src/pages/Academy/Landing/GoalRail.css` | The arrows are hidden under `(any-hover: none)` and below 620 pixels, after the rule that shows them. |

## Tidying

| File | What changed |
| --- | --- |
| `docs/lms/CHANGELOG.md` | **Moved here from the root**, and the round 2 entry added at the top. |
| `docs/lms/PREVIEW-DATA.md` | **Moved here from the root.** Unchanged otherwise. |
| `docs/lms/PHASE-5-TEST.md` | Section 1 replaced: the test course already exists, so it is one SQL file to run rather than a course to build. |
| `database/lms/show-test-course.sql` | **New.** That SQL, so the name the document uses points at a real file. |
| `database/lms/README.md` | No longer points at the `not-yet-run` folder, and says where to read what has actually been run. |
| `docs/lms/STATUS.md` | What happened on 9 October and what it cost, and two new standing rules. |
| `docs/lms/SEO.md` | One link to the changelog's new path. |
| `docs/lms/PHASE-5-FILES.md` | Two links to the changelog's new path. |
| `docs/lms/PHASE-5-PLAIN.md` | A round 2 section, in plain words. |
| `tests/academy-meta.test.mjs` | Five tests made switch aware, so they say what they mean at both values rather than passing for the wrong reason on launch day. |
| `package.json` | The `test` script, from round 1. Main has none. |

## Everything else in the zip is round 1

Round 1 was never merged, so the package carries it too: the covers, the rail, Quick picks, the
path banner, the mark and the favicon set, the `api/og.js` fixes, and the rest. `docs/lms/PHASE-5-FILES.md`
lists those file by file.

---

## What was checked

| | Result |
| --- | --- |
| `npm run build` | passes |
| `npm test` | **123 of 123** (103 before, 15 new for the switch, 5 for `vercel.json`) |
| `npm run lint` | the same 3 errors and 7 warnings as `main`, all in files this package does not touch |
| `vercel.json` | byte for byte identical to the file you sent |
| The hero, measured at 1600, 1360, 1180, 1024, 980, 900, 760, 620 and 390 | map clear of every piece of hero text at all nine, Nigeria clear of the rack with at least 10 pixels of air from 1024 up, whole feature drawn, no sideways scroll |
| The rail arrows, measured at seven widths with a mouse and three with touch | shown above 620 with a mouse, hidden at 620 and below, hidden on touch at every width |
| `database/lms/show-test-course.sql` | run on a local PostgreSQL 16: publishes, safe to run twice, leaves nothing set, refuses and changes nothing with no administrator or no test course |

## What was NOT checked, and you should

- **A real phone.** The rail arrows were measured in Chromium with touch emulation, which reports
  `any-hover: none`. The `max-width: 620px` rule is there so it does not matter either way.
- **The real `/sitemap.xml` and the three `/lms` pages on the Vercel preview**, after merging. The
  tests drive the edge functions in Node with a stubbed fetch; they cannot prove Vercel is routing
  `/sitemap.xml` to them.
