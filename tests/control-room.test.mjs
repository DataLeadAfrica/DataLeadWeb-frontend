// The control room: the promises the brief names, checked against the
// source rather than against a screenshot.
//
//   npm test
//
// WHY THESE ARE SOURCE TESTS. Nearly everything the brief insists on is
// about what the staff side must NEVER do: a facilitator must never see
// a learner's name, a page must never read a table directly, the role
// must never come from the session. Those are not things a rendering
// test catches, because the way they go wrong is that somebody later
// adds one line and the page still looks perfect.
//
// What a browser is better at, this round checked in a browser: eleven
// pages at three widths, nothing scrolling sideways, the tables
// scrolling rather than clipping, the suppressed groups drawing no bar.
// Those runs are in the package's evidence.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const STUDIO = join(ROOT, "src/pages/Academy/Studio");

const read = (p) => readFileSync(join(ROOT, p), "utf8");

/** Source with its comments stripped, for "this must not appear" checks. */
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Every .tsx and .ts file in the control room. */
function studioFiles(dir = STUDIO, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) studioFiles(full, out);
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------
// Who is asking
// ---------------------------------------------------------------------

test("the role comes from the database, never from the session", () => {
  const lib = read("src/lib/studio.ts");
  assert.match(lib, /certDb\.rpc\("lms_my_role"\)/,
    "getMyRole does not ask the database");

  const guard = read("src/pages/Academy/Studio/RequireStaff.tsx");
  assert.match(guard, /getMyRole\(\)/, "the guard does not ask for the role");
  // A token says who somebody is and keeps saying it for an hour.
  // Somebody taken off the staff list at 10:00 would still hold an
  // administrator's token at 10:30.
  assert.ok(!/user_metadata|app_metadata|session\.role/.test(code(guard)),
    "the guard reads a role out of the session, which is an hour stale by design");
});

test("every control room page goes through the guard", () => {
  const pages = studioFiles().filter((f) => f.endsWith("/page.tsx"));
  assert.ok(pages.length >= 11, `expected at least 11 pages, found ${pages.length}`);
  for (const f of pages) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /RequireStaff/,
      `${f.replace(ROOT, "")} is not behind RequireStaff`);
  }
});

test("the pages only administrators may see say so", () => {
  // The brief's list: a facilitator sees no Learners, Staff,
  // Certificates, Settings, Popups or Health.
  for (const p of [
    "src/pages/Academy/Studio/Learners/page.tsx",
    "src/pages/Academy/Studio/Staff/page.tsx",
    "src/pages/Academy/Studio/Certificates/page.tsx",
    "src/pages/Academy/Studio/Settings/page.tsx",
    "src/pages/Academy/Studio/Popups/page.tsx",
    "src/pages/Academy/Studio/Health/page.tsx",
  ]) {
    assert.match(read(p), /RequireStaff adminOnly/,
      `${p} is not marked as administrators only`);
  }

  // And the four a facilitator does see are NOT marked.
  for (const p of [
    "src/pages/Academy/Studio/Overview/page.tsx",
    "src/pages/Academy/Studio/Courses/page.tsx",
    "src/pages/Academy/Studio/Paths/page.tsx",
    "src/pages/Academy/Studio/Reports/page.tsx",
  ]) {
    assert.ok(!/RequireStaff adminOnly/.test(read(p)),
      `${p} is closed to facilitators, and the brief says they build`);
  }
});

test("the rail hides an administrator item rather than greying it out", () => {
  const shell = read("src/pages/Academy/Studio/Shell.tsx");
  assert.match(shell, /ITEMS\.filter\(\(i\) => isAdmin \|\| !i\.adminOnly\)/,
    "the rail does not filter by role");
  // A disabled control tells somebody what they are missing and invites
  // them to ask why, about a page they were never meant to see.
  assert.ok(!/disabled.*adminOnly|adminOnly.*disabled/.test(code(shell)),
    "the rail greys out an administrator item instead of leaving it out");
});

// ---------------------------------------------------------------------
// Nothing reaches past the database's rules
// ---------------------------------------------------------------------

test("the staff pages do not read the tables the rules protect", () => {
  // The rule about who may see what lives in file 17. A page that
  // selects straight from one of these tables is a page that can be
  // wrong about it.
  const forbidden = [
    "lms_profiles",
    "lms_learner_profiles",
    "lms_courses",
    "lms_questions",
    "lms_options",
    "lms_entitlements",
    "lms_quiz_attempts",
    "certificates",
  ];
  for (const f of studioFiles()) {
    const src = code(readFileSync(f, "utf8"));
    for (const t of forbidden) {
      assert.ok(!new RegExp(`\\.from\\(["'\`]${t}["'\`]\\)`).test(src),
        `${f.replace(ROOT, "")} reads ${t} directly. Every rule about who may see what is in file 17.`);
    }
  }
});

test("the answer key leaves the server in one place and one place only", () => {
  // is_correct is the one piece of the whole system that a browser must
  // not be given for a learner, and must be given for a facilitator
  // writing the question. So exactly one function returns it.
  const sql = read("database/lms/17_control_room.sql");
  const i = sql.indexOf("create or replace function lms_studio_questions");
  assert.ok(i > 0, "lms_studio_questions is gone");
  const fn = sql.slice(i, sql.indexOf("\nend $$;", i));
  assert.match(fn, /'is_correct', o\.is_correct/);
  assert.match(fn, /That course is not yours|Only an administrator/,
    "lms_studio_questions returns the answers without checking who is asking");
});

// ---------------------------------------------------------------------
// The words the brief fixes
// ---------------------------------------------------------------------

test("it is a course exam, never a quiz", () => {
  for (const f of studioFiles()) {
    const src = code(readFileSync(f, "utf8"));
    // "quiz" survives in variable names that point at lms_quizzes,
    // which is the table's real name. What must not survive is the word
    // shown to a person.
    const shown = src.match(/>[^<>{]*\bquiz(zes)?\b[^<>{]*</gi) || [];
    assert.deepEqual(shown, [],
      `${f.replace(ROOT, "")} shows the word quiz to a person: ${shown.join(" | ")}`);
  }
});

test("a bank meter reads \"32 in the bank (30 needed)\"", () => {
  const builder = read("src/pages/Academy/Studio/Builder/page.tsx");
  assert.match(builder, /in the bank \(\$\{needed\} needed\)/,
    "the exam step does not use the brief's wording");
  const questions = read("src/pages/Academy/Studio/Questions/page.tsx");
  assert.match(questions, /in the bank \(\{course\.exam\.needed\} needed\)/);
});

test("British English: cannot, not can not or cant", () => {
  for (const f of studioFiles()) {
    const src = readFileSync(f, "utf8");
    for (const bad of ["can't", "won't", "doesn't", "isn't", "don't"]) {
      assert.ok(!src.includes(bad), `${f.replace(ROOT, "")} says ${bad}`);
    }
  }
});

test("no em or en dashes anywhere in the control room", () => {
  for (const f of studioFiles()) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/[–—]/.test(src), `${f.replace(ROOT, "")} has an em or en dash`);
  }
});

// ---------------------------------------------------------------------
// Badges are counted, never typed
// ---------------------------------------------------------------------

test("every nav badge is a number the database returned", () => {
  const shell = read("src/pages/Academy/Studio/Shell.tsx");
  // The badge is read from a counts object the page passes in, and
  // there is no literal number anywhere in the nav list.
  assert.match(shell, /const n = i\.count \? counts\[i\.count\] : undefined;/,
    "the rail works a badge out from something other than the counts it was given");
  const items = shell.slice(shell.indexOf("const ITEMS"), shell.indexOf("const GROUPS"));
  assert.ok(!/count:\s*\d/.test(items), "a nav badge is a typed number");
});

// ---------------------------------------------------------------------
// The publish panel and the nine checks
// ---------------------------------------------------------------------

test("the publish panel draws what the database returned", () => {
  const publish = read("src/pages/Academy/Studio/Builder/Publish.tsx");
  assert.match(publish, /course\.checks/,
    "the panel builds its own list of checks instead of using the database's");
  // There must be no second list of check names in the page: the page
  // and lms_publish_course would then be two opinions about whether a
  // course is ready.
  assert.ok(!/Has a title|Has at least one lesson/.test(code(publish)),
    "the publish panel has its own copy of the check names");
});

test("a facilitator gets Send for review and an administrator gets Publish", () => {
  const publish = read("src/pages/Academy/Studio/Builder/Publish.tsx");
  assert.match(publish, /Send for review/);
  assert.match(publish, /Publish now/);
  assert.match(publish, /isAdmin \?/, "the two roles are offered the same button");
  // And the checks are the same for both, because a facilitator who
  // cannot see why their course is not ready cannot fix it.
  const checksAt = publish.indexOf("<Checks");
  const roleAt = publish.indexOf("isAdmin ?", checksAt);
  assert.ok(checksAt > 0 && checksAt < roleAt,
    "the checks are drawn inside a role branch, so one role cannot see them");
});

// ---------------------------------------------------------------------
// The sensitive answers
// ---------------------------------------------------------------------

test("disability detail is behind a press, and only in the one record", () => {
  const drawer = read("src/pages/Academy/Studio/Learners/Drawer.tsx");
  assert.match(drawer, /showDetail/,
    "the drawer puts the disability detail on screen without being asked");
  assert.match(drawer, /NDPA 2023/, "the drawer does not say what this is");

  // It appears nowhere else: not in the list, not in a report, not in
  // the export.
  for (const f of [
    "src/pages/Academy/Studio/Learners/page.tsx",
    "src/pages/Academy/Studio/Reports/page.tsx",
  ]) {
    assert.ok(!/disability_detail/.test(read(f)),
      `${f} touches the disability detail, which belongs in one record at a time`);
  }
});

test("the reports show totals, and a suppressed group draws no bar", () => {
  const reports = read("src/pages/Academy/Studio/Reports/page.tsx");
  assert.match(reports, /const small = \/fewer\/i\.test\(r\.total\)/,
    "the report does not notice a suppressed group");
  assert.match(reports, /value=\{small \? 0 : n\}/,
    "a suppressed group still draws a bar, which puts the number back on the screen");
  // The total arrives as a string, so there is no number here to leak.
  assert.match(read("src/lib/studio.ts"), /\{ value: string; total: string \}/,
    "getWhoTotals types the total as a number");
});

test("an export is recorded before the file is handed over", () => {
  const learners = read("src/pages/Academy/Studio/Learners/page.tsx");
  const logAt = learners.indexOf("logExport(");
  const blobAt = learners.indexOf("createObjectURL");
  assert.ok(logAt > 0 && blobAt > 0 && logAt < blobAt,
    "the download is handed over before it is recorded, so a failed save would leave no trace of a download that happened");
});

// ---------------------------------------------------------------------
// The popup rules, said in the page as well as the database
// ---------------------------------------------------------------------

test("the popup page names the four places and refuses the rest", () => {
  const popups = read("src/pages/Academy/Studio/Popups/page.tsx");
  for (const place of ["landing", "courses", "course", "me"]) {
    assert.match(popups, new RegExp(`key: "${place}"`), `${place} is not offered`);
  }
  assert.ok(!/key: "lesson"|key: "exam"|key: "check"/.test(popups),
    "a lesson, a check or an exam is offered as a place for a popup");
  assert.match(popups, /Never over a lesson, a check or an exam/,
    "the page does not say the rule");
});

// ---------------------------------------------------------------------
// The site chrome
// ---------------------------------------------------------------------

test("the control room has no site header, and everything else does", () => {
  const chrome = read("src/pages/Academy/Studio/Chrome.tsx");
  assert.match(chrome, /pathname\.startsWith\(routes\.studio \+ "\/"\)/,
    "the chrome switch misses the pages under /lms/studio");
  assert.match(chrome, /pathname === routes\.studio/);

  const main = read("src/main.tsx");
  assert.match(main, /<SiteChrome which="header" \/>/);
  assert.match(main, /<SiteChrome which="footer" \/>/);
  assert.ok(!/<Header \/>|<Footer \/>/.test(main),
    "main.tsx still renders the header directly, so the switch is bypassed");
});

test("the control room is loaded on its own, like the Academy is", () => {
  const router = read("src/pages/Academy/Studio/router.tsx");
  const lazies = router.match(/lazy\(\(\) => import\(/g) || [];
  assert.ok(lazies.length >= 13,
    `expected every view to be lazy, found ${lazies.length}`);
  // A learner watching a lesson on a phone pays nothing for the page
  // that sets prices.
  assert.ok(!/^import \w+ from "\.\/(Overview|Learners|Reports)/m.test(router),
    "a view is imported eagerly");
});

test("the more specific address is routed before the one that would swallow it", () => {
  const router = read("src/pages/Academy/Studio/router.tsx");
  const q = router.indexOf("routes.studioQuestions");
  const b = router.indexOf("routes.studioBuilder");
  assert.ok(q > 0 && b > 0 && q < b,
    "/courses/:id is matched before /courses/:id/questions, so the questions page is unreachable");
});

test("every studio route is accounted for in the sitemap rules", () => {
  const routesFile = read("src/pages/routes.ts");
  const siteRoutes = read("api/_site-routes.js");
  const studio = [...routesFile.matchAll(/^\s*(studio\w*):/gm)].map((m) => m[1]);
  assert.ok(studio.length >= 13, `expected 13 studio routes, found ${studio.length}`);
  for (const name of studio) {
    assert.match(siteRoutes, new RegExp(`\\b${name}:`),
      `${name} is in routes.ts but nothing says whether it belongs in the sitemap`);
  }
});

// ---------------------------------------------------------------------
// The columns file 17 reads, against the schema snapshot
// ---------------------------------------------------------------------

test("every aliased column file 17 reads really exists", () => {
  // THIS TEST EXISTS BECAUSE THREE FUNCTIONS SHIPPED READING COLUMNS
  // THAT DO NOT EXIST. certificates has revoked, a boolean, and file 17
  // read revoked_at. mail_outbox has sent, a boolean, and file 17 read
  // sent_at. database/lms/schema-snapshot.md had said so since before
  // any of this was written, and I built against a local harness
  // instead of reading it.
  //
  // Nothing caught them because PL/pgSQL resolves a column name only
  // when a function RUNS, and every database test was about a refusal.
  // So this reads the snapshot and checks the names, and
  // file_17_tests.sql section 17 now calls every read function as well.
  // Two different ways of catching the same class of mistake, because
  // it is the kind that reaches a live page.
  //
  // TWO THINGS THE FIRST VERSION OF THIS TEST GOT WRONG, both of which
  // made it report faults that were not there:
  //  - it read the comments as well as the code, and matched the
  //    comment that explains the revoked_at bug. Third time a scanner
  //    of mine has found my own prose about a bug.
  //  - it assumed one alias means one table for the whole file. "pr" is
  //    lms_profiles in four places and programmes in one, and both of
  //    the columns it flagged exist on lms_profiles. So each alias is
  //    now resolved from the nearest from or join ABOVE the read, which
  //    is what Postgres does, and the test covers every table the
  //    snapshot documents rather than a list of four I typed.
  const snapshot = read("database/lms/schema-snapshot.md");
  const sql = read("database/lms/17_control_room.sql").replace(/^\s*--.*$/gm, "");

  // ONLY THE TABLES THE SNAPSHOT IS STILL AUTHORITATIVE FOR. It says of
  // itself that it was taken before file 10 was run, so its lms_
  // sections are missing every column files 10 to 17 add, and checking
  // against them reports two dozen faults that are not there.
  //
  // What it is still right about are the tables it marks "predates the
  // Academy": the certification system's own, which no Academy file
  // touches. Those are the four in the review (certificates,
  // participants, programmes, mail_outbox) and three more, and this
  // reads the marker rather than a list I typed, so another one added
  // to the snapshot is covered without anybody remembering to.
  //
  // The lms_ tables are covered a different way, because their truth is
  // files 01 to 17 and not this snapshot: file_17_tests.sql section 17
  // calls every read function in file 17 against a real database, which
  // is what makes a wrong column name fail.
  const known = new Map();
  for (const m of snapshot.matchAll(/^### (\w+)([^\n]*)([\s\S]*?)(?=^### |\Z)/gm)) {
    if (!/predates the Academy/.test(m[2])) continue;
    known.set(m[1], new Set([...m[3].matchAll(/^\| `(\w+)`/gm)].map((c) => c[1])));
  }
  assert.ok(known.size >= 5,
    `expected the snapshot to mark at least five tables as predating the Academy, found ${known.size}`);
  for (const t of ["certificates", "participants", "programmes", "mail_outbox"]) {
    assert.ok(known.has(t), `the snapshot no longer marks ${t} as predating the Academy`);
  }

  // RESOLVED PER STATEMENT, not by the nearest binding above the read.
  // In SQL the select list is written ABOVE the from clause, so a column
  // is routinely read before the join that binds its alias. Scanning
  // backwards for the binding therefore picks up whatever bound that
  // alias in the previous function, which is how "pr.full_name" came to
  // be reported against programmes when it belongs to lms_profiles two
  // statements further down.
  //
  // A statement is the unit Postgres resolves names in, so that is the
  // unit here: split on the semicolons, and inside each piece let its
  // own from and join clauses say what every alias means.
  const blanked = sql.replace(/'(?:[^']|'')*'/g, (s) => " ".repeat(s.length));
  const RESERVED = new Set(["on", "as", "is", "or", "no"]);
  const bad = [];
  let seen = 0;

  for (const stmt of blanked.split(";")) {
    const binds = new Map();
    for (const m of stmt.matchAll(/\b(?:from|join)\s+(\w+)\s+(?:as\s+)?([a-z]{1,3})\b(?!\s*\()/g)) {
      if (!RESERVED.has(m[2])) binds.set(m[2], m[1]);
    }
    if (!binds.size) continue;
    for (const m of stmt.matchAll(/\b([a-z]{1,3})\.(\w+)/g)) {
      const table = binds.get(m[1]);
      if (!table || !known.has(table)) continue;   // not an alias, or a table the snapshot does not cover
      seen += 1;
      if (!known.get(table).has(m[2])) bad.push(`${table}.${m[2]} (written as ${m[1]}.${m[2]})`);
    }
  }

  // Fifteen reads of nine distinct columns, measured today. The floor is
  // lower than that so ordinary editing does not trip it, but high
  // enough that a regex of mine quietly matching nothing fails here
  // rather than passing with an empty list, which is how a scanner
  // comes to look like a clean bill of health.
  //
  // mail_outbox is read WITHOUT an alias ("from mail_outbox where not
  // sent"), so it is not in that fifteen. The next test names it
  // directly, which is what covers the sent_at bug.
  assert.ok(seen >= 12,
    `only ${seen} reads of the certification tables were checked, so this test is not looking at `
      + "the code it is supposed to be looking at");

  assert.deepEqual(
    [...new Set(bad)].sort(),
    [],
    "file 17 reads columns that schema-snapshot.md does not list. PL/pgSQL only checks a column "
      + "name when the function runs, so these would have reached a live page:\n  " + bad.join("\n  "),
  );
});

test("the two columns that were wrong are now right", () => {
  // Named, so that if somebody ever puts them back the failure says
  // which mistake it is rather than only that a column is unknown.
  const sql = read("database/lms/17_control_room.sql");
  const code = sql.replace(/^\s*--.*$/gm, "");
  assert.ok(!/ct\.revoked_at/.test(code),
    "certificates.revoked_at does not exist. The column is revoked, a boolean.");
  assert.ok(!/mail_outbox[\s\S]{0,120}sent_at/.test(code),
    "mail_outbox.sent_at does not exist. The column is sent, a boolean.");
  assert.match(code, /ct\.revoked\b/, "the certificate list no longer reads the revoked flag at all");
  assert.match(code, /from mail_outbox where not sent/, "the health page no longer counts unsent mail");
});

// ---------------------------------------------------------------------
// The undo drops everything file 17 creates
// ---------------------------------------------------------------------

test("the undo drops every function file 17 creates", () => {
  // DERIVED, NOT TYPED. The undo had six functions missing and one
  // dropped with the wrong number of arguments, because the list was
  // written by hand and step 3b was added after it. A list somebody
  // maintains is a list that goes out of date; this one is read off
  // file 17 every time the tests run.
  const sql = read("database/lms/17_control_room.sql");
  const undo = read("database/lms/17_undo.sql");

  // Three are REPLACED rather than added, and the undo writes the
  // original back out in full instead of dropping it. Dropping those
  // would leave the site without a publish function at all, which is
  // the academy-6a review's third finding.
  const RESTORED = new Set(["lms_publish_course", "lms_unpublish_course", "lms_guard_lesson"]);

  const created = new Set(
    [...sql.matchAll(/create or replace function (lms_\w+)\s*\(/g)].map((m) => m[1]),
  );
  assert.ok(created.size > 40, `expected file 17 to create many functions, found ${created.size}`);

  const missing = [...created]
    .filter((n) => !RESTORED.has(n))
    .filter((n) => !new RegExp(`drop function if exists ${n}\\s*\\(`).test(undo))
    .sort();

  assert.deepEqual(missing, [],
    "17_undo.sql does not drop these, so they survive the undo and the next run of file 17 may "
      + "fail on a return type it cannot change:\n  " + missing.join("\n  "));

  // And the three that are restored really are written back out, rather
  // than simply left alone.
  for (const n of RESTORED) {
    assert.match(undo, new RegExp(`create or replace function ${n}\\b`),
      `${n} is replaced by file 17 but the undo does not write the original back out`);
  }
});

test("the undo drops lms_save_popup with the number of arguments it has", () => {
  // It was dropped with thirteen. The function takes fourteen, so the
  // drop matched nothing and the function survived every undo. An
  // argument count is the one part of a drop that fails silently.
  const sql = read("database/lms/17_control_room.sql");
  const undo = read("database/lms/17_undo.sql");

  const count = (args) => (args.trim() ? args.split(/,(?![^(]*\))/).length : 0);

  const made = /create or replace function lms_save_popup\s*\(([\s\S]*?)\)\s*\nreturns/.exec(sql);
  const dropped = /drop function if exists lms_save_popup\s*\(([^)]*)\)/.exec(undo);
  assert.ok(made && dropped, "lms_save_popup is missing from one of the two files");
  assert.equal(count(dropped[1]), count(made[1]),
    `the undo drops lms_save_popup with ${count(dropped[1])} arguments and it has ${count(made[1])}`);
});

// ---------------------------------------------------------------------
// The small-screen rules
// ---------------------------------------------------------------------

test("the rail is hidden below 1100, and the rule can win", () => {
  // IT DID NOT WIN. The hide rule was written before the rail's own
  // rule, both were one class strong, and the later one took it. On a
  // phone the rail covered the whole screen and stayed there, sticky
  // and opaque, and the page underneath was never seen.
  //
  // Nothing caught it: the sideways scroll check passed, because a
  // panel ON TOP of the page does not make the page wider, and the
  // screenshots were full page, which stretches the viewport until a
  // 100vh sticky element no longer covers anything.
  const css = read("src/pages/Academy/Studio/control-room.css");

  // Measure the DECLARATION, not the @media opener. Searching for the
  // opener finds the first "@media (max-width: 1100px)" in the file,
  // which is hundreds of lines above the rail, and reports a fault that
  // is not there.
  const hideAt = css.search(/\.acad \.stu \.stu__rail \{\s*display: none/);
  const showAt = css.search(/^\.stu__rail \{/m);
  assert.ok(hideAt > 0, "nothing hides the rail below 1100");
  assert.ok(showAt > 0, "the rail has no main rule");
  assert.ok(hideAt > showAt,
    "the rule that hides the rail comes BEFORE the rule that shows it. Same strength, later wins, "
      + "so the rail stays on screen and covers the page on every phone.");

  // And it is stronger as well as later, so moving a block cannot
  // silently bring the fault back.
  assert.match(css, /\.acad \.stu \.stu__rail \{\s*display: none/,
    "the hide rule is not stronger than the show rule, only later");
});

test("the small search button is shown on a phone, not hidden by a later rule", () => {
  // The same cascade mistake, in the same file, found by a scan rather
  // than by chance: the base rule sat after the media query that turns
  // the button on, so there was no way to open the command bar on a
  // phone at all.
  const css = read("src/pages/Academy/Studio/control-room.css");
  // Anchored, so this reads the BASE rule. Unanchored it matches
  // ".acad .stu .stu__findsmall" inside the media query first, which
  // does set display, on purpose.
  const base = /^\.stu__findsmall \{([\s\S]*?)\}/m.exec(css);
  assert.ok(base, ".stu__findsmall has no rule");
  assert.ok(!/display\s*:/.test(base[1]),
    ".stu__findsmall sets display in its base rule, which comes after the media query and wins");
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.acad \.stu \.stu__findsmall \{\s*display: grid/,
    "nothing shows the small search button below 760");
});

test("every tab label is the same size, including the one that is a button", () => {
  // academy.css has ".acad :where(button, input) { font: inherit }".
  // :where() adds nothing, so that rule is one class strong, exactly
  // like a bare .stu__tab, and a tie is settled by whichever stylesheet
  // the bundler put first. Four tabs were links at 10.5px and the fifth,
  // a button, inherited the body's 15px.
  const css = read("src/pages/Academy/Studio/control-room.css");
  assert.match(css, /\.acad \.stu \.stu__tab \{[\s\S]*?font: 400 10\.5px/,
    "the tab font is set at a strength that a tie can beat");
  assert.ok(!/^\.stu__tab \{/m.test(css),
    "there is still a one-class .stu__tab rule, which the button rule can tie with");
});

test("the builder byline leaves out the author when there is no author", () => {
  // IT SAID "BUILT BY SOMEBODY". created_by is empty on every course
  // that already exists, so that is what the header would have read on
  // all of them. The word came from a fallback meant for a missing name
  // and it read as though a person called Somebody had built the course.
  // code(), NOT the raw file. The comment above the fix in page.tsx
  // quotes the words "BUILT BY SOMEBODY" to say what the bug was, and
  // reading the raw file finds my own explanation and calls it the bug.
  // That is the fourth time a scanner of mine has done this, and the
  // helper to avoid it was already sitting at the top of this file.
  const page = code(read("src/pages/Academy/Studio/Builder/page.tsx"));
  assert.ok(!/somebody/i.test(page),
    'the builder still has a "somebody" fallback for the author');
  assert.match(page, /course\.built_by \? `built by \$\{course\.built_by\}` : ""/,
    "the byline no longer leaves the built by clause out when there is no name");
  // The whole clause is dropped rather than replaced with a blank one,
  // so the eyebrow cannot end in a stray separator either.
  assert.match(page, /\.filter\(Boolean\)\s*\n?\s*\.join\(" . "\)/,
    "the empty clause is no longer filtered out before the parts are joined");
});

test("show-test-course.sql says at the top that file 17 will refuse it", () => {
  // MEASURED ON A REAL BUILD rather than reasoned about: publishing now
  // runs the nine checks and the Phase 4 test course fails three of
  // them. That is the checks working, but somebody running the file
  // after file 17 and seeing "published | f" needs to be told so in the
  // file rather than working it out.
  const sql = read("database/lms/show-test-course.sql");
  const head = sql.slice(0, 3600);

  // Retired on 15 October 2026. The Phase 4 course is out of date since
  // the restructure, and the first real course built in the control room
  // is the live test instead. The file is kept rather than deleted so
  // anybody who finds it named in an older document can see why it
  // stopped, which means the first thing it says has to be that.
  assert.match(head, /SUPERSEDED\. DO NOT RUN THIS\./,
    "show-test-course.sql does not say at the top that it is retired");
  assert.match(head, /first real course built in the control room/,
    "it does not say what replaced it");
  assert.match(head, /17/, "the header does not mention file 17");
  assert.match(head, /refuse/i, "the header does not say the last line will be refused");
  for (const reason of [/lesson check/i, /certificate programme/i, /exam/i]) {
    assert.match(head, reason, `the header does not name which of the nine checks fail: ${reason}`);
  }
  assert.match(head, /before file 17/i, "the header does not say when to run it instead");
});

test("the top bar's search switches at 1024, scoped to the bar itself", () => {
  // THE BAR WAS 161px TALL AT 768. The labelled find button stayed in the
  // bar from 761 up with no room for its label, the label wrapped, and
  // the bar's height is the label's height. 161 at 768, 113 at 820, 89 at
  // 900, against the 60 it should be. iPad portrait is 768 and 820, so
  // this was most tablets held upright.
  //
  // 1024 is measured, not chosen. Dr Ayoola said below 1000 and that is
  // what I built first; 1001 then measured 89px, still wrapped. The label
  // needs 306px on one line and the button only gives it that from 1024.
  const css = read("src/pages/Academy/Studio/control-room.css");

  assert.match(css, /@media \(max-width: 1023px\)[\s\S]{0,200}?\.acad \.stu \.stu__top \.stu__find \{\s*display: none/,
    "the top bar's find button is not hidden below 1024");
  assert.match(css, /@media \(min-width: 1024px\)[\s\S]{0,200}?\.acad \.stu \.stu__findsmall \{\s*display: none/,
    "the round button is not hidden from 1024 up, so there would be two search controls");

  // SCOPED TO .stu__top. That class is also the search box on the
  // Courses, Learners and Certificates pages. The old rule said plain
  // .stu__find, so on a phone those were hidden too and an administrator
  // could not filter the learner list or the certificate list at all.
  // That was already true on live. An unscoped rule here would have
  // extended it to every tablet.
  const hides = [...css.matchAll(/([^\n{]*\.stu__find)\s*\{[^}]*display:\s*none/g)].map((m) => m[1].trim());
  for (const sel of hides) {
    assert.ok(/\.stu__top\b/.test(sel),
      `"${sel}" hides .stu__find without naming .stu__top, which also hides the page search boxes `
        + "on Courses, Learners and Certificates");
  }

  // And the hide is stated after the base rule as well as being
  // stronger, which is the lesson from the rail.
  const baseAt = css.search(/^\.stu__find \{/m);
  const hideAt = css.search(/\.acad \.stu \.stu__top \.stu__find \{\s*display: none/);
  assert.ok(baseAt > 0 && hideAt > baseAt,
    "the rule hiding the top bar's find button comes before the rule that draws it");
});

test("the search label can never take a second line", () => {
  // The backstop, not the fix. The round button below 1024 is the fix.
  // This is what stops the bar growing again if the wording ever changes,
  // and a browser run checks it is never actually reached: the label is
  // one full line at 1024 and every width above it, so the ellipsis does
  // not show.
  const css = read("src/pages/Academy/Studio/control-room.css");
  const rule = /\.stu__findlabel \{([^}]*)\}/.exec(css);
  assert.ok(rule, "the search label has no rule of its own, so it is free to wrap");
  assert.match(rule[1], /white-space: nowrap/, "the search label can still wrap onto two lines");
  assert.match(rule[1], /text-overflow: ellipsis/, "a label too long would be cut off with no sign of it");
  // min-width: 0 is the part that is easy to leave out. A flex child will
  // not shrink below its content without it, so overflow and
  // text-overflow would never come into play and the rule would look
  // right while doing nothing.
  assert.match(rule[1], /min-width: 0/,
    "without min-width: 0 the label will not shrink, so nowrap pushes the bar wider instead");

  // And the label really is in an element that those rules can reach.
  assert.match(read("src/pages/Academy/Studio/Shell.tsx"),
    /<span className="stu__findlabel">/,
    "the label is a bare text node again, which no rule can stop from wrapping");
});

// ---------------------------------------------------------------------
// My learning: the way in, and the person's own name
// ---------------------------------------------------------------------

test("a staff member has a way into the control room that is not the address bar", () => {
  // A facilitator signing in landed on My learning with no link to
  // /lms/studio anywhere. The only way in was knowing the address and
  // typing it, which is not a thing to ask of somebody.
  const page = read("src/pages/Academy/Me/page.tsx");
  assert.match(page, /role === "facilitator" \|\| role === "admin"/,
    "My learning does not check for a staff role");
  assert.match(page, /className="acad-tile acad-me__studio" to=\{routes\.studio\}/,
    "there is no link to the control room on My learning");

  // THE ROLE COMES FROM THE SYNC THAT HAS ALREADY RUN, not from a second
  // call. lms_my_role used to be asked for here as well, and the two
  // answers could disagree for a moment, so the page showed one thing
  // and swapped to the other. academy.ts says so in a comment and this
  // keeps it true.
  assert.match(page, /useAccess\(\)/, "My learning no longer uses the access sync");
  assert.ok(!/getMyRole|lms_my_role/.test(code(page)),
    "My learning asks for the role a second time, which the sync has already answered");
});

test("the control room link is drawn, not enforced, and the pages still check", () => {
  // The link is a convenience. If it ever showed for somebody it should
  // not, every page behind it asks the database again, so they would be
  // refused at the door rather than let in.
  const guard = read("src/pages/Academy/Studio/RequireStaff.tsx");
  assert.match(guard, /getMyRole\(\)/,
    "the control room no longer asks the database who the caller is");
});

test("no page invents a name out of the email address", () => {
  // Somebody signed up as a.samuel@example.com was greeted as "a.samuel"
  // and their account card said that was their name. A made up name
  // shown as a real one is worse than no name: there is nothing to tell
  // the person that anything needs fixing.
  const lib = code(read("src/lib/academy.ts"));
  assert.ok(!/email\.split\("@"\)\[0\]/.test(lib),
    'the session still falls back to the email address for a name');
  assert.match(lib, /fullName: \(meta\.full_name \?\? ""\)\.trim\(\),/,
    "the session name is no longer just the saved name");

  // And every reader copes with it being empty.
  assert.match(read("src/pages/Academy/Studio/Shell.tsx"), /name \|\| "Signed in"/,
    "the control room header has no answer for somebody with no name saved");
  assert.match(read("src/pages/Academy/Me/page.tsx"), /firstName \? `\$\{greeting\(\)\}, \$\{firstName\}` : "My learning"/,
    "My learning has no answer for somebody with no name saved");
});

test("saving a name writes the profile first and the account metadata second", () => {
  // Two writes, because two different things read the name: the staff
  // pages read lms_profiles, and getSession reads the account metadata.
  //
  // The ORDER matters. The function validates, so if it refuses, the
  // metadata must not already hold a name the database would not accept.
  const lib = read("src/lib/academy.ts");
  const fn = /export async function setMyName[\s\S]*?\n}/.exec(lib);
  assert.ok(fn, "there is no setMyName");

  const rpcAt = fn[0].indexOf('rpc("lms_set_my_name"');
  const metaAt = fn[0].indexOf("auth.updateUser");
  assert.ok(rpcAt > 0, "setMyName does not call lms_set_my_name");
  assert.ok(metaAt > 0, "setMyName does not update the account metadata");
  assert.ok(rpcAt < metaAt,
    "setMyName writes the account metadata BEFORE the database has accepted the name, so a name "
      + "the database refuses could still end up showing");

  // The server's own refusal is shown, not a rewrite of it.
  assert.match(fn[0], /saved\.error\.message/,
    "setMyName replaces the server's reason for refusing with wording of its own");
});
