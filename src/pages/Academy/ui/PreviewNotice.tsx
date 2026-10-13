import "./PreviewNotice.css";

import { ACADEMY_PUBLIC, PREVIEW_NOTICE } from "../../../lib/site";

// One slim line at the top of every /lms page, while the Academy is
// not open to the public.
//
// WHY IT EXISTS. From 9 October the real dataleadafrica.com has been
// serving the Academy, and until launch day it has to keep doing that:
// the Phase 5 test runs on the real site, not on a copy. So the pages
// work, and anybody who does reach one is told plainly that it is not
// open yet rather than left to guess from a catalogue with one test
// course in it.
//
// WHY IT IS RENDERED HERE AND NOWHERE ELSE. It goes on EVERY /lms page,
// including the four learning pages and the three account pages, so it
// is rendered once inside the router's page() wrapper. Putting it in
// each page would mean eleven places to forget it, and the one that got
// forgotten would be the one somebody found.
//
// NO CLOSE BUTTON, ON PURPOSE. A notice that can be dismissed needs
// somewhere to remember that it was, and a visitor who dismissed it on
// Tuesday and comes back on Thursday is a visitor who now believes the
// Academy is open. It is one line and it goes away on launch day, by
// itself, when ACADEMY_PUBLIC becomes true.
//
// IT IS NOT IN THE SHARE PICTURE. The picture is drawn by api/og.js on
// the server, from the course's own title and cover, and it never reads
// anything from the page. Nor is this line in the HTML the edge
// function writes: a crawler's snippet should not be a sentence about a
// preview, and the pages carry noindex while the switch is off anyway.
// tests/launch-switch.test.mjs checks both.

export default function PreviewNotice() {
  if (ACADEMY_PUBLIC) return null;
  return (
    <p className="acad-preview" role="status">
      {PREVIEW_NOTICE}
    </p>
  );
}
