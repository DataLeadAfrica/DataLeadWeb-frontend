# academy-6a: every file in the package, and why it is there

The zip holds **68 files** and asks for **2 deletions**, listed again in
`DELETE-THESE-TWO-FILES.txt` at the top of the package. Everything in the zip differs from `main` at
`422aa9f`. Nothing else in the repository is touched.

Laid on `main` at `422aa9f`. New branch `academy-6a` from `main`, in by PR, Vercel preview, you
test, then merge.

**Not in the package, on purpose:** `vercel.json` and `package.json`. The rewrites are exactly as
round 2 left them and there is no new dependency, so there is nothing to change in either.

`api/_seo-rules.js` IS in the package now, for one line: the fallback headline, which has to say the
same sentence as the database's default (round 3 item 6). `ACADEMY_PUBLIC` in that file is untouched
and still `false`, and a test fails if it is not.

---

## The database, 4 files, all new

| File | What it is |
|---|---|
| `database/lms/16_restructure.sql` | The whole restructure. One transaction, safe to run twice. ~3,100 lines |
| `database/lms/16_verify.sql` | Changes nothing. Prints 55 rows that should all say yes |
| `database/lms/16_undo.sql` | Puts it back as file 15 left it. Refuses if anybody has used the new things |
| `database/lms/tests/file_16_tests.sql` | 52 checks against a local Postgres. Not for the Supabase editor: it writes rows |

**Do not run any of these yet.** Part A and Part B go in together, after you have reviewed both.
`docs/lms/ACADEMY-6A-RUN-ORDER.md` is the order for when you are ready.

## The pages, 46 files

### New pages and new components, 22 files

| File | What it is |
|---|---|
| `src/pages/Academy/Path/page.tsx` + `.css` | The path page at `/lms/paths/:slug`. Item 9, and the fourth page the launch switch covers |
| `src/pages/Academy/Learn/Exam/page.tsx` + `.css` | The exam, in three phases: the rules, the sitting, the result. Item 8 |
| `src/pages/Academy/Learn/Exam/state.js` + `.d.ts` | The five states and their wording, and the countdown, kept out of the page so a test can reach them |
| `src/pages/Academy/Learn/Player/Chapters.tsx` + `.css` | The chapter list under the video. Item 5 |
| `src/pages/Academy/Learn/chapters.js` + `.d.ts` | Which chapters may be jumped to, and the same parser the database uses |
| `src/pages/Academy/Landing/AreaPicker.tsx` + `.css` | The area tabs and the tool key grid, with the panel that opens in the right row. Item 1 |
| `src/pages/Academy/Landing/AreaStrip.tsx` + `.css` | "Explore by area", above the map. Item 1 |
| `src/pages/Academy/SignUp/AboutYou.tsx` | The four sections of the About you form. Item 4 |
| `src/pages/Academy/SignUp/answers.js` + `.d.ts` | The skip logic and the lists, kept out of the page so the same rules can be tested and compared with the database's |
| `src/pages/Academy/ui/Ask.tsx` + `.css` | The four kinds of question the form asks: a dropdown, a text box, radio pills, checkbox pills |
| `src/pages/Academy/ui/Popup.tsx` + `.css` | The one popup. Item 12 |

The `.js` plus `.d.ts` pattern is the one `api/_seo-rules.js` already uses on `main`: there is no
`allowJs` in `tsconfig.app.json`, so a `.js` file is reached through its `.d.ts`. It is there so the
rules can be read by `node --test` without a build step.

### Pages changed, 24 files

| File | Why |
|---|---|
| `src/pages/Academy/Landing/page.tsx` + `page.css` | The new picker and strip go in; the old rack comes out. Items 1 and the two 1024 fixes |
| `src/pages/Academy/Landing/GoalRail.tsx` | Stops on pointer, focus and touch; stays stopped after a touch; never moves with reduced motion |
| `src/pages/Academy/Landing/PathBanner.tsx` | Sends people to the path page rather than into course one |
| `src/pages/Academy/Landing/QuickPicks.tsx` | The three columns open the catalogue with a filter already on |
| `src/pages/Academy/Courses/page.tsx` | Two toggles, the sort dropdown gone, a filter read once from the address. Item 2 |
| `src/pages/Academy/Course/page.tsx` | Areas, kind, chapter count, the paths it counts towards. Item 3 |
| `src/pages/Academy/SignUp/page.tsx` | The About you sections, and the fresh token after the code is verified |
| `src/pages/Academy/Learn/Player/page.tsx` + `page.css` | 100 per cent, the chapters, the speed cap, the outline ending at the exam. Item 5 |
| `src/pages/Academy/Learn/Check/LessonCheck.tsx` | Watch this part again, and the next lesson by name. Item 6 |
| `src/pages/Academy/Learn/MyCourse/page.tsx` + `page.css` | No module quiz rows, one exam row, the certificate checklist counts the exam. Item 7 |
| `src/pages/Academy/Learn/Complete/page.tsx` + `page.css` | What the course counts towards, and the next thing from the recommendations. Item 11 |
| `src/pages/Academy/Me/page.tsx` + `page.css` | Recommendations with their reasons, and the popup. Item 10 |
| `src/pages/Academy/ui/Question.tsx` + `.css` | The watch again button on a miss, and never the right option |
| `src/pages/Academy/ui/WatchTape.tsx` | Needs every cell; the 92 per cent line is gone |
| `src/pages/Academy/ui/CourseCover.tsx` + `.css` | The area and the kind on a cover. Item 13 |
| `src/pages/Academy/ui/AcadStage.tsx` + `.css` | The hero: the long tool name, and every tile inside the window |
| `src/pages/Academy/academy.css` | `.acad-steps` and `.acad-next__grid` moved here, because two pages use them now |
| `src/pages/Academy/router.tsx` | The path page and the exam page |
| `src/pages/routes.ts` | `academyPath` and `academyExam` |

### The data layer, 3 files

| File | Why |
|---|---|
| `src/lib/catalogue.ts` | `getLanding`, `getMyPath`, `getLivePopup`, `popupShown` |
| `src/lib/learn.ts` | The exam, the chapters, the recommendations; `MyCourse` gains `exam` and `paths`; `OpenLesson` gains the chapters and the furthest second |
| `src/lib/academy.ts` | The About you answers go up with the sign up; a fresh token after the code is verified |

### The share pictures, 3 files

| File | Why |
|---|---|
| `api/_cover-art.js` + `.d.ts` | A long name takes a size worked out from its longest word, so it cannot break inside one. The art is nudged so it does not sit under a two line name |
| `api/_site-routes.js` | The path page and the exam page, so no route exists that nobody has decided about. The note on the path page says what is actually true: the edge function does not answer it |

## The tests, 5 files

| File | Count | What it holds |
|---|---|---|
| `tests/signup-answers.test.mjs` | 40, new | The skip logic, the lists, the countries against the database's own tables, the nightly prune |
| `tests/chapters.test.mjs` | 20, new | Every refusal names its line, and the SQL parser still refuses the same things in the same words |
| `tests/exam-state.test.mjs` | 18, new | The five states, the countdown, no option id in a result, a late submit marked at the deadline |
| `tests/learner-pages.test.mjs` | 29, new | The promises about what a page must NEVER do, and the launch switch on the four public pages and the four behind a sign in |
| `tests/cover-art.test.mjs` | 24, was 21 | The area and the kind, and no tool name breaking inside a word |

`npm test` runs **233**, all passing. `main` runs 123.

## The documents, 5 files

| File | Why |
|---|---|
| `docs/lms/CHANGELOG.md` | **Changed, not added.** My separate `academy-6a` changelog is merged into this one as the ACADEMY 6A entry at the top. There is one changelog for the Academy |
| `docs/lms/ACADEMY-6A-RUN-ORDER.md` | New. What to run in Supabase and in what order, and what each block of verify rows is for |
| `docs/lms/ACADEMY-6A-PLAIN.md` | New. The whole round explained plainly, Part A and Part B |
| `docs/lms/ACADEMY-6A-FILES.md` | New. This page |
| `docs/lms/STATUS.md` | **Changed.** One row added to Known problems: file 16 is written, tested and not run, and that is the gate on the whole round |

---

## The 2 deletions

Make these after you have laid the zip on the branch. GitHub's web editor does it from the file's
own page: open it, then the bin icon.

```
src/pages/Academy/ui/ToolRack.tsx
src/pages/Academy/ui/ToolRack.css
```

The rack is replaced by `AreaPicker`, which does what it did and shows the tools with no course yet.
Nothing imports `ToolRack` any more, so leaving them would not break the build; it would leave a
dead component for somebody to find in six months and wonder about.

## What must be true after you lay it down

| | |
|---|---|
| `npm run build` | passes |
| `npm test` | 233 of 233 |
| lint | unchanged from `main`: 3 errors and 7 warnings, all of them in files this package does not touch |
| no new dependency | `package.json` is not in the package |
| the launch switch | still `false`; `api/_seo-rules.js` is not in the package |
| `vercel.json` | not in the package, so the Excel basics rewrites are untouched |
| no em or en dashes | checked across every file in the package |
