// Which ten second slices the playhead has actually been through.
//
// THIS IS THE ARITHMETIC THAT DECIDES WHETHER A LESSON CAN EVER BE
// FINISHED, so it lives on its own, in plain JavaScript, and
// tests/watch-slices.test.mjs plays whole lessons through it at every
// speed without a browser.
//
// WHAT IT GOT WRONG THE FIRST TIME. The player counted ten seconds of
// WALL time and then sent one slice, numbered from wherever the
// playhead happened to be. At 1x that is roughly one slice per slice,
// give or take whatever the phone was busy doing. At 1.5x, ten wall
// seconds is fifteen video seconds, so every third slice was never
// sent. Measured on an eight minute lesson:
//
//   1x     47 of 48, and only because the clock was perfect
//   1.25x  38 of 48. Every fifth one missing
//   1.5x   31 of 48. Every third one missing
//
// A lesson needing 92 percent could not be finished above 1x, and at
// 1x it passed or failed depending on how busy the phone was, which is
// worse than failing outright. Slice 0 was never sent at any speed,
// because the first send happened ten seconds in, by which time the
// playhead was already inside slice 1.
//
// WHAT IT DOES NOW. Every tick, it works out every slice the playhead
// crossed since the last tick and hands back all of them. Watching is
// measured by where the video got to, not by how long the page was
// open, which is the only definition that survives a change of speed.

/** Nobody may run faster than this until the lesson has been watched once. */
export const MAX_RATE_FIRST_WATCH = 1.5;

/**
 * How many slices a minute an honest watch produces at the fastest
 * allowed speed. The database refuses more than this plus a little, and
 * the two numbers have to be derived from the same place or one of them
 * drifts and silently throws away real watching.
 */
export function slicesPerMinute(bucketSeconds, rate) {
  const bs = Number(bucketSeconds) > 0 ? Number(bucketSeconds) : 10;
  return (60 / bs) * (Number(rate) > 0 ? Number(rate) : 1);
}

/**
 * The slices between one tick and the next.
 *
 * previous and current are positions in the video, in seconds. Returns
 * the slice numbers the playhead was in or went through, oldest first,
 * and whether the move looked like a seek rather than playing.
 *
 * A SEEK ADDS NOTHING. If the playhead moved further than playing at
 * this speed could possibly have taken it, somebody dragged the
 * scrubber and the ground in between was not watched. Nothing is sent
 * for the gap. The next tick starts from where they landed, so the
 * slice they are now watching is credited then.
 *
 * The slack is twice what playing could have covered in the time that
 * actually passed since the previous tick, plus a second. Below that a
 * jump is indistinguishable from the page being descheduled for a
 * moment, which happens constantly on a phone, and treating that as a
 * seek would throw away real watching. Above it, the most a mis-read
 * can cost is one extra slice.
 *
 * tickSeconds is the REAL gap, not the timer's interval. A browser
 * throttles timers hard in a background tab, sometimes to once a
 * minute, and judging a move against a nominal one second would call a
 * minute of legitimate background playing a seek and credit none of it.
 */
export function slicesCrossed({
  previous,
  current,
  bucketSeconds,
  rate = 1,
  tickSeconds = 1,
  totalSlices,
}) {
  const bs = Number(bucketSeconds) > 0 ? Number(bucketSeconds) : 10;
  const last = Number(totalSlices) > 0 ? Math.floor(totalSlices) - 1 : 0;
  const to = clamp(Math.floor(toNumber(current) / bs), 0, last);

  // The first tick of a play. There is no previous position, so credit
  // the slice they are starting in and nothing else. This is what sends
  // slice 0 when somebody presses play at the beginning, which the old
  // version never did.
  if (previous === null || previous === undefined || !Number.isFinite(previous)) {
    return { slices: [to], seeked: false };
  }

  const from = clamp(Math.floor(toNumber(previous) / bs), 0, last);
  const moved = toNumber(current) - toNumber(previous);
  const allowed = 2 * (Number(rate) > 0 ? Number(rate) : 1) * toNumber(tickSeconds) + 1;

  // Backwards, or further forward than playing could manage: a seek.
  if (moved < -0.25 || moved > allowed) {
    return { slices: [], seeked: true };
  }

  const out = [];
  for (let i = from; i <= to; i++) out.push(i);
  return { slices: out, seeked: false };
}

/**
 * How many sends a minute the database will accept, for one lesson.
 *
 * This mirrors the limit in database file 15's lms_record_watch:
 *   ceil(60 / bucket_seconds * 1.5) + 3
 *
 * It is here, rather than written out in the queue, because the queue
 * has to keep to it and so does the test. A throttled lms_record_watch
 * does NOT fail: it answers normally with the coverage unchanged, so a
 * queue that sends faster than this does not get the slices stored, it
 * gets them silently thrown away and then deletes its own copy. If the
 * number in the SQL ever changes, change it here in the same commit.
 */
export function sendsAllowedPerMinute(bucketSeconds) {
  return Math.ceil(slicesPerMinute(bucketSeconds, MAX_RATE_FIRST_WATCH)) + 3;
}

/** The last slice of a lesson, which is the one an ENDED event credits. */
export function finalSlice(totalSlices) {
  return Number(totalSlices) > 0 ? Math.floor(totalSlices) - 1 : 0;
}

/** How many slices a lesson of this length has. */
export function sliceCount(durationSeconds, bucketSeconds) {
  const bs = Number(bucketSeconds) > 0 ? Number(bucketSeconds) : 10;
  const d = toNumber(durationSeconds);
  return Math.max(1, Math.ceil(d / bs));
}

/** The speed somebody is allowed, which depends on whether it is open. */
export function cappedRate(rate, open) {
  const r = Number(rate) > 0 ? Number(rate) : 1;
  return open ? r : Math.min(r, MAX_RATE_FIRST_WATCH);
}

/**
 * The coverage figure to PRINT, which is not the one to compare.
 *
 * Rounded DOWN, always. 91.67 percent rounds to 92, and a page that
 * says "you are at 92%" next to a locked button that opens at 92% is
 * calling the learner a liar about their own screen. Rounding down can
 * only ever understate, and the moment the number reaches the mark the
 * button really is open.
 */
export function shownPercent(coverage) {
  return Math.max(0, Math.floor(toNumber(coverage)));
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, low, high) {
  return Math.max(low, Math.min(high, n));
}
