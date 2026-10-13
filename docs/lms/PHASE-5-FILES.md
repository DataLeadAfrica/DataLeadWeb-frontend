# Phase 5: every file in this package, and what to do with it

Lay the package on top of `main`. Every file sits at its real path, so the folders match the
repository exactly.

**No database change in this phase.** Nothing in `database/` is new or changed. The files in there
are from Phases 2 to 4 and are unchanged.

New branch, Vercel preview, you test, then merge. Never on `main`.

---

## New files (14)

Paste these in as new files. Nothing in the repository has these names yet.

| Path | What it is |
|---|---|
| `api/_cover-art.js` | Draws every course cover. The one copy, used by the pages and by the share picture. |
| `api/_cover-art.d.ts` | The shape of the file above, so TypeScript can see across into it. Same pattern as `api/_seo-rules.d.ts`. |
| `src/css/dla-mark.css` | The one class for the Data-Lead mark. |
| `src/pages/Academy/ui/CourseCover.tsx` | The cover component. |
| `src/pages/Academy/ui/CourseCover.css` | Its styles, and the area colours. |
| `src/pages/Academy/Landing/GoalRail.tsx` | "What do you want to do?" and the card rail. |
| `src/pages/Academy/Landing/GoalRail.css` | Its styles. |
| `src/pages/Academy/Landing/QuickPicks.tsx` | The three short lists. |
| `src/pages/Academy/Landing/QuickPicks.css` | Its styles. |
| `src/pages/Academy/Landing/PathBanner.tsx` | The learning path banner and its fan of covers. |
| `src/pages/Academy/Landing/PathBanner.css` | Its styles. |
| `tests/cover-art.test.mjs` | 20 tests on the cover art. |
| `tests/og-course.test.mjs` | 5 tests that render the real share picture. |
| `docs/lms/PHASE-5-FILES.md` | This file. |

## New picture and icon files (5)

These are binary files. On the GitHub website, use **Add file, Upload files** rather than pasting,
or they will arrive corrupted.

| Path | What it is |
|---|---|
| `public/brand/dla-mark.webp` | The mark, exactly as you sent it. |
| `public/academy/africa-dots.svg` | The map behind the hero, exactly as you sent it. |
| `public/favicon.ico` | Tab icon, 16, 32 and 48 in one file. |
| `public/apple-touch-icon.png` | iOS home screen, 180 by 180. |
| `public/icon-192.png` | Android home screen, 192 by 192. |

---

## Changed existing files (24)

Replace each one with the version in this package.

### The Academy

| Path | What changed |
|---|---|
| `src/pages/Academy/ui/CourseCard.tsx` | Rebuilt around the cover. Tool chip and "Module 1 free" tag removed from the body. |
| `src/pages/Academy/ui/CourseCard.css` | Card is now picture first, with the body padded instead of the card. |
| `src/pages/Academy/ui/ToolRack.tsx` | The two letter square became the course's square cover. |
| `src/pages/Academy/ui/ToolRack.css` | That, plus the frosted glass so the map reads through the rack. |
| `src/pages/Academy/ui/Icons.tsx` | One new icon, `GoalIcon`, for the goal chips. Nothing else touched. |
| `src/pages/Academy/academy.css` | `.acad-link` now sizes its own arrow. See the note below. |
| `src/pages/Academy/Pitch.tsx` | The mark in the eyebrow, in place of the pulsing dot. |
| `src/pages/Academy/Landing/page.tsx` | "Latest courses" replaced by the rail, Quick picks and the path banner. The map and the floating tiles added to the hero. |
| `src/pages/Academy/Landing/page.css` | The hero map, the floating tiles. |
| `src/pages/Academy/Courses/page.tsx` | A colour swatch on each area filter. |
| `src/pages/Academy/Courses/page.css` | Its styles. |
| `src/pages/Academy/Course/page.tsx` | The `Course` structured data now carries `image`. |
| `src/pages/Academy/Course/BuyCard.tsx` | The cover above the price. |
| `src/pages/Academy/Course/BuyCard.css` | That, and hiding it when the card becomes the bar at the bottom of a phone. |
| `src/pages/Academy/Me/page.tsx` | Square covers on your courses, found by slug in the catalogue. The mark on the certificate rows. |
| `src/pages/Academy/Me/page.css` | Their styles. |
| `src/lib/catalogue.ts` | `coverCode` removed from here. It lives in `api/_cover-art.js` now, which both the pages and the share picture can reach. |

### Outside the Academy

These four are the ones to look at hardest, because they are not Academy files.

| Path | What changed |
|---|---|
| `api/og.js` | **The course share picture redrawn.** Also two bug fixes that affect the certificate picture: a drawing failure now falls back instead of breaking, and the cache header no longer says two different things. The certificate picture itself is byte for byte identical, checked in all four of its states. Full detail in `docs/lms/CHANGELOG.md`. |
| `src/pages/Certificates/Showcase/page.tsx` | One decorative mark in front of the issuer line. No behaviour change. |
| `src/pages/Certificates/Showcase/page.css` | Its margin. |
| `index.html` | Three `<link>` tags for the new icons. `logo.svg` is unchanged and still listed first. |

### Housekeeping

| Path | What changed |
|---|---|
| `package.json` | One new script, `"test": "node --test \"tests/*.test.mjs\""`. No new dependencies. See the note below. |
| `tests/academy-meta.test.mjs` | One comment line, pointing at `npm test`. No test changed. |
| `docs/lms/CHANGELOG.md` | The Phase 5 entry. Moved here from the root of the repository in round 2. |

---

## Two small things worth knowing

**`npm test` is new, and the command in the comments was wrong.** The test files said to run
`node --test tests/`, which does not work on Node 22: it tries to load `tests` as if it were a
single file and reports one failure. `npm test` runs all 103 and is what a checker would call.
It adds a script, not a dependency.

**`.acad-link` now sizes its own arrow, and that is a fix, not a tidy-up.** Every place that used
an `.acad-link` with a small arrow after it was setting the arrow's size itself. A new use that
did not know to do that drew the arrow at the browser's default size for an SVG with no
dimensions, which is 300 by 150 and filled solid black. It happened to me, in Quick picks, and the
screenshot is how I found it. The size is on the shared class now. It sets size and colour only,
deliberately: three of these links sit inside a running sentence, and giving the class a flex
display would lift them out of the line of text.

---

## Before you merge

| Check | Where |
|---|---|
| Every course card has a picture | `/lms` and `/lms/courses` |
| The goal chips show the right counts, and pressing one does not change the address | `/lms` |
| Quick picks has no "Popular" column | `/lms` |
| The map never sits under the headline | `/lms`, narrow the window from wide to phone and watch |
| The tool names on the covers are readable | `/lms`, the rail |
| Your courses all have a picture | `/lms/me` |
| The share picture is a real picture | open `/api/og?course=<a real slug>` in a browser |
| A certificate's share picture still looks exactly as it did | open `/api/og?number=<a real number>` |
| The tab icon still appears | any page |

`npm run build` passes and all 103 tests pass on top of `main` at `d02c86b` with everything since.
`npm run lint` reports the same 3 errors and 7 warnings before and after this phase; all of them
are in files Phase 5 does not touch.
