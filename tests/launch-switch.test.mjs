// The launch switch: ACADEMY_PUBLIC in api/_seo-rules.js.
//
//   npm test
//
// WHY THIS TEST EXISTS. On 9 October the Academy reached the live site
// by accident, in a branch cut from the wrong place, and for three days
// dataleadafrica.com was offering a test course that anybody could sign
// up for and earn a real certificate from. The switch is what stops
// that happening again, and a switch nothing tests is a switch that is
// half wired.
//
// BOTH VALUES ARE REALLY TESTED, not just the one the file is set to
// today. The three tests that can be driven end to end (the sitemap and
// the edge HTML) are run twice: once against the real module, and once
// against a copy of the whole api/ folder with the one line rewritten
// to true. So the launch PR, which flips that line and nothing else, is
// already proven before it is written.
//
// The two React pieces (the band on /courses and the head tags the
// pages set) are checked by reading the source, because this project
// has no React test renderer and the brief for this round allows no new
// dependencies. Those assertions are written tightly enough to fail if
// the gate is removed, moved, or inverted.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const here = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");

const ORIGIN = "https://dataleadafrica.com";
const LMS_PATHS = ["/lms", "/lms/courses", "/lms/courses/stata-for-survey-data"];

// ---------------------------------------------------------------------
// A copy of api/ with the switch flipped
// ---------------------------------------------------------------------

/**
 * Copy the whole api/ folder to a temporary place, rewrite the one
 * constant, and return the modules from there.
 *
 * The whole folder, because academy-meta.js imports _academy-data.js
 * which imports _seo-rules.js, and all three have to be the flipped
 * copy. Rewriting one file in place and putting it back afterwards
 * would leave the repository broken if this test ever threw.
 */
async function apiWith(academyPublic) {
  const dir = mkdtempSync(join(tmpdir(), "launch-switch-"));
  cpSync(new URL("api/", here), join(dir, "api"), { recursive: true });

  const file = join(dir, "api", "_seo-rules.js");
  const before = readFileSync(file, "utf8");
  const want = `export const ACADEMY_PUBLIC = ${academyPublic};`;
  const after = before.replace(
    /export const ACADEMY_PUBLIC = (?:true|false);/,
    want,
  );
  assert.notEqual(
    after,
    before === after ? "unchanged" : before,
    "the ACADEMY_PUBLIC line was not found in api/_seo-rules.js, so this test is not testing anything",
  );
  assert.ok(after.includes(want), "could not rewrite the switch");
  writeFileSync(file, after);

  const url = (name) => pathToFileURL(join(dir, "api", name)).href;
  return {
    rules: await import(url("_seo-rules.js")),
    sitemap: await import(url("sitemap.js")),
    meta: await import(url("academy-meta.js")),
  };
}

// ---------------------------------------------------------------------
// The stubs. Same shape as tests/academy-meta.test.mjs.
// ---------------------------------------------------------------------

const SHELL = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>Data-Lead Africa</title>
<meta name="description" content="the site wide one" />
<link rel="canonical" href="https://dataleadafrica.com/" />
</head><body><div id="root"></div></body></html>`;

const COURSE = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "stata-for-survey-data",
  title: "STATA for survey data",
  summary: "Clean, label and analyse survey exports.",
  tool: "STATA",
  area: "Analysis",
  level: "Beginner",
  cover_code: "ST",
  price_kobo: 1000000,
  first_module_free: true,
  outcomes: ["Import a survey export"],
  audience: ["Analysts"],
  prerequisites: [],
  faq: [],
  seo_title: null,
  seo_description: null,
  published_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  module_count: 3,
  lesson_count: 12,
  quiz_count: 3,
  total_seconds: 5760,
  modules: [],
};

function useFetch() {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.endsWith("/index.html")) {
      return new Response(SHELL, { status: 200 });
    }
    if (href.includes("/rest/v1/rpc/")) {
      const name = href.split("/rest/v1/rpc/")[1];
      const body =
        name === "lms_public_catalogue"
          ? [COURSE]
          : name === "lms_public_course"
            ? [COURSE]
            : [];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (href.includes("/rest/v1/")) {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("", { status: 404 });
  };
  return () => {
    globalThis.fetch = original;
  };
}

const request = (path) =>
  new Request(`${ORIGIN}/api/academy-meta?path=${encodeURIComponent(path)}`, {
    headers: { host: "dataleadafrica.com", "x-forwarded-proto": "https" },
  });

// ---------------------------------------------------------------------
// 1. The switch itself
// ---------------------------------------------------------------------

test("the switch is one constant, in the one file both sides import", async () => {
  const src = read("api/_seo-rules.js");
  const hits = src.match(/export const ACADEMY_PUBLIC = (?:true|false);/g) || [];
  assert.equal(hits.length, 1, "ACADEMY_PUBLIC is declared more than once, or not at all");

  // And nowhere else. A second copy is a switch that can be half
  // flipped: the sitemap would start advertising pages that still say
  // noindex, which is worse than either state it sits between.
  for (const f of [
    "api/academy-meta.js",
    "api/sitemap.js",
    "api/_academy-data.js",
    "src/lib/site.ts",
    "src/components/AcademyBand/component.tsx",
    "src/pages/Academy/ui/PreviewNotice.tsx",
  ]) {
    assert.ok(
      !/ACADEMY_PUBLIC\s*=\s*(?:true|false)/.test(read(f)),
      `${f} declares its own value for ACADEMY_PUBLIC. There must be exactly one.`,
    );
  }

  const live = await import("../api/_seo-rules.js");
  assert.equal(typeof live.ACADEMY_PUBLIC, "boolean");
  assert.equal(
    live.PREVIEW_NOTICE,
    "Preview. The Academy is not open to the public yet.",
    "the preview sentence is not the one that was agreed",
  );
});

test("the comment says what the launch PR does, so nobody has to guess", () => {
  const src = read("api/_seo-rules.js");
  assert.ok(
    /THE LAUNCH PR FLIPS THIS ONE LINE TO true AND CHANGES NOTHING ELSE/.test(src),
    "the switch has no note saying it is the only line the launch PR touches",
  );
});

// ---------------------------------------------------------------------
// 2. The sitemap, at both values
// ---------------------------------------------------------------------

test("while it is false the sitemap lists no /lms address at all", async () => {
  const { sitemap } = await apiWith(false);
  const xml = sitemap.buildSitemap(ORIGIN, [COURSE]);

  assert.ok(!/\/lms/.test(xml), "the sitemap still advertises an Academy address");

  // And nothing else was lost. This is the half of the change that
  // would be expensive to get wrong: a sitemap that drops the blog
  // because the Academy is not ready would be a far worse mistake than
  // the one it is avoiding.
  for (const path of ["/", "/blog", "/courses", "/research", "/certifications"]) {
    assert.ok(
      xml.includes(`<loc>${ORIGIN}${path}</loc>`),
      `${path} fell out of the sitemap`,
    );
  }
});

test("while it is true the sitemap lists /lms, /lms/courses and every course", async () => {
  const { sitemap } = await apiWith(true);
  const xml = sitemap.buildSitemap(ORIGIN, [COURSE]);

  assert.ok(xml.includes(`<loc>${ORIGIN}/lms</loc>`));
  assert.ok(xml.includes(`<loc>${ORIGIN}/lms/courses</loc>`));
  assert.ok(xml.includes(`<loc>${ORIGIN}/lms/courses/${COURSE.slug}</loc>`));
  assert.ok(xml.includes("<lastmod>2026-10-01</lastmod>"), "the course lost its date");
});

test("the only difference between the two sitemaps is the Academy", async () => {
  const [off, on] = await Promise.all([apiWith(false), apiWith(true)]);
  const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  const a = locs(off.sitemap.buildSitemap(ORIGIN, [COURSE]));
  const b = locs(on.sitemap.buildSitemap(ORIGIN, [COURSE]));

  const added = b.filter((x) => !a.includes(x));
  const lost = a.filter((x) => !b.includes(x));

  assert.deepEqual(lost, [], "turning the Academy on removed pages from the sitemap");
  assert.deepEqual(added.sort(), [
    `${ORIGIN}/lms`,
    `${ORIGIN}/lms/courses`,
    `${ORIGIN}/lms/courses/${COURSE.slug}`,
  ]);
});

// ---------------------------------------------------------------------
// 3. The edge HTML for the three public paths, at both values
// ---------------------------------------------------------------------

test("while it is false all three public paths answer noindex", async () => {
  const { meta } = await apiWith(false);
  const restore = useFetch();
  try {
    for (const path of LMS_PATHS) {
      const res = await meta.default(request(path));
      const html = await res.text();
      assert.equal(res.status, 200, `${path} did not answer 200`);
      assert.ok(
        /<meta name="robots" content="noindex, follow" \/>/.test(html),
        `${path} was served to a crawler without noindex`,
      );
    }
  } finally {
    restore();
  }
});

test("while it is true none of the three carries noindex", async () => {
  const { meta } = await apiWith(true);
  const restore = useFetch();
  try {
    for (const path of LMS_PATHS) {
      const html = await (await meta.default(request(path))).text();
      assert.ok(
        !/name="robots"/.test(html),
        `${path} still says noindex with the Academy open`,
      );
    }
  } finally {
    restore();
  }
});

test("the canonical, the title and the share picture do not move when the switch flips", async () => {
  // noindex says "do not list this page". A canonical says "when you do
  // list it, this is its one address". If the switch moved the second,
  // every Academy address would change on launch day, which is the one
  // thing a canonical exists to prevent.
  const [off, on] = await Promise.all([apiWith(false), apiWith(true)]);
  const restore = useFetch();
  try {
    for (const path of LMS_PATHS) {
      const a = await (await off.meta.default(request(path))).text();
      const b = await (await on.meta.default(request(path))).text();
      const pick = (html, re) => (html.match(re) || [])[1] || "";

      for (const [what, re] of [
        ["canonical", /<link rel="canonical" href="([^"]+)"/],
        ["title", /<title>([^<]*)<\/title>/],
        ["description", /<meta name="description" content="([^"]*)"/],
        ["og:image", /<meta property="og:image" content="([^"]*)"/],
        ["og:url", /<meta property="og:url" content="([^"]*)"/],
      ]) {
        assert.equal(
          pick(a, re),
          pick(b, re),
          `${path} changes its ${what} when the switch flips. Only the robots tag may change.`,
        );
      }
    }
  } finally {
    restore();
  }
});

test("the preview sentence is never in the HTML a crawler reads", async () => {
  // The pages carry noindex while the switch is off, but a snippet can
  // still be shown for a page that is only linked to, and "Preview.
  // The Academy is not open to the public yet." is not a description of
  // anything. The notice is React only.
  const { meta, rules } = await apiWith(false);
  const restore = useFetch();
  try {
    for (const path of LMS_PATHS) {
      const html = await (await meta.default(request(path))).text();
      assert.ok(
        !html.includes(rules.PREVIEW_NOTICE),
        `${path} puts the preview sentence into the server rendered HTML`,
      );
    }
  } finally {
    restore();
  }
});

test("the preview sentence is never in the share picture", () => {
  // api/og.js draws the picture on the server from the course's own
  // title and cover. It must not read the notice, now or later: a
  // picture is cached for an hour and shared onwards for much longer,
  // so a "not open yet" picture would still be circulating after
  // launch day.
  const og = read("api/og.js");
  assert.ok(!/PREVIEW_NOTICE/.test(og), "api/og.js imports the preview sentence");
  assert.ok(!/ACADEMY_PUBLIC/.test(og), "api/og.js reads the launch switch");
  assert.ok(!/not open to the public/i.test(og), "the preview wording is in api/og.js");
});

// ---------------------------------------------------------------------
// 4. The band on /courses
// ---------------------------------------------------------------------

test("the band on /courses is gated on the switch, before the catalogue is asked", () => {
  const src = read("src/components/AcademyBand/component.tsx");

  assert.ok(
    /import \{ ACADEMY_PUBLIC \} from "\.\.\/\.\.\/lib\/site"/.test(src),
    "the band does not read the launch switch at all",
  );
  assert.ok(
    /if \(!ACADEMY_PUBLIC\) return null;/.test(src),
    "the band has no early return on the switch, so it can render while the Academy is shut",
  );
  assert.ok(
    /useEffect\(\(\) => \{\s*if \(!ACADEMY_PUBLIC\) return;/.test(src),
    "the band still asks Supabase for the catalogue while the Academy is shut",
  );

  // The order matters. The switch has to be checked before the count,
  // or a reader cannot tell which of the two hid the band, and a future
  // edit to the count would quietly take the switch with it.
  assert.ok(
    src.indexOf("if (!ACADEMY_PUBLIC) return null;") <
      src.indexOf("if (count === 0) return null;"),
    "the switch is checked after the count",
  );

  // It is still the only place the band is used, so gating it here
  // really does cover /courses.
  assert.ok(
    read("src/pages/Courses/page.tsx").includes("<AcademyBand />"),
    "the bootcamps page no longer renders the band, so this test is checking nothing",
  );
});

// ---------------------------------------------------------------------
// 5. The head tags the pages set once React starts
// ---------------------------------------------------------------------

test("all three public pages set noindex again after React starts", () => {
  // The edge function writes noindex into the HTML, and then React
  // replaces the head tags. A page that is noindex in the HTML and
  // indexable half a second later is worse than one that was never
  // marked, because the second state is the one a crawler that runs
  // JavaScript keeps.
  for (const f of [
    "src/pages/Academy/Landing/page.tsx",
    "src/pages/Academy/Courses/page.tsx",
    "src/pages/Academy/Course/page.tsx",
  ]) {
    const src = read(f);
    assert.ok(
      /ACADEMY_PUBLIC/.test(src),
      `${f} does not read the launch switch`,
    );
    assert.ok(
      /noindex=\{!ACADEMY_PUBLIC\}/.test(src),
      `${f} does not pass noindex to <Seo> while the Academy is shut`,
    );
    // The same words the edge function writes, or the tag changes
    // under a crawler that runs JavaScript. api/academy-meta.js writes
    // "noindex, follow"; <Seo> says "noindex, nofollow" unless told
    // otherwise, which is right for a page behind a sign in and wrong
    // for these three.
    assert.ok(
      /robots="noindex, follow"/.test(src),
      `${f} lets <Seo> write its default "noindex, nofollow", which disagrees with the HTML the edge function already sent`,
    );
    // The canonical stays, so the two sides still agree about the one
    // address of the page.
    assert.ok(
      /canonicalPath=/.test(src),
      `${f} lost its canonicalPath`,
    );
  }
});

// ---------------------------------------------------------------------
// 6. The notice
// ---------------------------------------------------------------------

test("the notice is on every /lms page, from one place", () => {
  const router = read("src/pages/Academy/router.tsx");
  assert.ok(
    /import PreviewNotice from "\.\/ui\/PreviewNotice"/.test(router),
    "the router does not import the notice",
  );
  // Inside page(), which every single route goes through. Eleven
  // separate copies would mean eleven places to forget it.
  assert.ok(
    /function page\(element: React\.ReactNode\) \{[\s\S]*?<PreviewNotice \/>/.test(router),
    "the notice is not inside the page() wrapper, so some /lms pages will not have it",
  );
  const routeCount = (router.match(/<Route\b/g) || []).length;
  const wrapped = (router.match(/element=\{page\(/g) || []).length;
  assert.equal(
    wrapped,
    routeCount,
    "an Academy route does not go through page(), so it would have no notice",
  );
});

test("the notice is one line, light, and has no close button", () => {
  const tsx = read("src/pages/Academy/ui/PreviewNotice.tsx");
  const css = read("src/pages/Academy/ui/PreviewNotice.css");

  assert.ok(/if \(ACADEMY_PUBLIC\) return null;/.test(tsx),
    "the notice does not disappear when the Academy opens");
  assert.ok(/PREVIEW_NOTICE/.test(tsx), "the notice does not use the one agreed sentence");
  // Comments stripped first: this file's own notes explain WHY there is
  // no close button, and the words "close" and "button" are in them.
  const code = tsx.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/button|onClick|dismiss|close/i.test(code),
    "the notice has a close button. A notice that can be dismissed is one a returning visitor no longer sees.");

  // Light, and slim. Not the Academy's orange: a coloured banner reads
  // as a promotion rather than a note.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(/--acad-surface-2/.test(rules), "the notice is not on the light surface colour");
  assert.ok(!/--acad-signal\b/.test(rules), "the notice uses the signal orange");
  assert.ok(!/position:\s*(fixed|sticky)/.test(rules),
    "the notice is pinned to the screen, so it would sit over the lesson player's controls");
});

test("the robots tag the pages set is word for word the one the edge sent", async () => {
  // The edge half, read from the real response.
  const { meta } = await apiWith(false);
  const restore = useFetch();
  let fromEdge = "";
  try {
    const html = await (await meta.default(request("/lms"))).text();
    fromEdge = (html.match(/<meta name="robots" content="([^"]+)"/) || [])[1] || "";
  } finally {
    restore();
  }
  assert.equal(fromEdge, "noindex, follow", "the edge function no longer writes noindex, follow");

  // The React half, read from the source of all three pages.
  for (const f of [
    "src/pages/Academy/Landing/page.tsx",
    "src/pages/Academy/Courses/page.tsx",
    "src/pages/Academy/Course/page.tsx",
  ]) {
    const said = (read(f).match(/robots="([^"]+)"/) || [])[1] || "";
    assert.equal(
      said,
      fromEdge,
      `${f} sets a robots tag that does not match the one the edge function already wrote`,
    );
  }

  // And the component really does use it rather than ignoring the prop.
  const seo = read("src/components/Seo/component.tsx");
  assert.ok(
    /robots\.setAttribute\("content", robotsContent\)/.test(seo),
    "<Seo> still hardcodes the robots wording, so the prop does nothing",
  );
});
