// The title and description rules for a course page.
//
// The rules themselves are in api/_seo-rules.js, in plain JavaScript,
// because the edge function that writes the tags before any JavaScript
// runs has to use exactly the same ones and cannot import TypeScript.
// This file is the typed doorway onto that one copy.
//
// Do not reimplement any of it here. If the page and the edge function
// ever disagreed about a title, the tag would change under a crawler
// between the HTML arriving and React booting, and nobody would catch
// it by looking at the page.

import {
  clip as clipJs,
  landingWords as landingWordsJs,
  plural as pluralJs,
  LANDING as LANDING_JS,
  CATALOGUE as CATALOGUE_JS,
  courseTitle as courseTitleJs,
  courseDescription as courseDescriptionJs,
  MAX_TITLE as MAX_TITLE_JS,
  MAX_DESCRIPTION as MAX_DESCRIPTION_JS,
} from "../../api/_seo-rules.js";

export const MAX_TITLE: number = MAX_TITLE_JS;
export const MAX_DESCRIPTION: number = MAX_DESCRIPTION_JS;

export function clip(text: string, max: number): string {
  return clipJs(text, max);
}

export function courseTitle(course: {
  seo_title?: string | null;
  title: string;
}): string {
  return courseTitleJs(course);
}

export function courseDescription(course: {
  seo_description?: string | null;
  lesson_count: number;
  total_seconds: number;
  summary: string;
}): string {
  return courseDescriptionJs(course);
}

// ------------------------------------------------- the pages' fixed words

export type Words = {
  title: string;
  description: string;
  headline: string;
  subhead: string;
  announce: string;
};

export const LANDING = LANDING_JS;
export const CATALOGUE = CATALOGUE_JS;

/** The landing page's words, from lms_settings or the fallbacks. */
export function landingWords(
  settings: {
    headline?: string | null;
    subhead?: string | null;
    announce_on?: boolean | null;
    announce_text?: string | null;
  } | null,
): Words {
  return landingWordsJs(settings);
}

/** "1 lesson", "12 lessons". */
export function plural(n: number, one: string, many?: string): string {
  return pluralJs(n, one, many);
}
