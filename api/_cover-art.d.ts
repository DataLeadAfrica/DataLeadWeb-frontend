// Types for api/_cover-art.js, so TypeScript can see across into the
// one plain JavaScript file that draws every course cover.
//
// It is JavaScript because api/og.js cannot import TypeScript and
// tests/cover-art.test.mjs runs it in plain Node. This file is only
// the shape of it.

export type CoverCourse = {
  slug?: string;
  title?: string;
  tool?: string | null;
  area?: string | null;
  cover_code?: string | null;
  variant?: "card" | "square" | "og";
  /** Pixels. Only api/og.js passes these. See coverArt. */
  width?: number;
  height?: number;
};

export declare const AREAS: { area: string; key: string; goal: string }[];

export declare const AREA_PAINT: Record<string, { bg: string; ink: string }>;

export declare const AREA_GRID: Record<string, string>;

export declare function areaKey(area: string | null | undefined): string;
export declare function areaGoal(area: string | null | undefined): string;

export declare function coverArt(course: CoverCourse): string;
export declare function coverCode(course: CoverCourse): string;
export declare function coverName(course: CoverCourse): string;
export declare function coverNameSize(name: string): number;
