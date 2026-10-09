import "./CourseMap.css";
import { asLength, type CourseModule } from "../../../lib/catalogue";

// One bar showing the whole course: each module as wide as it is long,
// with a dark mark where a quiz sits.
//
// It is the same idea as the watch tape, at the size of a course rather
// than a lesson, so somebody who has seen one understands the other. It
// answers "how is this split up" in a glance, which a list of module
// names does not.
//
// Decoration, so it is aria-hidden: the curriculum below says all of
// this in words, in order, and a screen reader should read that instead
// of a row of unlabelled strips.

type Props = { modules: CourseModule[]; total: number };

export default function CourseMap({ modules, total }: Props) {
  const mods = (modules || []).filter((m) => (m.seconds || 0) > 0);
  if (mods.length === 0 || !total) return null;

  return (
    <div className="acad-map" aria-hidden="true">
      <div className="acad-map__bar">
        {mods.map((m) => (
          <span
            key={m.position}
            className="acad-map__seg"
            style={{ flexGrow: Math.max(1, m.seconds) }}
          >
            {m.quizzes > 0 ? <i className="acad-map__quiz" /> : null}
          </span>
        ))}
      </div>
      <div className="acad-map__labels">
        {mods.map((m) => (
          <span
            key={m.position}
            className="acad-map__label"
            style={{ flexGrow: Math.max(1, m.seconds) }}
          >
            Module {m.position} {"·"} {asLength(m.seconds)}
          </span>
        ))}
      </div>
    </div>
  );
}
