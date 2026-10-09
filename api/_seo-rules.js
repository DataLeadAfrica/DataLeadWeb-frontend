// The rules for what a course page's title and description say.
//
// THIS IS THE ONE COPY. It is plain JavaScript, with no imports and no
// types, for one reason: both sides of the site have to use exactly
// these rules, and they are written in different languages.
//
//   api/_academy-data.js       the edge function, which writes the tags
//                              into the HTML before any JavaScript runs
//   src/lib/courseSeo.ts       the React page, which sets them again
//                              once it boots
//
// An earlier version had the rules written out twice, once in each
// place, with a test checking the two agreed. That test had to turn
// TypeScript into JavaScript with regular expressions to do it, which
// is the kind of cleverness that works until it quietly does not. One
// file that both import cannot disagree with itself.
//
// If the two did disagree, the title would change under a crawler that
// does run JavaScript, somewhere between the HTML arriving and React
// starting. That is worse than having no title at all, and nobody would
// ever catch it by looking at the page.

// =====================================================================
// THE SITE'S OWN ADDRESS. ONE COPY, FOR THE WHOLE SITE.
// =====================================================================
//
// Every canonical, every og:url, every og:image, every url inside the
// structured data, every line of the sitemap and the Sitemap line in
// robots.txt must say this and nothing else.
//
// WHY IT IS NOT BUILT FROM THE REQUEST. The edge functions used to make
// the address out of the host header they were answering on. That is
// correct for exactly one host and wrong for every other, and there are
// several: the Vercel preview address for each deployment, the
// dataleadweb-frontend.vercel.app address, and the other spelling of
// the domain. On the vercel.app address the canonical read
// https://dataleadweb-frontend.vercel.app/lms/courses/..., which is an
// invitation to index a second copy of the whole site. A canonical's
// entire job is to name the one real address, so it cannot be built
// from whichever address the visitor happened to use.
//
// THE ONE THING THAT STILL USES THE REQUEST HOST is an edge function
// fetching index.html, or og.js fetching an image, from the deployment
// it is itself running on. That has to be the running host: a preview
// deployment must read its own files, not production's.
export const SITE_ORIGIN = "https://dataleadafrica.com";

/** The full address of a path on this site. Never a query string. */
export function siteUrl(path) {
  const clean = String(path || "/").split("?")[0].split("#")[0];
  const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
  // No trailing slash except on the homepage, so /lms and /lms/ cannot
  // become two canonicals.
  const trimmed = withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
  return `${SITE_ORIGIN}${trimmed}`;
}

/**
 * The full address of something on this site that IS allowed a query
 * string, which in practice means the share picture: /api/og?course=x.
 *
 * Separate from siteUrl on purpose. siteUrl drops the query string
 * because a canonical with one in it splits a page into two, and that
 * same stripping quietly removed ?course= from every og:image and left
 * every course sharing the generic picture. Two names, so the next
 * person has to choose which they mean.
 */
export function siteAsset(pathWithQuery) {
  const raw = String(pathWithQuery || "/");
  return `${SITE_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 155;

/**
 * Cut to a length without cutting a word in half.
 *
 * Google shows about 60 characters of a title and about 155 of a
 * description, and cuts whatever is past that. "Learn STATA for Survey
 * Da..." reads as a mistake; a shorter sentence that ends properly does
 * not. Nothing is added, no ellipsis: a sentence that stops is tidier
 * than one that trails off.
 */
export function clip(text, max) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const out =
    lastSpace > Math.floor(max * 0.5) ? cut.slice(0, lastSpace) : s.slice(0, max);
  return out.replace(/[\s,;:.-]+$/, "");
}

/** 5760 seconds becomes "1h 36m". Used in titles, so it has to be short. */
export function asLength(seconds) {
  const n = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.round((n % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** seo_title if somebody wrote one, otherwise the template. */
export function courseTitle(course) {
  if (course.seo_title && course.seo_title.trim()) {
    return clip(course.seo_title, MAX_TITLE);
  }
  return clip(`Learn ${course.title} Online | Data-Lead Academy`, MAX_TITLE);
}

/** seo_description if somebody wrote one, otherwise the template. */
export function courseDescription(course) {
  if (course.seo_description && course.seo_description.trim()) {
    return clip(course.seo_description, MAX_DESCRIPTION);
  }
  const lessons = Number(course.lesson_count) || 0;
  const time = asLength(course.total_seconds);
  const lead = `${lessons} video lesson${lessons === 1 ? "" : "s"}, ${time}, at your own pace.`;
  return clip(`${lead} ${course.summary || ""}`, MAX_DESCRIPTION);
}

// =====================================================================
// THE FIXED WORDS OF THE THREE PUBLIC PAGES. ONE COPY.
// =====================================================================
//
// These used to be written twice: once as constants at the top of
// api/academy-meta.js and once as constants in the React page. Nothing
// checked that the two agreed, and the landing title and description
// were in fact two separate strings that happened to match. They are
// here now for the same reason the course rules are: one file that both
// sides import cannot disagree with itself.

export const LANDING = {
  title: "Data-Lead Academy: self paced data courses online",
  headline: "Learn one tool at a time.",
  subhead:
    "Self paced video courses in the tools data professionals use every day, from the team that trains Data-Lead Africa's bootcamps. Learn on your phone or laptop, prove it in short checks, and finish with a certificate anyone can verify.",
  description:
    "Short video courses in the tools data professionals use every day, from the team behind Data-Lead Africa's bootcamps. Learn at your own pace and earn a certificate anyone can verify.",
};

export const CATALOGUE = {
  title: "All courses | Data-Lead Academy",
  description:
    "Every self paced Data-Lead Academy course by tool, level, length and price. Free courses and free first modules included. Certificates you can verify.",
};

export const NOT_FOUND = {
  title: "Course not found | Data-Lead Academy",
  description:
    "This course is not available. Browse the Data-Lead Academy catalogue to see what is open.",
};

/**
 * The landing page's words, from lms_settings when there is a row.
 *
 * WHY THE DATABASE AT ALL. The Phase 6 control room will let somebody
 * edit the headline and the subhead without a deployment. If the page
 * had them written in, that control room would be editing words nobody
 * ever sees.
 *
 * WHAT IT WILL NEVER TAKE FROM THE DATABASE: the <title> and the
 * <meta description>. Those are the two lines a search engine weighs
 * most, and a mistyped headline in a form should not be able to move
 * the Academy's front page down the results. The headline and the
 * subhead are what a person reads; the title and the description stay
 * where a review can see them.
 *
 * Pass null when Supabase could not be reached. The fallbacks are the
 * words that are on the page today, so a bad moment looks like no
 * change at all rather than an empty hero.
 */
export function landingWords(settings) {
  const pick = (key, fallback) => {
    const given = settings ? String(settings[key] || "").trim() : "";
    return given || fallback;
  };
  return {
    title: LANDING.title,
    description: LANDING.description,
    headline: pick("headline", LANDING.headline),
    subhead: pick("subhead", LANDING.subhead),
    announce:
      settings && settings.announce_on
        ? String(settings.announce_text || "").trim()
        : "",
  };
}

/**
 * "1 lesson", "12 lessons". One lesson is not "1 lessons".
 *
 * Small, and worth a function anyway: this is the wording a reader who
 * runs no JavaScript sees, and a page that cannot count reads as a page
 * nobody checked.
 */
export function plural(n, one, many) {
  const count = Number(n) || 0;
  return `${count} ${count === 1 ? one : many || `${one}s`}`;
}
