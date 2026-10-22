// The control bar's arithmetic, without a browser.
//
// YouTube cannot be reached from the machine these run on, so the parts
// that need a real video are on the preview checklist in
// docs/lms/PHASE-6E-FILE-25-PREVIEW-CHECKS.md instead. What IS testable
// here is every number the bar works out, and a zero duration is the
// case worth having: file 20 existed because video lessons were going
// out with no length recorded, and a scrub bar that divides by that
// renders NaN into a style attribute.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  captionButton,
  clampVolume,
  clockText,
  scrubFraction,
  seekTarget,
} from "../src/pages/Academy/Learn/Player/controls.js";

test("seeking lands inside the video, never outside it", () => {
  assert.equal(seekTarget(0, 100), 0);
  assert.equal(seekTarget(0.5, 100), 50);
  assert.equal(seekTarget(1, 100), 100);
  // A click a pixel past either end of the bar is still a click on it.
  assert.equal(seekTarget(-0.2, 100), 0);
  assert.equal(seekTarget(1.4, 100), 100);
});

test("seeking a lesson with no recorded length goes nowhere, quietly", () => {
  // Not an error and not a jump to the end. Nowhere is the honest
  // answer when nothing knows how long the thing is.
  assert.equal(seekTarget(0.5, 0), 0);
  assert.equal(seekTarget(0.5, -10), 0);
  assert.equal(seekTarget(0.5, NaN), 0);
  assert.equal(seekTarget(NaN, 100), 0);
});

test("the playhead sits between the ends of the bar", () => {
  assert.equal(scrubFraction(0, 100), 0);
  assert.equal(scrubFraction(25, 100), 0.25);
  assert.equal(scrubFraction(100, 100), 1);
  // Past the end, which happens: the clock ticks on after the last
  // frame while the player settles.
  assert.equal(scrubFraction(140, 100), 1);
  assert.equal(scrubFraction(-5, 100), 0);
});

test("a zero duration gives a fraction of zero, not NaN", () => {
  // THE ONE THAT MATTERS. NaN reaches the style attribute as
  // "width: NaN%", which browsers drop, so the bar silently renders at
  // whatever the previous width was.
  const f = scrubFraction(30, 0);
  assert.equal(f, 0);
  assert.ok(Number.isFinite(f));
});

test("volume stays between silent and full", () => {
  assert.equal(clampVolume(0), 0);
  assert.equal(clampVolume(55), 55);
  assert.equal(clampVolume(100), 100);
  assert.equal(clampVolume(140), 100);
  assert.equal(clampVolume(-3), 0);
  assert.equal(clampVolume(55.6), 56);
  assert.equal(clampVolume(NaN), 0);
});

test("the captions button says which of the three things is true", () => {
  assert.deepEqual(captionButton(true, false), {
    label: "Captions",
    pressed: false,
    disabled: false,
  });
  assert.deepEqual(captionButton(true, true), {
    label: "Captions on",
    pressed: true,
    disabled: false,
  });
  // A video with no track says so rather than offering a button that
  // does nothing when pressed.
  assert.deepEqual(captionButton(false, false), {
    label: "No captions",
    pressed: false,
    disabled: true,
  });
});

test("captions not yet known are offered rather than hidden", () => {
  // The player cannot always say whether a track exists until it has
  // loaded. Offering the button and having it do nothing is better than
  // hiding it and having it never come back once the answer arrives.
  assert.equal(captionButton(null, false).disabled, false);
});

test("the clock reads the way somebody would say it", () => {
  assert.equal(clockText(0), "0:00");
  assert.equal(clockText(9), "0:09");
  assert.equal(clockText(90), "1:30");
  assert.equal(clockText(600), "10:00");
  // Hours only once there are hours.
  assert.equal(clockText(3600), "1:00:00");
  assert.equal(clockText(3661), "1:01:01");
  assert.equal(clockText(45.9), "0:45");
});

test("the clock refuses to show nonsense", () => {
  assert.equal(clockText(NaN), "0:00");
  assert.equal(clockText(-30), "0:00");
  assert.equal(clockText(undefined), "0:00");
});
