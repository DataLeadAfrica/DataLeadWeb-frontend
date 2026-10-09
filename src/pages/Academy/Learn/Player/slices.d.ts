// Types for slices.js, so TypeScript can see across into the one plain
// JavaScript file that holds the watching arithmetic.
//
// It is JavaScript because tests/watch-slices.test.mjs runs it in plain
// Node, with no browser and no build step and no extra dependency. This
// file is only the shape of it.

export declare const MAX_RATE_FIRST_WATCH: number;

export declare function slicesPerMinute(
  bucketSeconds: number,
  rate: number,
): number;

export declare function slicesCrossed(options: {
  previous: number | null | undefined;
  current: number;
  bucketSeconds: number;
  rate?: number;
  tickSeconds?: number;
  totalSlices: number;
}): { slices: number[]; seeked: boolean };

export declare function sendsAllowedPerMinute(bucketSeconds: number): number;

export declare function finalSlice(totalSlices: number): number;

export declare function sliceCount(
  durationSeconds: number,
  bucketSeconds: number,
): number;

export declare function cappedRate(rate: number, open: boolean): number;

export declare function shownPercent(coverage: number): number;
