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

import { SITE_ORIGIN as ORIGIN, siteUrl as urlJs } from "../../api/_seo-rules.js";

export const SITE_ORIGIN: string = ORIGIN;

/** The full address of a path on this site, for a canonical or og:url. */
export function siteUrl(path: string): string {
  return urlJs(path);
}
