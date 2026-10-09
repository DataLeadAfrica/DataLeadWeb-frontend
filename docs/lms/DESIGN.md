# DESIGN.md

The Academy design system. Phases 3 to 6 build from this file, so a page added in Phase 5 looks
like a page added in Phase 2 without anybody having to remember how.

Everything here was built in Phase 2 from the design concept, and everything in it is on screen in
the Phase 2 pages except the watch tape, which is built and tested but not shown until Phase 4.

---

## 1. The idea in one paragraph

The Academy is an instrument, in the main website's light theme, always. A light stage under the
normal white site Header, a fine grid, one soft orange glow, crisp white cards. There is no dark
mode and no theme switch, because the Academy has to look like part of dataleadafrica.com rather
than like a separate product that happens to share a logo.

The signature element is the **watch tape**: one cell for every ten seconds of a lesson, with the
92% line marked on it. It is the real unlock rule made visible rather than a progress bar invented
for the look of it.

---

## 2. The two rules that must not be broken

**Every token is declared on `.acad`, never on `:root`, `html` or `body`.**

`src/pages/Learning/portal.css` sets its own `:root` values and a `body` background. Vite bundles
every stylesheet in the site into one file, so the moment any portal page loads, those values apply
everywhere, including here. The Academy must not become a second source of that problem. If you
find yourself needing a token outside `.acad`, the markup is wrong, not the rule.

**Light values only.** No dark mode, no `prefers-color-scheme`, no theme attribute. If a later
phase wants dark mode it is a decision about the whole website, not about `/lms`.

---

## 3. Where everything lives

```
src/pages/Academy/
  academy.css              tokens, type, button, link, messages. Imported by every page
  ui/
    AcadStage.tsx  .css    the stage: grid, glow, page width, carries .acad
    AcadCard.tsx   .css    the white card with the orange edge
    StepRail.tsx   .css    Details, Verify, Ready
    Field.tsx      .css    one input with a floating label
    PasswordStrength.tsx   four segments and a word
    CodeBoxes.tsx  .css    the six code boxes
    MeterRing.tsx  .css    a circular countdown with a line of text
    WatchTape.tsx  .css    one cell per ten seconds, with the unlock line
    PassCard.tsx   .css    who you are and what your account reaches
    EmptyState.tsx .css    what you see before you have started anything
    Icons.tsx              the handful of line icons, drawn inline
    format.ts              asClock
  CodeStep.tsx     .css    the whole code screen, shared by three pages
  Pitch.tsx        .css    the left hand side of the account pages
```

One `.css` beside each component, which is how the rest of the repository does it. Nothing imports
another component's stylesheet.

---

## 4. Tokens

All on `.acad`, in `academy.css`.

### Surfaces

| Token | Value | What it is |
| --- | --- | --- |
| `--acad-bg` | `#eceff3` | The stage behind everything |
| `--acad-surface` | `#ffffff` | Cards |
| `--acad-surface-2` | `#f5f7fa` | Inputs, and the quieter half of a card |
| `--acad-surface-3` | `#e7ebf0` | Tracks, empty bars, the Show button |
| `--acad-line` | `rgba(22,24,32,.09)` | Ordinary borders |
| `--acad-line-strong` | `rgba(22,24,32,.18)` | Borders that have to be seen |

### Text

| Token | Value | Use | Measured |
| --- | --- | --- | --- |
| `--acad-text` | `#16151b` | Everything by default | 16.9:1 on white |
| `--acad-muted` | `#5b6170` | Second rank: leads, hints, labels | 6.6:1 on white |
| `--acad-faint` | `#6e7380` | Steps not reached yet. **Inside cards only** | 4.7:1 on white, 4.1 on the stage |

`--acad-faint` is the one token with a condition on it. It passes AA on a white card and fails on
the stage behind, so it is only ever used inside a card. If a later phase wants faint text on the
stage, use `--acad-muted`.

### Orange

| Token | Value | Use |
| --- | --- | --- |
| `--acad-signal` | `#f56e0f` | Fills, bars, buttons, the lit cells. **Never text** |
| `--acad-signal-text` | `#c2500a` | Orange text **on white**. 4.7:1 |
| `--acad-signal-deep` | `#a8440a` | Orange text **on a tint**. 5.6:1 on the wash, 6.0:1 on white |
| `--acad-signal-soft` | `#f9a971` | The cell being watched, the done half of the rail |
| `--acad-signal-wash` | `rgba(245,110,15,.16)` | The badge background, the pass card's corner |
| `--acad-glow` | `rgba(245,110,15,.28)` | The stage glow and every focus ring |

Three oranges for three jobs, and the reason is contrast. `--acad-signal-text` is 4.7:1 on white,
which is AA, but on the faintest orange wash it falls to 4.0 and small text fails. That is what
`--acad-signal-deep` is for. Choose by what is behind the text, not by which looks nicer.

### Status

| Token | Value | Use |
| --- | --- | --- |
| `--acad-ok` | `#0d7a4e` | Accepted codes, the green notice. 5.4:1 on white |
| `--acad-ok-soft` | `rgba(13,122,78,.1)` | The notice background |
| `--acad-ok-line` | `rgba(13,122,78,.4)` | The notice border |
| `--acad-bad` | `#c93434` | Refusals. 5.2:1 on white |

The green is deliberately darker than the obvious one. `#11905c` from the concept is 4.1:1 on
white, which fails for the 13.5px message it carries.

### Type, radius, shadow

| Token | Value |
| --- | --- |
| `--acad-f-display` | `"AcadDisplay", "ClashDisplay-Semibold", "Poppins", system-ui, sans-serif` |
| `--acad-f-body` | `"Poppins", system-ui, -apple-system, "Segoe UI", sans-serif` |
| `--acad-f-mono` | `"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace` |
| `--acad-r-s` `-m` `-l` | `10px` `16px` `24px` |
| `--acad-shadow` | `0 30px 70px -34px rgba(30,36,52,.35)` |

---

## 5. Fonts

**Clash Display** for headings. Already in the repository at
`public/fonts/clash-display/Fonts/WEB/fonts/`, and the site loads every weight as its own family
name (`ClashDisplay-Medium`, `ClashDisplay-Semibold`, and so on). `academy.css` gathers two of those
files under one family, `AcadDisplay`, at weights 500 and 600, so Academy CSS can say
`font-weight: 600` instead of naming a different family for each weight. No new font files.

**Poppins** for text. Loaded site wide by `global.css`. Nothing added.

**JetBrains Mono** for labels, numbers, codes and anything the eye has to line up. Self hosted at
`public/fonts/jetbrains-mono/`, weights 400, 500 and 600, latin only, 64.9 KB in total, under the
SIL Open Font License (`OFL.txt` sits beside the files). Declared in `academy.css` rather than
`global.css` so the rest of the site never downloads it.

### The weight this adds

| | Raw | Over the wire |
| --- | --- | --- |
| Academy CSS, 21 files | 31.5 KB | 8.5 KB, gzipped |
| JetBrains Mono, three weights | 63.3 KB | 63.3 KB, woff2 is already compressed |
| **Total** | **94.9 KB** | **71.8 KB** |

The budget was 120 KB. Measured, not estimated. Most of the raw CSS is comments, which the
production build strips before any of it is sent.

---

## 6. The components

### AcadStage

The stage every page sits on, and the element that carries `.acad` and therefore every token.
Nothing in the Academy renders outside it.

```tsx
<AcadStage>                      {/* the two column account layout */}
<AcadStage width="wide">         {/* one full width column */}
<AcadStage focus>                {/* a page whose whole job is one task */}
```

**`focus` is not about layout.** It adds `.acad-stage--focus`, and the only thing that reads it is
one rule in `academy.css`:

```css
body:has(.acad-stage--focus) .wa-float { display: none; }
```

The site's floating WhatsApp button is fixed to the bottom right of every page. On a phone that is
exactly where the main button of a form ends up, so it sat on top of Create my account and on top
of Confirm my email. `focus` is on sign up, sign in, reset and My learning, and will be on the
Phase 4 lesson player. It is **off** on `/lms` and must stay off on the public Academy pages in
Phase 3, where the button is wanted.

It is done this way, rather than by changing `Footer`, because the button belongs to Footer and
every page on the site renders it: reaching into it from here would let a page outside `/lms`
start hiding it by accident. This way the whole arrangement is one rule in the Academy's own
stylesheet, beside the thing it is about.

`:has()` is what makes it possible, because the button is a sibling of the stage rather than inside
it. A browser too old to understand `:has()` drops the whole rule and shows the button exactly as
it does today, which is the right way for it to fail.

It draws the grid and the glow on its own pseudo elements, behind the content, inside an
`isolation: isolate` so the negative z-index cannot slide under the site Header.

It also stops the glow when the browser tab is hidden, by setting `data-still="yes"` on itself and
letting CSS pause every animation underneath. Nothing should keep moving in a tab nobody is
looking at.

### AcadCard

The white card with one orange edge in its top left corner. The edge is a gradient border drawn
with a masked pseudo element, because a real border cannot fade along its own length.

```tsx
<AcadCard>                                     {/* a plain card */}
<AcadCard as="form" onSubmit={...}>            {/* which is what every step uses */}
<AcadCard centred>                             {/* 560px, centred, for the code screen */}
```

### StepRail

Three bars: where you are in a three step flow. The steps differ by shape as well as colour, done
is a filled bar, current is a lit gradient bar, still to come is an empty grey bar, and the whole
rail is announced in words through `aria-label` so the bars themselves are decoration.

```tsx
<StepRail current={2} />                                        {/* Details, Verify, Ready */}
<StepRail current={1} steps={["Address", "Code", "New password"]} />
```

### Field

One input with a label that floats up out of the way once there is something in the box. The trick
is CSS only: the input carries `placeholder=" "`, a single space, so `:placeholder-shown` is true
exactly while the box is empty. Nothing listens for focus and nothing is measured.

A placeholder would have disappeared the moment somebody typed, which leaves anyone interrupted
halfway through a form looking at three filled boxes with no idea which is which.

```tsx
<Field label="Email address" type="email" value={email} onChange={setEmail}
       autoComplete="email" disabled={busy} invalid={...} describedBy="..." />
<Field label="Password" type="password" canReveal ... />   {/* adds Show and Hide */}
```

### PasswordStrength

Four segments and a word, under a password box. A hint, not a gate: the only rule actually enforced
is the minimum length, in the page, in `src/lib/academy.ts` and in the Supabase setting. No
dictionary, no entropy maths, and nothing leaves the box it was typed into.

### CodeBoxes

Six boxes for the emailed code. They keep an array of six cells rather than one joined string, and
that is the whole reason they behave. See section 8.

### MeterRing

A circular countdown with a line of text beside it. Used in pairs on the code screen: how long the
code lasts, and how long until another can be asked for.

```tsx
<MeterRing label="Code lasts" left={seconds} total={CODE_SECONDS}><b>{asClock(seconds)}</b></MeterRing>
```

The ring is a circle with a shortening dash. The page hands in a number once a second and the ring
follows it. No frames are counted.

### WatchTape

One cell per ten seconds, with the unlock line marked. **Built in Phase 2, first used in Phase 4.**

```tsx
<WatchTape durationSeconds={480} watchedSeconds={250}
           title="Cleaning survey data"
           note="Skipping ahead opens once you have watched a part" />
<WatchTape durationSeconds={480} watchedSeconds={250} compact />   {/* for a tile */}
```

**It must never appear on sign up, sign in or reset.** It would be showing progress to somebody who
does not yet have an account.

Two things it survives, both found by rendering it rather than by reasoning about it:

- **A long lesson.** An hour is 360 buckets and 360 cells will not fit across a phone. Drawn one
  each they shrink to nothing and the tape renders as an empty strip. Above 120 cells the buckets
  are drawn in groups, and a group lights only when every bucket in it is covered. The count
  underneath always names real buckets, never drawn ones.
- **A lesson with no length.** `duration_seconds` can be null while a course is a draft. It says
  "Length not set" and draws a flat grey bar rather than one cell the width of the card.

The grid uses `minmax(0, 1fr)`, not `1fr`. A plain `1fr` refuses to shrink a cell below its own
content box, which is exactly how the long lesson broke.

### PassCard

Who the person is and what their account reaches, as a card they own rather than a line of grey
text. Two versions, and which one shows is decided entirely by the access sync on the server:

- `bootcamp` the orange pass, for somebody whose enrolment is active
- `account` the plain card, for everybody else

The plain card is not a lesser version with things missing. It says what the account is, and
nothing about what it is not.

### EmptyState

What somebody sees before they have started anything: the area's name, a few cells of a watch tape
as a hint of what will fill it, a heading and a line. A blank box reads as a fault.

---

## 7. The rules for movement

- **Only `transform` and `opacity` are animated.** This is checked, not assumed: every running
  animation on the page is read back and its keyframes inspected. Colour and shadow changes are
  transitions on a state change, never loops.
- **No canvas, and no `requestAnimationFrame` loop anywhere.**
- **Everything stops when the tab is hidden.** `AcadStage` sets `data-still="yes"` and CSS pauses
  every animation beneath it.
- **`prefers-reduced-motion: reduce` switches every animation and transition off**, and the page
  still makes sense frozen: nothing is carried by movement alone. The rule names `.acad` itself as
  well as its descendants, because `.acad *` does not match `.acad::after`, which is where the one
  animation that never stops is drawn.
- **No `backdrop-filter` and no `filter` on anything that moves.** The design concept blurred the
  pass card's rotating sheen; a blur on a permanently rotating element is the most expensive thing
  a page can do and the first thing to stutter on a cheap Android phone. A mask does the same job
  for nothing.

The beacon on the code screen needs 54px above it, not 30: the two rings it throws out grow to 1.7
times its size, which reaches about 26px past the top of the box, and at 30px they touched the step
rail. The rule is to space things from where an animation reaches, not from where the box is.

The animations that exist, all of them: the stage glow drifting, the eyebrow dot pulsing, the
beacon's two rings on the code screen, the pass card sheen turning, the cell being watched blinking,
one shake when a code is refused, and the lift when a code is accepted.

---

## 8. The code boxes, in detail

Worth its own section because three separate faults lived here, and all three had the same cause:
a joined string loses **where** a digit was typed.

**A digit typed into a box that already has one.** The box reports two characters, `"27"`, because
on a phone the caret lands beside the old digit rather than replacing it. Treating anything longer
than one character as a pasted code is why typing one digit used to wipe the whole thing. Now three
or more characters at once count as a paste or an autofill; for two, whichever character is not the
old one is kept.

**After a wrong code**, the boxes empty and the cursor goes back to box 1. It used to stay where it
was, so the next digit landed in the middle.

**A digit typed into box 3 while 1 and 2 are empty** stays in box 3. Joining `["","","7"]` gives
`"7"`, and `"7"` looks exactly like a digit in box 1.

Also: the boxes submit themselves the moment the sixth digit lands, and hand the finished code to
the page **as an argument**. The page's own copy of the code is one render behind at that moment,
so reading it from state there makes a full set of six digits fail with "please enter all 6
digits". There is a submit button as well, for Enter and for anyone who prefers it.

Only the first box carries `autocomplete="one-time-code"`. On all six, some browsers offer the code
six times over.

---

## 9. Forms and errors

**Every step is a real `<form>` with a real submit button.** Not a div with a click handler. Enter
works from any field, password managers recognise the step and offer to save, and a phone keyboard
shows Go instead of Return.

**An error names the box it is about.** `Result` from `src/lib/academy.ts` carries a `field`, one
of `name`, `email`, `password`, `code` or `form`. The page clears the message as soon as that box
is edited, because the moment somebody starts fixing it, it is no longer true. A `form` error is
about the submission as a whole and clears on any change.

**An error is red, carries a warning mark, and sets `aria-invalid` on its box.** Good news is green
and carries a tick. Never colour alone.

---

## 10. Accessibility, as built

- Contrast meets WCAG AA everywhere, checked by reading the computed colour of every run of text on
  every page and compositing it against what is actually behind it. 71 runs across four pages.
- **The one exception**, stated plainly: white text on the orange button is 2.95:1. That is the
  site's own button, `#f56e0f` with white text, used identically in `LeadForm`, `GizStrip`, the
  Footer and the blog. The Academy matches it on purpose. Reaching AA would mean a noticeably
  browner button here than everywhere else on dataleadafrica.com, so it is a decision about the
  whole site rather than about `/lms`. If the site ever darkens its buttons, `--acad-signal` and
  the `.acad-btn` gradient are the two places to change.
- Focus is always visible: a 2px orange outline with a 3px offset, never removed.
- Every decorative element is `aria-hidden`. Every icon is decoration; the words beside it always
  say the same thing.
- Done, current and locked differ by shape, not only colour.
- The step rail is announced in words. The watch tape is one `role="img"` with a sentence, rather
  than several hundred cells a screen reader would have to read out.
- Messages that appear after an action sit in an `aria-live="polite"` region.

---

## 11. Breakpoints

| Width | What changes |
| --- | --- |
| 980px | My learning stacks to one column |
| 920px | The account split stacks, and Watch, Check, Certify drops away so the headline, the line under it and the form carry the page |
| 700px | Course cards go to one column (Phase 4) |
| 560px | The stage's padding tightens |
| 480px | Cards lose side padding, code boxes shrink |

Phone width is not an afterthought on these pages: most learners will meet them on a phone, so
every screen in this phase was built and looked at at 390px as well as at 1360px.

---

## 12. What Phase 4 inherits

The bento grid on My learning is `repeat(12, minmax(0, 1fr))` with a 16px gap, and the two tiles
Phase 2 fills take 4 and 8 columns. The design concept's other tiles slot into the same grid:

| Tile | Columns | Needs |
| --- | --- | --- |
| Continue | 8 | The lesson a learner is part way through, and `WatchTape compact` |
| Bootcamp pass | 4 | Built |
| This week | 4 | **A new read only function: minutes watched per day.** See STATUS.md |
| Your courses | 8 | The learner's enrolments |
| Certificates | 12 | `lms_claim_course_certificate` and the existing certificate tables |

The lesson player from the concept is also Phase 4: the full width `WatchTape`, the outline with
done, current and locked states, and the gate that says when the lesson check opens and then lights
up the moment it does.

**No invented facts.** Example course names appear only where the concept marks them as examples,
behind the dashed `acad-example` pill, and never as real courses. Phase 2 ships none at all.
