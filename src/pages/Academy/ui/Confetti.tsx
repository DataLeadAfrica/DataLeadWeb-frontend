import { useEffect, useState } from "react";

import "./Confetti.css";

// One short burst of colour when somebody finishes a course.
//
// THE RULES THE BRIEF SET, and they are the right ones:
//
//   TRANSFORM AND OPACITY ONLY. No canvas, no requestAnimationFrame
//   loop. Every piece is a div with one CSS animation on it, so the
//   whole thing runs on the compositor and costs a phone almost
//   nothing.
//
//   IT STOPS. The pieces are removed from the page after the animation,
//   rather than animating forever at opacity 0. A looping animation in
//   a tab somebody left open is a battery being spent on nothing.
//
//   NONE AT ALL with reduced motion. Not slower, not smaller: none. The
//   page says the same thing without it, which is the test for whether
//   movement was carrying information.

const PIECES = 40;
const LIFE_MS = 3200;

// The Academy's own colours plus the ink, rather than a rainbow. It
// should look like this site celebrating, not like a party invitation.
const COLOURS = ["#f56e0f", "#f9a971", "#0d7a4e", "#16151b", "#ffd2b0"];

export default function Confetti() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    setOn(true);
    const timer = window.setTimeout(() => setOn(false), LIFE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!on) return null;

  return (
    <div className="acad-confetti" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => {
        // Worked out once per piece, at render, rather than animated.
        const left = (i * 97) % 100;
        const delay = (i % 7) * 90;
        const drift = ((i * 37) % 120) - 60;
        const spin = ((i * 53) % 540) + 180;
        return (
          <i
            key={i}
            style={{
              left: `${left}%`,
              background: COLOURS[i % COLOURS.length],
              animationDelay: `${delay}ms`,
              // Custom properties, so the keyframes stay one rule and
              // each piece only varies the numbers.
              ["--drift" as string]: `${drift}px`,
              ["--spin" as string]: `${spin}deg`,
            }}
          />
        );
      })}
    </div>
  );
}
