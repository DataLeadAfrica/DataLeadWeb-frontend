import { useEffect, useRef, useState } from "react";

import "../academy.css";
import "./AcadStage.css";

// The stage every Academy page sits on: a light panel under the normal
// white site Header, with a fine grid and one soft orange glow drifting
// across it.
//
// It is also the element that carries the .acad class, and therefore every
// design token. Nothing in the Academy renders outside it.
//
// The glow drifts forever, so this component switches it off when the tab
// is hidden. A looping animation in a background tab costs a phone battery
// for nothing. It is done by toggling one attribute and letting CSS pause
// the animations, rather than by a timer or a frame loop.

type Props = {
  children: React.ReactNode;
  /** "split" is the two column account layout, "wide" is a full width page. */
  width?: "split" | "wide";
  /** True on a page whose whole job is one task: sign up, sign in, reset,
      My learning, and in Phase 4 the lesson player. It adds
      .acad-stage--focus, which academy.css uses to hide the site's
      floating WhatsApp button. Leave it off on the public Academy pages,
      where the button is wanted. */
  focus?: boolean;
  /** True on a page with the sticky buy bar at the bottom on phones.
      It adds .acad-stage--buybar, which academy.css uses to lift the
      site's floating WhatsApp button clear of the bar instead of
      hiding it: a course page is public, and the button belongs
      there. */
  buyBar?: boolean;
};

export default function AcadStage({
  children,
  width = "split",
  focus = false,
  buyBar = false,
}: Props) {
  const [hidden, setHidden] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onVisibility() {
      setHidden(document.visibilityState === "hidden");
    }
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <main
      ref={root}
      className={
        "acad acad-stage" +
        (focus ? " acad-stage--focus" : "") +
        (buyBar ? " acad-stage--buybar" : "")
      }
      data-still={hidden ? "yes" : undefined}
    >
      <div className={`acad-stage__wrap acad-stage__wrap--${width}`}>
        {children}
      </div>
    </main>
  );
}
