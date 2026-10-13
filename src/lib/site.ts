// The site's own address, for the React side.
//
// The value itself lives in api/_seo-rules.js, in ONE constant that the
// edge functions import too. It is there rather than here because an
// edge function cannot import TypeScript, and the two sides absolutely
// must agree: if the edge wrote one canonical and the page then set a
// different one, a crawler would see the tag change under it.
//
// To change the site's address, change that one line. Nothing else on
// either side names it.

import {
  ACADEMY_PUBLIC as PUBLIC_JS,
  PREVIEW_NOTICE as NOTICE_JS,
  SITE_ORIGIN as ORIGIN,
  siteUrl as urlJs,
} from "../../api/_seo-rules.js";

export const SITE_ORIGIN: string = ORIGIN;

/**
 * Is the Academy open to the public yet?
 *
 * The one constant is in api/_seo-rules.js, which the edge functions
 * import as well. It comes through here so a React page has one import
 * for it and TypeScript can see it.
 *
 * While it is false the Academy works exactly as it does today, and
 * nothing sends anybody to it: no band on /courses, no /lms line in the
 * sitemap, noindex on every /lms page, and a slim notice at the top of
 * each one saying so.
 */
export const ACADEMY_PUBLIC: boolean = PUBLIC_JS;

/** The one sentence the preview notice shows. */
export const PREVIEW_NOTICE: string = NOTICE_JS;

/** The full address of a path on this site, for a canonical or og:url. */
export function siteUrl(path: string): string {
  return urlJs(path);
}
