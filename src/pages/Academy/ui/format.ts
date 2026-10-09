// Small shared formatters for the Academy. They live apart from the
// components so each component file exports a component and nothing else.

/** 600 becomes "10:00". Used for the life of a code and, in Phase 4, for
    the position in a lesson. */
export function asClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
