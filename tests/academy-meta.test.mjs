// Tests for the Academy edge functions, run in plain Node with a stubbed
// global fetch. No network, no Supabase, no Vercel.
//
//   node --test tests/
//
// The five cases the brief asks for are the five contexts below: a normal
// course, a draft one, an unknown slug, Supabase being slow, and Supabase
// being down. The rest are the rules that are easy to get wrong and
// impossible to notice: the canonical dropping a query string, a 404
// really being a 404, and the lengths of what Google shows.

import { test } from "node:test";
import assert from "node:assert/strict";

import handler, {
  readRoute,
  isoDuration,
  landingWords,
  plural,
} from "../api/academy-meta.js";
import {
  clip,
  asLength,
  asNaira,
  courseTitle,
  courseDescription,
  siteUrl,
  siteAsset,
  LANDING,
} from "../api/_academy-data.js";
import { buildSitemap } from "../api/sitemap.js";

const ORIGIN = "https://dataleadafrica.com";

const SHELL = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Data-Lead Africa</title>
<meta name="description" content="the site wide one" />
<link rel="canonical" href="https://dataleadafrica.com/" />
<meta property="og:title" content="Data-Lead Africa" />
<meta property="og:url" content="https://dataleadafrica.com/" />
<meta name="twitter:title" content="Data-Lead Africa" />
</head>
<body><div id="root"></div><script src="/assets/index.js"></script></body>
</html>`;

const COURSE = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "stata-for-survey-data",
  title: "STATA for survey data",
  summary: "Clean, label and analyse survey exports, then build the tables your report needs.",
  tool: "STATA",
  area: "Analysis",
  level: "Beginner",
  cover_code: "ST",
  price_kobo: 1000000,
  first_module_free: true,
  outcomes: ["Import a survey export", "Fix skipped answers", "Build clean tables"],
  audience: ["Researchers working with survey data"],
  prerequisites: ["No STATA experience needed"],
  faq: [{ question: "Do I need STATA?", answer: "For the practice files, yes." }],
  seo_title: null,
  seo_description: null,
  published_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-05T09:00:00Z",
  module_count: 3,
  lesson_count: 12,
  quiz_count: 2,
  total_seconds: 5760,
  modules: [
    {
      position: 1,
      title: "Getting your data in",
      summary: "",
      seconds: 1980,
      lessons: 4,
      quizzes: 1,
      free: true,
      lesson_list: [
        { position: 1, title: "Opening a dataset", type: "video", seconds: 380 },
        { position: 2, title: "Variables and labels", type: "video", seconds: 465 },
      ],
    },
  ],
};

// ----------------------------------------------------------- the stubs

function request(path, { headers } = {}) {
  return new Request(`${ORIGIN}/api/academy-meta?path=${encodeURIComponent(path)}`, {
    headers: { host: "dataleadafrica.com", "x-forwarded-proto": "https", ...(headers || {}) },
  });
}

/** Replaces global fetch: the shell always answers, Supabase behaves as told. */
function useFetch({
  rpc,
  delayMs = 0,
  down = false,
  shell = SHELL,
  status = 200,
  body = null,
  rest = null,
}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const href = String(url);
    if (href.endsWith("/index.html")) {
      return new Response(shell, { status: 200, headers: { "Content-Type": "text/html" } });
    }
    if (href.includes("/rest/v1/rpc/")) {
      if (down) throw new TypeError("fetch failed");
      if (delayMs > 0) {
        // Honour the abort signal, the way a real fetch does. Without
        // this the timeout would be tested against something that
        // cannot time out.
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, delayMs);
          const signal = options && options.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              clearTimeout(t);
              reject(new DOMException("aborted", "AbortError"));
            });
          }
        });
      }
      if (status !== 200) {
        // A paused or broken project answers with a status and usually
        // not JSON. supabase-js turns 500 to 599 into a retryable error.
        return new Response(body === null ? "" : body, { status });
      }
      const name = href.split("/rest/v1/rpc/")[1];
      return new Response(JSON.stringify(rpc(name, options)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // The plain table reads: lms_settings and lms_paths.
    if (href.includes("/rest/v1/")) {
      if (down) throw new TypeError("fetch failed");
      const table = href.split("/rest/v1/")[1].split("?")[0];
      const rows = rest ? rest(table) : [];
      return new Response(JSON.stringify(rows), {
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

const normalRpc = (name, options) => {
  if (name === "lms_public_catalogue") return [COURSE];
  if (name === "lms_public_course") {
    const body = JSON.parse(options.body);
    return body.p_slug === COURSE.slug ? [COURSE] : [];
  }
  return [];
};

// ================================================= reading the address

test("the three addresses are recognised, with or without a trailing slash", () => {
  assert.equal(readRoute("/lms").kind, "landing");
  assert.equal(readRoute("/lms/").kind, "landing");
  assert.equal(readRoute("/lms/courses").kind, "catalogue");
  assert.equal(readRoute("/lms/courses/").kind, "catalogue");
  assert.deepEqual(readRoute("/lms/courses/stata-for-survey-data"), {
    kind: "course",
    slug: "stata-for-survey-data",
  });
  assert.equal(readRoute("/lms/me").kind, "other");
  assert.equal(readRoute("/lms/courses/a/b").kind, "other");
});

// ================================================== 1. a normal course

test("a published course: 200, its own title, and its content in the HTML", async () => {
  const restore = useFetch({ rpc: normalRpc });
  try {
    const res = await handler(request("/lms/courses/stata-for-survey-data"));
    assert.equal(res.status, 200);
    const html = await res.text();

    assert.match(html, /<title>Learn STATA for survey data Online \| Data-Lead Academy<\/title>/);
    assert.match(
      html,
      /<link rel="canonical" href="https:\/\/dataleadafrica\.com\/lms\/courses\/stata-for-survey-data" \/>/,
    );
    assert.doesNotMatch(html, /<title>Data-Lead Africa<\/title>/);
    assert.doesNotMatch(html, /canonical" href="https:\/\/dataleadafrica\.com\/"/);

    // The copy a crawler reads, inside #root.
    assert.match(html, /<div id="root"><nav>/);
    assert.match(html, /<h1>STATA for survey data<\/h1>/);
    assert.match(html, /Opening a dataset/);
    assert.match(html, /Variables and labels/);
    assert.match(html, /Import a survey export/);

    assert.match(html, /og:image" content="https:\/\/dataleadafrica\.com\/api\/og\?course=stata-for-survey-data"/);
    assert.equal(res.headers.get("Cache-Control"), "public, s-maxage=300, stale-while-revalidate=86400");
  } finally {
    restore();
  }
});

test("the course markup is a Course and a BreadcrumbList, and nothing invented", async () => {
  const restore = useFetch({ rpc: normalRpc });
  try {
    const html = await (await handler(request("/lms/courses/stata-for-survey-data"))).text();
    const m = html.match(/<script type="application\/ld\+json" data-edge="1">([\s\S]*?)<\/script>/);
    assert.ok(m, "there is a JSON-LD block");
    const data = JSON.parse(m[1].replace(/\\u003c/g, "<"));
    assert.equal(data.length, 2);

    const [course, crumbs] = data;
    assert.equal(course["@type"], "Course");
    assert.equal(course.name, "STATA for survey data");
    assert.equal(course.inLanguage, "en");
    assert.equal(course.educationalLevel, "Beginner");
    assert.equal(course.timeRequired, "PT1H36M");
    assert.equal(course.offers.priceCurrency, "NGN");
    assert.equal(course.offers.price, "10000");
    assert.equal(course.provider.name, "Data-Lead Academy");

    // Nothing we do not measure.
    assert.equal(course.aggregateRating, undefined);
    assert.equal(course.review, undefined);

    assert.equal(crumbs["@type"], "BreadcrumbList");
    assert.equal(crumbs.itemListElement.length, 3);
    assert.equal(crumbs.itemListElement[2].name, "STATA for survey data");

    // Google retired FAQ rich results, and the brief says not to add it.
    assert.doesNotMatch(html, /FAQPage/);
  } finally {
    restore();
  }
});

// ================================================= 2 and 3. draft, unknown

for (const [label, slug] of [
  ["a draft course", "a-draft-course"],
  ["an unknown slug", "no-such-course"],
]) {
  test(`${label}: a real 404 and noindex, never a 200`, async () => {
    const restore = useFetch({ rpc: normalRpc });
    try {
      const res = await handler(request(`/lms/courses/${slug}`));
      assert.equal(res.status, 404, "a soft 404 keeps the address in the index");
      const html = await res.text();
      assert.match(html, /<meta name="robots" content="noindex, follow" \/>/);
      assert.match(html, /<h1>Course not found<\/h1>/);
      // The canonical points at the catalogue, not at the missing page.
      assert.match(html, /canonical" href="https:\/\/dataleadafrica\.com\/lms\/courses"/);
    } finally {
      restore();
    }
  });
}

// ===================================================== 4. Supabase slow

test("Supabase slower than 1.5 seconds: the ordinary page, never a 500", async () => {
  const restore = useFetch({ rpc: normalRpc, delayMs: 5000 });
  try {
    const started = Date.now();
    const res = await handler(request("/lms"));
    const took = Date.now() - started;
    assert.equal(res.status, 200);
    assert.ok(took < 3000, `gave up in ${took}ms, which must be well under the 5s delay`);
    const html = await res.text();
    assert.match(html, /<title>Data-Lead Academy: self paced data courses online<\/title>/);
    // No courses, because none arrived, and that is fine.
    assert.match(html, /The first courses are on their way/);
  } finally {
    restore();
  }
});

// =====================================================================
// THE ONE THAT MATTERS MOST IN THIS FILE.
//
// A course page may answer 404 with noindex ONLY when Supabase replied
// and said there is no such published course. Slow, down or paused is
// not an answer, and this file once asserted the opposite: that a slow
// course page SHOULD be a 404. It was wrong, and the free Supabase plan
// pauses a project after a week without visitors, so it would have told
// Google to drop every course in the Academy after one quiet week.
//
// Each of the three ways of failing gets its own test, because they
// arrive at the handler as three different things: a timeout aborts the
// fetch, a dead host throws, and a 500 comes back as a response with a
// body. All three have to end in the same place.
// =====================================================================

/** The four things that must be true of a course page we could not load. */
async function assertServedAnyway(res, what) {
  assert.equal(res.status, 200, `${what}: status must be 200, never 404`);
  const html = await res.text();
  assert.doesNotMatch(html, /noindex/, `${what}: must not carry noindex`);
  assert.doesNotMatch(
    html,
    /Course not found/,
    `${what}: must not say the course is missing`,
  );
  // A short cache, so one bad minute is not served for a day.
  const cache = res.headers.get("Cache-Control") || "";
  assert.match(cache, /s-maxage=30\b/, `${what}: cache must be 30s, was "${cache}"`);
  assert.doesNotMatch(
    cache,
    /stale-while-revalidate/,
    `${what}: must have no stale-while-revalidate`,
  );
  return html;
}

test("a SLOW course page: 200, no noindex, short cache", async () => {
  const restore = useFetch({ rpc: normalRpc, delayMs: 5000 });
  try {
    const started = Date.now();
    const res = await handler(request("/lms/courses/stata-for-survey-data"));
    const took = Date.now() - started;
    assert.ok(took < 3000, `waited ${took}ms, which must be well under the 5s delay`);
    await assertServedAnyway(res, "slow");
  } finally {
    restore();
  }
});

test("a DOWN course page: 200, no noindex, short cache", async () => {
  const restore = useFetch({ rpc: normalRpc, down: true });
  try {
    const res = await handler(request("/lms/courses/stata-for-survey-data"));
    await assertServedAnyway(res, "down");
  } finally {
    restore();
  }
});

test("a PAUSED project on a course page: 200, no noindex, short cache", async () => {
  // A paused Supabase project answers, with a 503 and an HTML body
  // rather than JSON. supabase-js turns 500 to 599 into a retryable
  // error, so this must not look like an empty answer.
  const restore = useFetch({ rpc: normalRpc, status: 503, body: "project paused" });
  try {
    const res = await handler(request("/lms/courses/stata-for-survey-data"));
    await assertServedAnyway(res, "paused");
  } finally {
    restore();
  }
});

test("only a real reply with no row gives the 404, and it carries noindex", async () => {
  const restore = useFetch({ rpc: normalRpc });
  try {
    const res = await handler(request("/lms/courses/no-such-course"));
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.match(html, /noindex/);
    assert.match(html, /Course not found/);
    // The canonical points at the catalogue, not at the address that
    // does not exist.
    assert.match(html, /rel="canonical" href="https:\/\/dataleadafrica\.com\/lms\/courses"/);
  } finally {
    restore();
  }
});

// ===================================================== 5. Supabase down

test("Supabase down: still 200 on the landing page, with the default tags", async () => {
  const restore = useFetch({ rpc: normalRpc, down: true });
  try {
    const res = await handler(request("/lms"));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Data-Lead Academy/);
    assert.doesNotMatch(html, /undefined/);
  } finally {
    restore();
  }
});

test("Supabase down: the catalogue still answers 200", async () => {
  const restore = useFetch({ rpc: normalRpc, down: true });
  try {
    const res = await handler(request("/lms/courses"));
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<h1>Self paced data courses<\/h1>/);
  } finally {
    restore();
  }
});

// ==================================================== query strings

test("a query string never reaches the canonical", async () => {
  const restore = useFetch({ rpc: normalRpc });
  try {
    const res = await handler(request("/lms/courses?tool=stata&sort=newest"));
    const html = await res.text();
    assert.match(html, /canonical" href="https:\/\/dataleadafrica\.com\/lms\/courses"/);
    assert.doesNotMatch(html, /canonical[^>]*tool=stata/);
  } finally {
    restore();
  }
});

// ================================================== lengths and wording

test("titles stop at 60 characters and descriptions at 155, on a word", () => {
  const long = {
    ...COURSE,
    title: "An extremely long course name that goes on and on past any sensible limit",
  };
  const t = courseTitle(long);
  assert.ok(t.length <= 60, `title was ${t.length}`);
  assert.doesNotMatch(t, /\s$/);

  const d = courseDescription({ ...COURSE, summary: "x ".repeat(200) });
  assert.ok(d.length <= 155, `description was ${d.length}`);

  assert.equal(clip("one two three four", 11), "one two");
  assert.equal(clip("short", 60), "short");
  // A single word longer than the limit still has to be cut somewhere.
  assert.equal(clip("aaaaaaaaaa", 4).length, 4);
});

test("seo_title and seo_description win when somebody has written them", () => {
  const c = {
    ...COURSE,
    seo_title: "Hand written title",
    seo_description: "Hand written description.",
  };
  assert.equal(courseTitle(c), "Hand written title");
  assert.equal(courseDescription(c), "Hand written description.");
});

test("the default description follows the template", () => {
  assert.equal(
    courseDescription(COURSE),
    "12 video lessons, 1h 36m, at your own pace. Clean, label and analyse survey exports, then build the tables your report needs.",
  );
});

test("lengths and prices read the way a person writes them", () => {
  assert.equal(asLength(5760), "1h 36m");
  assert.equal(asLength(600), "10m");
  assert.equal(asLength(3600), "1h");
  assert.equal(asLength(0), "0m");
  assert.equal(isoDuration(5760), "PT1H36M");
  assert.equal(isoDuration(600), "PT10M");
  assert.equal(isoDuration(0), "PT0M");
  assert.equal(asNaira(1000000), "10,000");
  assert.equal(asNaira(0), "0");
});

// ========================================================= the landing

test("the landing page lists the courses as real links", async () => {
  const restore = useFetch({ rpc: normalRpc });
  try {
    const html = await (await handler(request("/lms"))).text();
    assert.match(html, /<a href="\/lms\/courses\/stata-for-survey-data">STATA for survey data<\/a>/);
    const m = html.match(/<script type="application\/ld\+json" data-edge="1">([\s\S]*?)<\/script>/);
    assert.equal(JSON.parse(m[1]. replace(/\\u003c/g, "<"))["@type"], "EducationalOrganization");
  } finally {
    restore();
  }
});

test("the catalogue page marks itself up as a list of the course addresses", async () => {
  const restore = useFetch({ rpc: normalRpc });
  try {
    const html = await (await handler(request("/lms/courses"))).text();
    const m = html.match(/<script type="application\/ld\+json" data-edge="1">([\s\S]*?)<\/script>/);
    const data = JSON.parse(m[1].replace(/\\u003c/g, "<"));
    // Two blocks: the list of courses and the trail, which matches the
    // breadcrumb a person reads at the top of the page.
    assert.equal(data.length, 2);
    assert.deepEqual(
      data.map((d) => d["@type"]),
      ["ItemList", "BreadcrumbList"],
    );
    const list = data[0];
    const trail = data[1];
    assert.equal(trail.itemListElement.length, 2);
    assert.equal(trail.itemListElement[1].item, "https://dataleadafrica.com/lms/courses");
    assert.equal(list.numberOfItems, 1);
    assert.equal(
      list.itemListElement[0].url,
      "https://dataleadafrica.com/lms/courses/stata-for-survey-data",
    );
  } finally {
    restore();
  }
});

// ============================================================ escaping

test("a course whose words contain HTML cannot break out of a tag", async () => {
  const nasty = {
    ...COURSE,
    slug: "nasty",
    title: 'A "quoted" <script>alert(1)</script> title',
    summary: "Ends with </title> and & an ampersand",
  };
  const restore = useFetch({
    rpc: (name) => (name === "lms_public_course" ? [nasty] : [nasty]),
  });
  try {
    const html = await (await handler(request("/lms/courses/nasty"))).text();
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&quot;quoted&quot;/);
  } finally {
    restore();
  }
});

// ============================================================= sitemap

test("the sitemap lists the fixed pages and every published course", () => {
  const xml = buildSitemap(ORIGIN, [COURSE]);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/dataleadafrica\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/dataleadafrica\.com\/lms<\/loc>/);
  assert.match(xml, /<loc>https:\/\/dataleadafrica\.com\/lms\/courses<\/loc>/);
  assert.match(
    xml,
    /<loc>https:\/\/dataleadafrica\.com\/lms\/courses\/stata-for-survey-data<\/loc>\n    <lastmod>2026-10-05<\/lastmod>/,
  );
  // Nothing private, and nothing with a parameter in it.
  assert.doesNotMatch(xml, /\/lms\/sign-up/);
  assert.doesNotMatch(xml, /\/lms\/me/);
  assert.doesNotMatch(xml, /\/staff\//);
  assert.doesNotMatch(xml, /:number|:slug/);
  assert.doesNotMatch(xml, /payment-success|registration-success/);
});

test("the sitemap survives Supabase being unreachable", () => {
  const xml = buildSitemap(ORIGIN, null);
  assert.match(xml, /<loc>https:\/\/dataleadafrica\.com\/lms<\/loc>/);
  assert.doesNotMatch(xml, /undefined/);
});

// =====================================================================
// THE LANDING PAGE'S WORDS COME FROM lms_settings
// =====================================================================

test("landingWords falls back to the words on the page today", () => {
  const w = landingWords(null);
  assert.equal(w.headline, LANDING.headline);
  assert.equal(w.subhead, LANDING.subhead);
  assert.equal(w.announce, "");
  // An empty row is the same as no row. A control room with blank boxes
  // in it must not empty the hero.
  const blank = landingWords({ headline: "", subhead: "   ", announce_on: true });
  assert.equal(blank.headline, LANDING.headline);
  assert.equal(blank.subhead, LANDING.subhead);
  assert.equal(blank.announce, "");
});

test("landingWords uses the row when there is one", () => {
  const w = landingWords({
    headline: "Two tools, one term.",
    subhead: "Short courses, in order.",
    announce_on: true,
    announce_text: "Enrolment is open.",
  });
  assert.equal(w.headline, "Two tools, one term.");
  assert.equal(w.subhead, "Short courses, in order.");
  assert.equal(w.announce, "Enrolment is open.");
});

test("announce_off hides the announcement even with text in the box", () => {
  const w = landingWords({ announce_on: false, announce_text: "Enrolment is open." });
  assert.equal(w.announce, "");
});

test("the title and the description are NEVER taken from the database", () => {
  // The two lines a search engine weighs most. A mistyped headline in a
  // form must not be able to rewrite them.
  const w = landingWords({
    headline: "x",
    subhead: "y",
    seo_title: "cheap courses buy now",
    description: "nonsense",
    title: "nonsense",
  });
  assert.equal(w.title, LANDING.title);
  assert.equal(w.description, LANDING.description);
});

test("the landing page shows the database's headline, not the fallback", async () => {
  const restore = useFetch({
    rpc: normalRpc,
    rest: (table) =>
      table === "lms_settings"
        ? [
            {
              headline: "Two tools, one term.",
              subhead: "Short courses, in the right order.",
              announce_on: true,
              announce_text: "Enrolment is open.",
            },
          ]
        : [],
  });
  try {
    const html = await (await handler(request("/lms"))).text();
    assert.match(html, /<h1>Two tools, one term\.<\/h1>/);
    assert.match(html, /Short courses, in the right order\./);
    assert.match(html, /Enrolment is open\./);
    // And still the fixed title and description.
    assert.match(html, /<title>Data-Lead Academy: self paced data courses online<\/title>/);
  } finally {
    restore();
  }
});

test("the landing page falls back silently when the settings read fails", async () => {
  const restore = useFetch({ rpc: normalRpc, rest: null });
  try {
    const res = await handler(request("/lms"));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<h1>Learn one tool at a time\.<\/h1>/);
    assert.doesNotMatch(html, /undefined/);
  } finally {
    restore();
  }
});

// =====================================================================
// ONE ADDRESS, EVERYWHERE
// =====================================================================

test("no tag is ever built from the host the request arrived on", async () => {
  const restore = useFetch({ rpc: normalRpc });
  try {
    // The vercel.app address, which is where this went wrong: the
    // canonical named the preview copy of the site and invited Google
    // to index a second copy of everything.
    const res = await handler(
      request("/lms/courses/stata-for-survey-data", {
        headers: { host: "dataleadweb-frontend.vercel.app" },
      }),
    );
    const html = await res.text();
    assert.doesNotMatch(html, /vercel\.app/, "no tag may name the deployment host");
    assert.match(
      html,
      /rel="canonical" href="https:\/\/dataleadafrica\.com\/lms\/courses\/stata-for-survey-data"/,
    );
    assert.match(html, /og:url" content="https:\/\/dataleadafrica\.com\//);
    assert.match(html, /og:image" content="https:\/\/dataleadafrica\.com\/api\/og\?course=/);
  } finally {
    restore();
  }
});

test("siteUrl drops a query string and siteAsset keeps one", () => {
  // Two helpers on purpose. siteUrl's stripping is right for a
  // canonical and was silently removing ?course= from every share
  // picture, so every course shared the generic one.
  assert.equal(siteUrl("/lms/courses?tool=stata"), "https://dataleadafrica.com/lms/courses");
  assert.equal(siteUrl("/lms/"), "https://dataleadafrica.com/lms");
  assert.equal(siteUrl("/"), "https://dataleadafrica.com/");
  assert.equal(
    siteAsset("/api/og?course=stata-for-survey-data"),
    "https://dataleadafrica.com/api/og?course=stata-for-survey-data",
  );
});

// =====================================================================
// SINGULAR AND PLURAL
// =====================================================================

test("one lesson is not 1 lessons", () => {
  assert.equal(plural(1, "lesson"), "1 lesson");
  assert.equal(plural(0, "lesson"), "0 lessons");
  assert.equal(plural(2, "lesson"), "2 lessons");
  assert.equal(plural(1, "module quiz", "module quizzes"), "1 module quiz");
  assert.equal(plural(3, "module quiz", "module quizzes"), "3 module quizzes");
});

test("a course with exactly one lesson reads correctly in the plain HTML", async () => {
  const one = {
    ...COURSE,
    lesson_count: 1,
    quiz_count: 1,
    modules: [{ ...COURSE.modules[0], lessons: 1, quizzes: 1, lesson_list: [COURSE.modules[0].lesson_list[0]] }],
  };
  const restore = useFetch({
    rpc: (name, options) => (name === "lms_public_course" ? [one] : [one]),
  });
  try {
    const html = await (await handler(request(`/lms/courses/${COURSE.slug}`))).text();
    assert.doesNotMatch(html, /\b1 lessons\b/);
    assert.doesNotMatch(html, /\b1 module quizzes\b/);
    assert.match(html, /1 video lesson\b/);
  } finally {
    restore();
  }
});
