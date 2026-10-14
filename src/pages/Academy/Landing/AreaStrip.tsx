import { Link } from "react-router";

import "./AreaStrip.css";
import { GoalIcon } from "../ui/Icons";
import { type LandingArea } from "../../../lib/catalogue";
import { routes } from "../../routes";

// One line of areas, directly under the hero: "Explore by area", then
// every area as a pill that opens the catalogue filtered to it.
//
// WHERE IT SITS IS THE POINT, and the brief is specific about it: ABOVE
// the Africa map, never under it. The map is decoration that bleeds out
// of the hero, and a row of links drawn over the top of it reads as
// part of the picture rather than as something to press. Above it, with
// the page's own background behind it, it reads as a row of links.
//
// EVERY AREA, not only the ones with a course. The seven areas are what
// the Academy is; an area with nothing in it yet still tells somebody
// that we teach it. The catalogue will show them an empty result and
// say so, which is a better answer than never offering the area at all.

export default function AreaStrip({ areas }: { areas: LandingArea[] }) {
  if (areas.length === 0) return null;

  return (
    <nav className="acad-strip" aria-label="Explore by area">
      <span className="acad-strip__label">Explore by area</span>
      {areas.map((a) => (
        <Link
          key={a.slug}
          className="acad-strip__pill"
          to={`${routes.academyCourses}?area=${encodeURIComponent(a.name)}`}
        >
          <GoalIcon area={a.icon_key} />
          {a.name}
        </Link>
      ))}
    </nav>
  );
}
