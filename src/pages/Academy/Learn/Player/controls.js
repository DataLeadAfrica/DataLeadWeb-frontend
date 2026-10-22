// The arithmetic behind the control bar.
//
// PLAIN JAVASCRIPT, beside a .d.ts, the same way slices.js is, so that
// node --test can import it without a browser. Everything here is a
// pure function of numbers: the bar itself does the talking to YouTube,
// and this does the thinking, which is the half that can be wrong in a
// way nobody notices.
//
// EVERY ONE OF THESE GUARDS A ZERO DURATION. A lesson whose length was
// never recorded reports 0, and a scrub bar that divides by it renders
// NaN into the style attribute, which in practice means a bar that
// jumps to full width or vanishes. File 20 was about video lessons with
// no duration, so this is not a hypothetical.

/** Where a click at `fraction` across the scrub bar should seek to. */
export function seekTarget(fraction, duration) {
  const d = Number(duration);
  if (!Number.isFinite(d) || d <= 0) return 0;
  const f = Number(fraction);
  if (!Number.isFinite(f)) return 0;
  return Math.min(d, Math.max(0, f * d));
}

/** How far along the bar the playhead is, 0 to 1. */
export function scrubFraction(position, duration) {
  const d = Number(duration);
  const p = Number(position);
  if (!Number.isFinite(d) || d <= 0) return 0;
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.min(1, p / d);
}

/** A volume between 0 and 100, from a slider that may hand over anything. */
export function clampVolume(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

/**
 * What the captions button should say and do.
 *
 * THREE STATES, NOT TWO. A video with no caption track is not the same
 * as one whose captions are off, and a button that silently does
 * nothing is worse than one that says why. The player cannot always
 * tell us whether a track exists until it has loaded, so "unknown" is
 * treated as available and the button simply fails to change anything,
 * which is the least bad of the three wrong answers.
 */
export function captionButton(available, on) {
  if (available === false) {
    return { label: "No captions", pressed: false, disabled: true };
  }
  return {
    label: on ? "Captions on" : "Captions",
    pressed: !!on,
    disabled: false,
  };
}

/**
 * Seconds to a clock, as a learner reads one.
 *
 * Hours only when there are hours. A 90 second lesson reading "0:01:30"
 * looks like a mistake.
 */
export function clockText(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const whole = Math.floor(s);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const sec = whole % 60;
  const two = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
