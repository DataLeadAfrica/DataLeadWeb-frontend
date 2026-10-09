// Types for api/_seo-rules.js, so TypeScript can see across into the
// one plain JavaScript file that holds the title and description rules.
//
// The rules are JavaScript because the edge functions cannot import
// TypeScript. This file is only the shape of them.

export declare const SITE_ORIGIN: string;
export declare function siteUrl(path: string): string;
export declare function siteAsset(pathWithQuery: string): string;

export declare const MAX_TITLE: number;
export declare const MAX_DESCRIPTION: number;

export declare function clip(text: string, max: number): string;
export declare function asLength(seconds: number | null | undefined): string;

export declare function courseTitle(course: {
  seo_title?: string | null;
  title: string;
}): string;

export declare function courseDescription(course: {
  seo_description?: string | null;
  lesson_count: number;
  total_seconds: number;
  summary: string;
}): string;

export declare const LANDING: {
  title: string;
  headline: string;
  subhead: string;
  description: string;
};
export declare const CATALOGUE: { title: string; description: string };
export declare const NOT_FOUND: { title: string; description: string };

export declare function landingWords(
  settings: {
    headline?: string | null;
    subhead?: string | null;
    announce_on?: boolean | null;
    announce_text?: string | null;
  } | null,
): {
  title: string;
  description: string;
  headline: string;
  subhead: string;
  announce: string;
};

export declare function plural(n: number, one: string, many?: string): string;
