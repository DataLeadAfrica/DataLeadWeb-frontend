// A whole lesson, watched at every speed the player allows, and the
// lesson must open every time.
//
// WHY THIS TEST EXISTS. Phase 4 shipped a player that could not finish
// a lesson above 1x. Everything passed: the unit tests, the browser
// checks, the screenshots. Nothing played a lesson to the end.
//
// The player counted ten seconds of WALL time and sent one slice. At
// 1.5x, ten wall seconds is fifteen video seconds, so every third
// slice was never sent and coverage stopped at about 65 percent. At
// 1.25x it was every fifth. At 1x it got there only if the phone was
// not busy. Slice 0 was never sent at any speed.
//
// So this plays the real arithmetic through a whole lesson, tick by
// tick, at each speed, and requires 100 percent and an open check. It
// needs no browser and no dependency: the arithmetic lives in
// src/pages/Academy/Learn/Player/slices.js precisely so it can be run
// here in plain Node.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cappedRate,
  finalSlice,
  MAX_RATE_FIRST_WATCH,
  shownPercent,
  sliceCount,
  sendsAllowedPerMinute,
  slicesCrossed,
  slicesPerMinute,
} from "../src/pages/Academy/Learn/Player/slices.js";

// The lesson the Phase 4 review used: eight minutes, ten second slices,
// and the check opens at 92 percent. 92 rather than 90 on purpose: 90
// is low enough to hide a player that loses a slice here and there,
// which is exactly how this got through the first time.
const SECONDS = 480;
const BUCKET = 10;
const NEEDS = 92;
const TOTAL = sliceCount(SECONDS, BUCKET); // 48
const TICK = 1; // the player's timer, in seconds

/**
 * Plays a lesson from start to finish and returns what reached the
 * server.
 *
 * It is the player's loop with the player taken out: a playhead that
 * moves at `rate` seconds of video per second of wall clock, a tick
 * every TICK seconds, and the same slicesCrossed call the real page
 * makes. `jitter` wobbles each tick the way a busy phone does.
 */
function watchWholeLesson(rate, { jitter = 0, seek = null } = {}) {
  const sent = new Set();
  const sentAt = [];
  let at = 0; // position in the video
  let before = null;
  let wall = 0;
  let ended = false;

  // Enough wall time for the whole lesson at this speed, and a bit over.
  const limit = SECONDS / rate + 30;

  while (wall < limit) {
    const step = TICK * (1 + (jitter ? ((wall * 7919) % 100) / 100 - 0.5 : 0) * jitter);
    wall += step;
    at += step * rate;

    if (seek && !seek.done && wall >= seek.atWall) {
      at = seek.to;
      seek.done = true;
      // A seek breaks the chain: the next tick sees a jump.
    }

    if (at >= SECONDS) {
      at = SECONDS;
      ended = true;
    }

    const { slices } = slicesCrossed({
      previous: before,
      current: at,
      bucketSeconds: BUCKET,
      rate,
      tickSeconds: TICK,
      totalSlices: TOTAL,
    });
    before = at;
    for (const s of slices) {
      if (!sent.has(s)) {
        sent.add(s);
        sentAt.push({ slice: s, wall });
      }
    }

    if (ended) {
      // The ENDED event credits the last slice, because the final slice
      // is usually a part of one and the playhead can stop inside it
      // without any tick seeing the boundary.
      const lastOne = finalSlice(TOTAL);
      if (!sent.has(lastOne)) {
        sent.add(lastOne);
        sentAt.push({ slice: lastOne, wall });
      }
      break;
    }
  }

  const missing = [];
  for (let i = 0; i < TOTAL; i++) if (!sent.has(i)) missing.push(i);

  // The most sent inside any rolling minute, which is what the database
  // throttle counts.
  let busiest = 0;
  for (const a of sentAt) {
    const inWindow = sentAt.filter((b) => b.wall > a.wall - 60 && b.wall <= a.wall).length;
    busiest = Math.max(busiest, inWindow);
  }

  return {
    sent: sent.size,
    percent: (100 * sent.size) / TOTAL,
    missing,
    busiest,
    opened: (100 * sent.size) / TOTAL >= NEEDS,
  };
}

// =====================================================================
// A WHOLE LESSON, AT EVERY SPEED THE PLAYER ALLOWS
// =====================================================================

for (const rate of [0.75, 1, 1.25, 1.5]) {
  test(`a whole lesson watched at ${rate}x reaches 100 percent and opens`, () => {
    const r = watchWholeLesson(rate);
    assert.deepEqual(
      r.missing,
      [],
      `${rate}x lost ${r.missing.length} slices: ${r.missing.slice(0, 10).join(", ")}`,
    );
    assert.equal(r.sent, TOTAL);
    assert.equal(r.percent, 100);
    assert.ok(r.opened, `${rate}x finished at ${r.percent}% and the check stayed shut`);
  });
}

test("and still does with a phone that cannot keep time", () => {
  // Every tick between 0.7 and 1.3 of its nominal length, which is a
  // worse wobble than a real phone produces.
  for (const rate of [1, 1.25, 1.5]) {
    const r = watchWholeLesson(rate, { jitter: 0.6 });
    assert.deepEqual(
      r.missing,
      [],
      `${rate}x with jitter lost ${r.missing.length} slices`,
    );
    assert.ok(r.opened, `${rate}x with jitter finished at ${r.percent}%`);
  }
});

test("slice 0 is sent, which it never used to be", () => {
  for (const rate of [1, 1.25, 1.5]) {
    const r = watchWholeLesson(rate);
    assert.ok(!r.missing.includes(0), `${rate}x never sent slice 0`);
  }
});

test("the last slice is sent, even though it is only a part of one", () => {
  const r = watchWholeLesson(1.5);
  assert.ok(!r.missing.includes(TOTAL - 1), "the final slice was never sent");
});

// =====================================================================
// AND NOT FASTER THAN THE DATABASE WILL ACCEPT
// =====================================================================

test("even at 1.5x the page never asks for more than the database allows", () => {
  // The limit in file 15: ceil(60 / bucket_seconds * 1.5) + 3 = 12.
  const limit = sendsAllowedPerMinute(BUCKET);
  assert.equal(limit, 12);

  for (const rate of [1, 1.25, 1.5]) {
    const r = watchWholeLesson(rate, { jitter: 0.6 });
    assert.ok(
      r.busiest <= limit,
      `${rate}x asked for ${r.busiest} in one minute and the database allows ${limit}`,
    );
  }
});

test("the two sides of the throttle are worked out from one number", () => {
  // 1.5x at ten second slices is exactly nine a minute, which is why
  // the old limit of nine threw real watching away on any wobble.
  assert.equal(slicesPerMinute(10, 1), 6);
  assert.equal(slicesPerMinute(10, 1.5), 9);
  assert.equal(slicesPerMinute(5, 1.5), 18);
});

// =====================================================================
// A SEEK ADDS NOTHING FOR THE GROUND IT SKIPPED
// =====================================================================

test("jumping forward credits nothing for the part that was skipped", () => {
  const r = watchWholeLesson(1, { seek: { atWall: 30, to: 300, done: false } });
  // Watched 0 to about 30 seconds, jumped to 300, then played to the
  // end. Slices 3 to 29 were never on screen.
  for (let i = 4; i < 29; i++) {
    assert.ok(
      r.missing.includes(i),
      `slice ${i} was skipped over but was credited anyway`,
    );
  }
  // And the part that WAS watched is still credited.
  assert.ok(!r.missing.includes(0), "the start was watched and should count");
  assert.ok(!r.missing.includes(TOTAL - 1), "the end was watched and should count");
});

test("a seek is told apart from the page being descheduled for a moment", () => {
  // A phone that stalls for a second and a half at 1.5x moves the
  // playhead 2.25 seconds in one tick. That is real watching, not a
  // seek, and must be credited.
  const stall = slicesCrossed({
    previous: 100,
    current: 102.25,
    bucketSeconds: BUCKET,
    rate: 1.5,
    tickSeconds: 1,
    totalSlices: TOTAL,
  });
  assert.equal(stall.seeked, false);
  assert.deepEqual(stall.slices, [10]);

  // A real drag, well beyond anything playing could do.
  const drag = slicesCrossed({
    previous: 100,
    current: 300,
    bucketSeconds: BUCKET,
    rate: 1.5,
    tickSeconds: 1,
    totalSlices: TOTAL,
  });
  assert.equal(drag.seeked, true);
  assert.deepEqual(drag.slices, []);

  // Dragging backwards is a seek too, and credits nothing: the ground
  // behind is either already credited or was never watched.
  const back = slicesCrossed({
    previous: 300,
    current: 100,
    bucketSeconds: BUCKET,
    rate: 1,
    tickSeconds: 1,
    totalSlices: TOTAL,
  });
  assert.equal(back.seeked, true);
  assert.deepEqual(back.slices, []);
});

test("the first tick of a play credits the slice it starts in", () => {
  const first = slicesCrossed({
    previous: null,
    current: 0,
    bucketSeconds: BUCKET,
    rate: 1,
    totalSlices: TOTAL,
  });
  assert.deepEqual(first.slices, [0]);

  // Resuming part way through credits where they are, not everything
  // before it.
  const resumed = slicesCrossed({
    previous: null,
    current: 155,
    bucketSeconds: BUCKET,
    rate: 1,
    totalSlices: TOTAL,
  });
  assert.deepEqual(resumed.slices, [15]);
});

test("nothing is ever credited past the end of the lesson", () => {
  const over = slicesCrossed({
    previous: 478,
    current: 480,
    bucketSeconds: BUCKET,
    rate: 1,
    tickSeconds: 1,
    totalSlices: TOTAL,
  });
  assert.ok(over.slices.every((s) => s >= 0 && s < TOTAL));
  assert.equal(over.slices[over.slices.length - 1], TOTAL - 1);
});

// =====================================================================
// THE SPEED CAP, AND THE NUMBER ON THE SCREEN
// =====================================================================

test("the first watch is capped at 1.5x and afterwards it is not", () => {
  assert.equal(cappedRate(2, false), 1.5);
  assert.equal(cappedRate(1.75, false), 1.5);
  assert.equal(cappedRate(1.25, false), 1.25);
  assert.equal(cappedRate(2, true), 2);
});

test("coverage is rounded DOWN wherever it sits next to the mark", () => {
  // 44 of 48 is 91.666..., and rounding to nearest makes that 92. A
  // page saying "you are at 92%" beside a button that opens at 92% and
  // refuses to work is calling the learner a liar about their own
  // screen.
  assert.equal(shownPercent((100 * 44) / 48), 91);
  assert.equal(shownPercent(91.99), 91);
  assert.equal(shownPercent(92), 92);
  assert.equal(shownPercent(100), 100);
  assert.equal(shownPercent(0), 0);
});

// =====================================================================
// THE OLD WAY, KEPT AS A TEST, SO IT CANNOT COME BACK
// =====================================================================

test("the old one-per-ten-wall-seconds rule really did lose a third at 1.5x", () => {
  // Not testing the product: testing that the measurement in this file
  // reproduces the fault. If this ever stops failing, the simulation
  // has drifted and the tests above are no longer proving anything.
  function theOldWay(rate) {
    const sent = new Set();
    let at = 0;
    let playedMs = 0;
    for (let wall = 0; at < SECONDS; wall += TICK) {
      at += TICK * rate;
      playedMs += TICK * 1000;
      if (playedMs >= BUCKET * 1000) {
        playedMs = 0;
        sent.add(Math.floor(Math.min(at, SECONDS - 0.01) / BUCKET));
      }
    }
    return sent.size;
  }
  assert.ok(theOldWay(1.5) < TOTAL * 0.7, "the old way should lose about a third at 1.5x");
  assert.ok(theOldWay(1.25) < TOTAL * 0.85, "the old way should lose about a fifth at 1.25x");
  assert.ok(!Number.isNaN(theOldWay(1)));
});


// =====================================================================
// A BACKLOG MUST DRAIN AT THE DATABASE'S RATE, NOT AS FAST AS IT CAN
// =====================================================================

test("the allowance mirrors the number in database file 15", () => {
  // ceil(60 / 10 * 1.5) + 3
  assert.equal(sendsAllowedPerMinute(10), 12);
  // and it follows the slice size rather than being a magic number
  assert.equal(sendsAllowedPerMinute(5), 21);
  assert.equal(sendsAllowedPerMinute(20), 8);
});

test("draining a tunnel's worth of backlog loses nothing", () => {
  // Two minutes offline at 1x is twelve slices queued, on top of the
  // six a minute still arriving. Sent as fast as the network allows,
  // the database stores a dozen and ignores the rest, and because a
  // throttled reply looks exactly like a stored one the queue would
  // delete them all. Paced, every one gets through.
  const perMinute = sendsAllowedPerMinute(BUCKET);
  let queued = 12; // the tunnel
  let stored = 0;
  const sentAt = [];

  for (let second = 0; second < 600; second += 1) {
    // still watching, so a new slice every ten seconds
    if (second % BUCKET === 0 && second > 0) queued += 1;

    const room =
      sentAt.filter((t) => second - t < 60).length < perMinute;
    if (queued > 0 && room) {
      sentAt.push(second);
      queued -= 1;
      stored += 1;
    }
  }

  assert.equal(queued, 0, `${queued} slices never got through`);
  assert.ok(stored >= 12, "the tunnel itself must survive");
});

// =====================================================================
// A BACKGROUND TAB MUST NOT LOOK LIKE A SEEK
// =====================================================================

test("a throttled timer in a background tab still credits the watching", () => {
  // A browser throttles setInterval hard when the tab is hidden, often
  // to once a minute. The playhead has moved sixty seconds since the
  // last tick and every one of them was really watched. Judging that
  // against the timer's NOMINAL one second would call it a seek and
  // credit none of it.
  const backgrounded = slicesCrossed({
    previous: 100,
    current: 160,
    bucketSeconds: BUCKET,
    rate: 1,
    tickSeconds: 60, // what actually elapsed, not what was asked for
    totalSlices: TOTAL,
  });
  assert.equal(backgrounded.seeked, false);
  assert.deepEqual(backgrounded.slices, [10, 11, 12, 13, 14, 15, 16]);

  // The same sixty second jump, when only one second really passed, is
  // a seek and credits nothing.
  const dragged = slicesCrossed({
    previous: 100,
    current: 160,
    bucketSeconds: BUCKET,
    rate: 1,
    tickSeconds: 1,
    totalSlices: TOTAL,
  });
  assert.equal(dragged.seeked, true);
  assert.deepEqual(dragged.slices, []);
});
