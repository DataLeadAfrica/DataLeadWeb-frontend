// /api/og?course=<slug> must really return a picture.
//
//   npm test
//
// WHY THIS TEST EXISTS, and it is not a hypothetical. The share picture
// is the one piece of the site nobody on the team ever looks at: it is
// drawn on a server, by a different renderer from the browser's, and it
// only appears once somebody pastes a course link into WhatsApp or
// LinkedIn. Every other check passes whether or not it works.
//
// The first version of the redrawn card built the Data-Lead mark in as
// a WebP, the same file the pages use. The renderer in api/og.js cannot
// decode WebP. It threw part way through, the handler caught it exactly
// as it is supposed to, and every single course quietly fell through to
// the plain certificate card. The build passed. The types passed. Every
// other test passed. Only rendering one for real found it.
//
// So this renders them for real, one per area plus an unknown area,
// no area at all, and a slug that is not a course, and checks that what
// comes back is a PNG with something actually drawn on it.

import { test } from "node:test";
import assert from "node:assert/strict";

// Six courses, shaped the way lms_public_course returns them.
const COURSES = {
  "excel-foundations": {
    slug: "excel-foundations", title: "Excel foundations for analysts",
    tool: "Excel", area: "Analysis", cover_code: "EX",
    lesson_count: 18, total_seconds: 7380, price_kobo: 0,
  },
  "power-bi-dashboards": {
    slug: "power-bi-dashboards", title: "Power BI dashboards that get used",
    tool: "Power BI", area: "Visualisation", cover_code: "PB",
    lesson_count: 24, total_seconds: 11400, price_kobo: 2500000,
  },
  "kobo-field-surveys": {
    slug: "kobo-field-surveys", title: "Field surveys with KoboToolbox",
    tool: "KoboToolbox", area: "Data collection", cover_code: "KO",
    lesson_count: 15, total_seconds: 6300, price_kobo: 1500000,
  },
  "python-for-data": {
    slug: "python-for-data", title: "Python for data work",
    tool: "Python", area: "Programming", cover_code: "PY",
    lesson_count: 30, total_seconds: 14400, price_kobo: 3500000,
  },
  // An area nobody has written art for, and an 18 character tool name,
  // which is too long to show and becomes the two letter code.
  "qualitative-coding": {
    slug: "qualitative-coding", title: "Coding qualitative interview data",
    tool: "Advanced Excel 365", area: "Qualitative methods", cover_code: "QC",
    lesson_count: 9, total_seconds: 3600, price_kobo: 0,
  },
  // No area, no tool, and a title long enough to need four lines.
  "no-area-course": {
    slug: "no-area-course",
    title: "A very long course title that has to wrap onto a second line to fit",
    tool: null, area: null, cover_code: "NA",
    lesson_count: 1, total_seconds: 600, price_kobo: 0,
  },
};

// The only network call the course path makes is the Supabase lookup.
// Everything else in the picture, the fonts and the mark included, is
// built into api/og.js, which is the whole point of building them in.
function stubFetch() {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/rpc/lms_public_course")) {
      const slug = JSON.parse(init.body).p_slug;
      const row = COURSES[slug];
      return new Response(JSON.stringify(row ? [row] : []), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("not deployed in this test", { status: 404 });
  };
  return () => {
    globalThis.fetch = real;
  };
}

async function draw(slug) {
  const { default: handler } = await import("../api/og.js");
  const res = await handler(
    new Request(`https://dataleadafrica.com/api/og?course=${slug}`, {
      headers: { host: "dataleadafrica.com", "x-forwarded-proto": "https" },
    }),
  );
  return { res, bytes: new Uint8Array(await res.arrayBuffer()) };
}

const isPng = (b) =>
  b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

test("every course returns a drawn PNG, not a fallback and not an error", async () => {
  const undo = stubFetch();
  try {
    for (const slug of Object.keys(COURSES)) {
      const { res, bytes } = await draw(slug);

      assert.equal(res.status, 200, `${slug}: answered ${res.status}`);
      assert.match(
        res.headers.get("content-type") || "",
        /image\/png/,
        `${slug}: did not answer with a picture`,
      );
      assert.ok(
        isPng(bytes),
        `${slug}: the body is not a PNG. If it is HTML, something threw and the ` +
          `catch handed back a page instead of an image.`,
      );
      // A blank 1200x630 rectangle compresses to a few kilobytes. The
      // plain certificate fallback is about 22 KB. A real course card,
      // with its art and its text, is far bigger than either. This is
      // the assertion that caught the WebP failure: everything above
      // passed, because falling back to the plain card is a valid PNG.
      assert.ok(
        bytes.length > 60000,
        `${slug}: only ${(bytes.length / 1024).toFixed(1)} KB came back, which is too ` +
          `small to be the course card. It has almost certainly fallen through to the ` +
          `plain certificate card, which is what happens when the renderer throws.`,
      );
    }
  } finally {
    undo();
  }
});

test("the share picture says one thing about caching, not two", async () => {
  const undo = stubFetch();
  try {
    const { res } = await draw("excel-foundations");
    const cache = res.headers.get("cache-control") || "";
    assert.match(cache, /public/, "the picture is no longer publicly cacheable");
    assert.match(cache, /max-age=3600/, "the browser cache rule changed");
    assert.match(cache, /s-maxage=86400/, "the edge cache rule changed");

    // The renderer sets a cache header of its own and APPENDS ours to
    // it, which used to produce a header carrying two different
    // max-ages. A cache reads the first one, so these pictures were
    // being kept, immutable, for a year rather than the day intended:
    // a certificate revoked afterwards would have gone on showing its
    // old picture. Two max-ages in one header is the symptom.
    const ages = cache.match(/(^|[^-])max-age=/g) || [];
    assert.equal(
      ages.length,
      1,
      `the header carries ${ages.length} max-age values and so says two different ` +
        `things: "${cache}"`,
    );
    assert.ok(
      !cache.includes("immutable"),
      `the picture is marked immutable, so a corrected one would never replace it: ` +
        `"${cache}"`,
    );
  } finally {
    undo();
  }
});

test("a slug that is not a course still answers with a picture", async () => {
  // Somebody sharing an old or mistyped link must not get a broken
  // image in their message. The handler falls through to the plain
  // card rather than failing.
  const undo = stubFetch();
  try {
    const { res, bytes } = await draw("not-a-real-course");
    assert.equal(res.status, 200, "a missing course did not answer 200");
    assert.ok(isPng(bytes), "a missing course did not answer with a PNG");
    assert.ok(bytes.length > 8000, "a missing course answered with an empty picture");
  } finally {
    undo();
  }
});

test("the lookup failing completely still answers with a picture", async () => {
  // The database being unreachable is the other way this goes wrong,
  // and it must behave the same way.
  const real = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  try {
    const { res, bytes } = await draw("excel-foundations");
    assert.equal(res.status, 200, "a dead lookup did not answer 200");
    assert.ok(isPng(bytes), "a dead lookup did not answer with a PNG");
  } finally {
    globalThis.fetch = real;
  }
});

test("the certificate picture, which this change must not have touched", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response("[]", { status: 200 });
  try {
    const { default: handler } = await import("../api/og.js");
    const res = await handler(
      new Request("https://dataleadafrica.com/api/og?number=DLA-2026-DAB-EXC-7K3Q9F", {
        headers: { host: "dataleadafrica.com" },
      }),
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.equal(res.status, 200, "the certificate picture stopped answering");
    assert.ok(isPng(bytes), "the certificate picture is no longer a PNG");
    assert.ok(bytes.length > 8000, "the certificate picture came back empty");
  } finally {
    globalThis.fetch = real;
  }
});
