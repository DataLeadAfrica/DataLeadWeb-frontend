import { Link } from "react-router";

import "./Breadcrumb.css";

// The trail at the top of the two inner Academy pages.
//
// WHY IT IS A COMPONENT. It was written out by hand on both pages, and
// the styles for it lived in Courses/page.css. Each Academy page is now
// loaded on its own, so the course page never loaded that stylesheet and
// its trail arrived unstyled: plain blue underlined links instead of the
// small mono type. It looked right only if you happened to visit the
// catalogue first, which is exactly what somebody arriving from a search
// result does not do.
//
// The last item is the page you are on, so it is never a link. A link to
// the page you are already looking at is a dead control.

export type Crumb = { label: string; to?: string };

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="acad-crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`}>
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {c.to && i < items.length - 1 ? (
              <Link to={c.to}>{c.label}</Link>
            ) : (
              <b aria-current="page">{c.label}</b>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
