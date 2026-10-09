// /sitemap.xml
//
// Every public address of the site, plus the Academy's two public pages
// and one line per published course with the date it last changed.
//
// WHY AN EDGE FUNCTION RATHER THAN A FILE IN public/. A file would have
// to be edited by hand every time a course is published, and it would be
// wrong between the publish and the edit. The courses come from the
// database, so this is right the moment a course goes live.
//
// It never fails: if Supabase cannot be reached, the fixed pages are
// still listed and the courses are simply missing from that copy. A
// sitemap that answers 500 is treated by Google as a broken sitemap, and
// it stops asking for a while.

import { getCatalogue, SITE_ORIGIN } from "./_academy-data.js";
import { PUBLIC_ROUTES } from "./_site-routes.js";

export const config = { runtime: "edge" };

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A sitemap wants a date, not a timestamp. */
function asDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Every address, always spelled the one way.
 *
 * origin is a parameter only so the tests can pass one in. In
 * production it is always SITE_ORIGIN: a sitemap that lists the
 * preview deployment's addresses would be asking Google to index a
 * second copy of the site.
 */
export function buildSitemap(origin, courses) {
  const entries = [];

  for (const path of PUBLIC_ROUTES) {
    entries.push({ loc: `${origin}${path === "/" ? "/" : path}` });
  }

  for (const c of courses || []) {
    entries.push({
      loc: `${origin}/lms/courses/${c.slug}`,
      lastmod: asDate(c.updated_at || c.published_at),
    });
  }

  const body = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${esc(e.loc)}</loc>${
          e.lastmod ? `\n    <lastmod>${esc(e.lastmod)}</lastmod>` : ""
        }\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export default async function handler() {
  const got = await getCatalogue();

  return new Response(buildSitemap(SITE_ORIGIN, got.courses), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Shorter when the courses are missing, so a Supabase hiccup does
      // not leave an incomplete sitemap cached for an hour.
      "Cache-Control": got.ok
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : "public, s-maxage=60",
    },
  });
}
