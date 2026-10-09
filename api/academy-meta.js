// Serves the three public Academy pages with their real title, their
// real description and a readable copy of their content already in the
// HTML, before any JavaScript has run.
//
// WHY THIS EXISTS. The site is a single page app: the server sends an
// almost empty index.html and the browser builds the page. A person
// never notices. A crawler that does not run JavaScript sees an empty
// page with the homepage's title on it, and that is what it files. Most
// AI assistants reading a page do not run JavaScript either.
//
// So this function answers every request for /lms, /lms/courses and
// /lms/courses/<slug>. It fetches the app's own index.html, swaps the
// site wide tags for this page's, drops a plain HTML copy of the page's
// main content inside #root, and returns it. React replaces that copy
// the moment it boots, so a person sees exactly what they saw before.
//
// You can check it without any tool: open the page and use View Page
// Source, which shows what the server sent rather than what the browser
// built. The course title should be in the <title> line.
//
// THE RULES IT KEEPS, all of which have a test in
// tests/academy-meta.test.mjs:
//
//   A draft or unknown slug answers 404 and noindex, never 200. A soft
//   404, a "not found" page that answers 200, teaches a search engine
//   that the address is real and keeps it in the index for months.
//
//   Any query string is dropped from the canonical, so /lms/courses and
//   /lms/courses?tool=stata are one page rather than two thin ones.
//
//   If Supabase is slow or down, the ordinary page is served with the
//   default tags. Never a 500: a crawler that gets a 500 comes back less
//   often, and a 500 helps nobody who is reading.

import {
  esc,
  clip,
  asLength,
  asNaira,
  getCatalogue,
  getCourse,
  getSettings,
  getPaths,
  courseTitle,
  courseDescription,
  landingWords,
  plural,
  LANDING,
  CATALOGUE,
  NOT_FOUND,
  siteUrl,
  siteAsset,
  SITE_ORIGIN,
  MAX_TITLE,
  MAX_DESCRIPTION,
} from "./_academy-data.js";

export const config = { runtime: "edge" };

const SITE_NAME = "Data-Lead Africa";
const ACADEMY = "Data-Lead Academy";

// The words themselves live in api/_seo-rules.js, which the React pages
// import too. Only the short names are here.
const LANDING_TITLE = LANDING.title;
const CATALOGUE_TITLE = CATALOGUE.title;
const CATALOGUE_DESCRIPTION = CATALOGUE.description;
const NOT_FOUND_TITLE = NOT_FOUND.title;
const NOT_FOUND_DESCRIPTION = NOT_FOUND.description;

// plural and landingWords are rules both sides use, so they live in
// api/_seo-rules.js with the rest. Re-exported here because the tests
// import them from this file.
export { plural, landingWords };

/** Which of the three pages this request is for. */
export function readRoute(pathname) {
  const clean = String(pathname || "").replace(/\/+$/, "") || "/lms";
  if (clean === "/lms") return { kind: "landing" };
  if (clean === "/lms/courses") return { kind: "catalogue" };
  const m = clean.match(/^\/lms\/courses\/([^/]+)$/);
  if (m) return { kind: "course", slug: decodeURIComponent(m[1]) };
  return { kind: "other" };
}

// ------------------------------------------------------------- the tags

function metaTags({ title, description, canonical, image, noindex, jsonLd }) {
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    noindex ? `<meta name="robots" content="noindex, follow" />` : "",
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : "",
    image ? `<meta property="og:image:secure_url" content="${esc(image)}" />` : "",
    image ? `<meta property="og:image:type" content="image/png" />` : "",
    image ? `<meta property="og:image:width" content="1200" />` : "",
    image ? `<meta property="og:image:height" content="630" />` : "",
    image ? `<meta property="og:image:alt" content="${esc(title)}" />` : "",
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : "",
  ].filter(Boolean);

  if (jsonLd) {
    // </script> inside JSON would end the tag early. Escaping the slash
    // is the standard way round it and leaves the JSON valid.
    const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
    // data-edge="1" so the Seo component can take this one out before
    // adding its own. Without the mark, a page that has booted ends up
    // with two Course blocks and two BreadcrumbList blocks, and a
    // reader has no way to know which to believe.
    lines.push(`<script type="application/ld+json" data-edge="1">${json}</script>`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------- the JSON-LD
//
// Google stopped showing course rich results in 2025, so none of this
// earns a special box in a search result any more. It is here for the
// search engines that still read it and for the AI assistants that have
// started to. That makes "accurate and small" the whole brief: no
// invented ratings, no invented review counts, nothing the database does
// not actually hold. No FAQPage either, which Google also retired and
// which would only add weight.

function landingJsonLd(description) {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: ACADEMY,
    url: siteUrl("/lms"),
    parentOrganization: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_ORIGIN,
    },
    description,
  };
}

/**
 * The trail, as structured data. One builder for both pages, so the
 * markup cannot say something different from the trail a person reads.
 *
 * The visible trail is ui/Breadcrumb.tsx. These two go together: a
 * breadcrumb in the markup and none on the page, or the other way
 * round, is the kind of disagreement a search console reports.
 */
function breadcrumbJsonLd(last) {
  const items = [
    { "@type": "ListItem", position: 1, name: "Academy", item: siteUrl("/lms") },
    { "@type": "ListItem", position: 2, name: "Courses", item: siteUrl("/lms/courses") },
  ];
  if (last) {
    items.push({ "@type": "ListItem", position: 3, name: last.name, item: last.url });
  }
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

function catalogueJsonLd(courses) {
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Data-Lead Academy courses",
    numberOfItems: courses.length,
    itemListElement: courses.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: siteUrl(`/lms/courses/${c.slug}`),
      name: c.title,
    })),
  };
  return [list, breadcrumbJsonLd(null)];
}

function courseJsonLd(c) {
  const url = siteUrl(`/lms/courses/${c.slug}`);
  const course = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: c.title,
    description: courseDescription(c),
    url,
    provider: { "@type": "Organization", name: ACADEMY, url: siteUrl("/lms") },
    inLanguage: "en",
    // ISO 8601. 5760 seconds is PT1H36M.
    timeRequired: isoDuration(c.total_seconds),
    offers: {
      "@type": "Offer",
      price: String(Math.round((Number(c.price_kobo) || 0) / 100)),
      priceCurrency: "NGN",
      category: Number(c.price_kobo) > 0 ? "Paid" : "Free",
      url,
    },
  };
  if (c.level) course.educationalLevel = String(c.level);

  return [course, breadcrumbJsonLd({ name: c.title, url })];
}

export function isoDuration(seconds) {
  const n = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.round((n % 3600) / 60);
  if (h === 0 && m === 0) return "PT0M";
  return `PT${h > 0 ? `${h}H` : ""}${m > 0 ? `${m}M` : ""}`;
}

// --------------------------------------------- the copy a crawler reads
//
// Plain HTML, no classes, dropped inside #root. React throws it away on
// its first render, so nobody sees it, and it is the only thing a reader
// that does not run JavaScript ever sees. It carries the H1, the
// summary, the outcomes and every module and lesson title, because those
// are the words people actually search for.

function landingBody(words, courses) {
  const list = (courses || [])
    .slice(0, 12)
    .map(
      (c) =>
        `<li><a href="/lms/courses/${esc(c.slug)}">${esc(c.title)}</a>: ${esc(
          c.summary || "",
        )}</li>`,
    )
    .join("");
  return `
<h1>${esc(words.headline)}</h1>
<p>${esc(words.subhead)}</p>
${words.announce ? `<p>${esc(words.announce)}</p>` : ""}
<h2>How it works</h2>
<ol>
<li>Watch. Short video lessons you can pause and pick up again.</li>
<li>Check. A quick question after each lesson and a short quiz after each module.</li>
<li>Certify. Finish the course and your certificate is issued with a number anyone can look up.</li>
</ol>
<h2>Courses</h2>
${list ? `<ul>${list}</ul>` : "<p>The first courses are on their way.</p>"}
<p><a href="/lms/courses">See all courses</a></p>`;
}

function catalogueBody(courses) {
  const list = (courses || [])
    .map((c) => {
      const price = Number(c.price_kobo) > 0 ? `NGN ${asNaira(c.price_kobo)}` : "Free";
      return `<li><a href="/lms/courses/${esc(c.slug)}">${esc(c.title)}</a>: ${esc(
        c.summary || "",
      )} ${esc(c.tool || "")}, ${esc(c.level || "")}, ${plural(
        c.lesson_count,
        "lesson",
      )}, ${esc(asLength(c.total_seconds))}, ${esc(price)}.</li>`;
    })
    .join("");
  return `
<h1>Self paced data courses</h1>
<p>${esc(CATALOGUE_DESCRIPTION)}</p>
${list ? `<ul>${list}</ul>` : "<p>The first courses are on their way.</p>"}`;
}

function courseBody(c) {
  const outcomes = (c.outcomes || []).map((o) => `<li>${esc(o)}</li>`).join("");
  const audience = (c.audience || []).map((o) => `<li>${esc(o)}</li>`).join("");
  const before = (c.prerequisites || []).map((o) => `<li>${esc(o)}</li>`).join("");
  const modules = (c.modules || [])
    .map((m) => {
      const lessons = (m.lesson_list || [])
        .map((l) => `<li>${esc(l.title)} (${esc(asLength(l.seconds))})</li>`)
        .join("");
      return `<li>${esc(m.title)}: ${plural(m.lessons, "lesson")}, ${esc(
        asLength(m.seconds),
      )}${m.free ? ", free" : ""}${lessons ? `<ul>${lessons}</ul>` : ""}</li>`;
    })
    .join("");
  const price = Number(c.price_kobo) > 0 ? `NGN ${asNaira(c.price_kobo)}` : "Free";

  return `
<nav><a href="/lms">Academy</a> / <a href="/lms/courses">Courses</a> / ${esc(c.title)}</nav>
<h1>${esc(c.title)}</h1>
<p>${esc(c.summary || "")}</p>
<p>${plural(c.lesson_count, "video lesson")}. ${esc(
    asLength(c.total_seconds),
  )} of video. ${plural(c.quiz_count, "module quiz", "module quizzes")}. Certificate on completion. ${esc(price)}.</p>
${outcomes ? `<h2>What you will be able to do</h2><ul>${outcomes}</ul>` : ""}
${audience ? `<h2>Who it is for</h2><ul>${audience}</ul>` : ""}
${before ? `<h2>Before you start</h2><ul>${before}</ul>` : ""}
${modules ? `<h2>What is inside</h2><ol>${modules}</ol>` : ""}
<p><a href="/lms/courses">All courses</a></p>`;
}

// ------------------------------------------------------------- the shell

function putInShell(shell, tags, body) {
  let out = shell
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "");

  out = out.match(/<\/head>/i) ? out.replace(/<\/head>/i, `${tags}\n</head>`) : tags + out;

  if (body) {
    // Only an EMPTY #root is filled. If the shell ever ships with
    // something in it, that something is not ours to throw away.
    out = out.replace(
      /(<div id="root")([^>]*)(>)(\s*)(<\/div>)/i,
      (whole, open, attrs, close, gap, shut) =>
        `${open}${attrs}${close}${String(body).trim()}${shut}`,
    );
  }
  return out;
}

export default async function handler(request) {
  const url = new URL(request.url);

  // Vercel passes the real path through as a query parameter from the
  // rewrite, because request.url here is the /api address. The pathname
  // is the fallback for a direct call. Any query string is stripped:
  // the canonical is the one place it must never appear.
  const rawPath = url.searchParams.get("path") || url.pathname;
  const path = String(rawPath).split("?")[0].split("#")[0];
  const route = readRoute(path);

  // The host this function is RUNNING on. It is used for exactly one
  // thing: fetching this deployment's own index.html. Every address
  // that goes into the page comes from SITE_ORIGIN instead, because a
  // canonical built from the request host names whichever address the
  // visitor happened to use, which on a preview deployment is an
  // invitation to index a second copy of the whole site.
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const runningOn = `${proto}://${host}`;

  let shell = "";
  try {
    const res = await fetch(`${runningOn}/index.html`);
    if (res.ok) shell = await res.text();
  } catch {
    shell = "";
  }

  // Five minutes at the edge, and a day of serving the old copy while a
  // new one is fetched. A course changes rarely, and a crawler arriving
  // during a Supabase hiccup should get yesterday's good page rather
  // than today's empty one.
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
  };

  // WHEN WE COULD NOT ASK SUPABASE.
  //
  // Short cache and nothing else. A bad thirty seconds must not be
  // kept at the edge for a day, which is exactly what the long
  // stale-while-revalidate above would do with a page that came out
  // wrong.
  const shakyHeaders = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, s-maxage=30",
  };

  const canonical = siteUrl(path);

  if (route.kind === "landing") {
    const [cat, set] = await Promise.all([getCatalogue(), getSettings()]);
    const words = landingWords(set.settings);
    return new Response(
      putInShell(
        shell,
        metaTags({
          title: clip(words.title, MAX_TITLE),
          description: clip(words.description, MAX_DESCRIPTION),
          canonical,
          image: siteAsset("/api/og"),
          jsonLd: landingJsonLd(clip(words.description, MAX_DESCRIPTION)),
        }),
        landingBody(words, cat.courses),
      ),
      { status: 200, headers: cat.ok && set.ok ? headers : shakyHeaders },
    );
  }

  if (route.kind === "catalogue") {
    const cat = await getCatalogue();
    return new Response(
      putInShell(
        shell,
        metaTags({
          title: clip(CATALOGUE_TITLE, MAX_TITLE),
          description: clip(CATALOGUE_DESCRIPTION, MAX_DESCRIPTION),
          canonical,
          image: siteAsset("/api/og"),
          jsonLd: catalogueJsonLd(cat.courses),
        }),
        catalogueBody(cat.courses),
      ),
      { status: 200, headers: cat.ok ? headers : shakyHeaders },
    );
  }

  if (route.kind === "course") {
    const got = await getCourse(route.slug);

    // ================================================================
    // THE MOST IMPORTANT FOUR LINES IN THIS FILE.
    //
    // A 404 is answered ONLY when Supabase replied successfully and
    // said there is no such published course. If we could not ask, we
    // do not know, and saying "this does not exist" when we do not
    // know is how a whole catalogue falls out of a search index.
    //
    // This file used to treat both the same. Supabase slow, down, or
    // paused, and every course page told Google the course was gone.
    // The free plan pauses a project after a week without traffic, so
    // one quiet week would have done it, and getting back into an
    // index takes far longer than falling out of one.
    //
    // When we could not ask, the ordinary page is served: status 200,
    // no noindex, and a thirty second cache so the bad moment is not
    // kept for a day. React then loads and shows the course, or shows
    // its own "we could not load this" message. Nothing is told to
    // anybody about the course not existing, because we do not know
    // that it does not.
    // ================================================================
    if (!got.ok) {
      return new Response(
        putInShell(
          shell,
          metaTags({
            title: clip(`Course | ${ACADEMY}`, MAX_TITLE),
            description: CATALOGUE_DESCRIPTION,
            canonical,
          }),
          "",
        ),
        { status: 200, headers: shakyHeaders },
      );
    }

    // Supabase answered, and there is no such published course. A real
    // 404. A "not found" page that answers 200 is a soft 404, and it
    // teaches a search engine the address is real, which keeps a draft
    // course's address in the index for months.
    if (!got.course) {
      return new Response(
        putInShell(
          shell,
          metaTags({
            title: NOT_FOUND_TITLE,
            description: NOT_FOUND_DESCRIPTION,
            canonical: siteUrl("/lms/courses"),
            noindex: true,
          }),
          `<h1>Course not found</h1><p>${esc(NOT_FOUND_DESCRIPTION)}</p>
<p><a href="/lms/courses">All courses</a></p>`,
        ),
        {
          status: 404,
          headers: {
            ...headers,
            // Not cached as hard as a real page: a course published a
            // minute ago should not be missing for five more.
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
          },
        },
      );
    }

    const course = got.course;
    return new Response(
      putInShell(
        shell,
        metaTags({
          title: courseTitle(course),
          description: courseDescription(course),
          canonical: siteUrl(`/lms/courses/${course.slug}`),
          image: siteAsset(`/api/og?course=${encodeURIComponent(course.slug)}`),
          jsonLd: courseJsonLd(course),
        }),
        courseBody(course),
      ),
      { status: 200, headers },
    );
  }

  // Something under /lms this function was not asked to handle. Serve
  // the app untouched rather than guessing.
  return new Response(shell || "", { status: 200, headers });
}
