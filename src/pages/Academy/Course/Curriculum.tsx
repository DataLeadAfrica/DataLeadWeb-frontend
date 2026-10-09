import "./Curriculum.css";
import { asClock, asLength, type CourseModule } from "../../../lib/catalogue";
import { PlayIcon, TickIcon } from "../ui/Icons";

// Every module and every lesson, with its length.
//
// This is the part a search engine reads most closely, because it is the
// only place the words somebody actually searched for appear: "recoding
// answers", "summary tables", "cleaning survey data". So it is real
// markup, not a list built by JavaScript from a blob, and the edge
// function writes the same titles into the page before React boots.
//
// <details> again, so the first module is open, the rest are closed, and
// the browser handles the rest. Find on this page can open a closed one
// to show a match inside it, which a React accordion cannot.

export default function Curriculum({ modules }: { modules: CourseModule[] }) {
  const mods = modules || [];
  if (mods.length === 0) return null;

  return (
    <div className="acad-curr">
      {mods.map((m, i) => (
        <details key={m.position} className="acad-curr__mod" open={i === 0}>
          <summary className="acad-curr__head">
            <span className="acad-curr__n">{String(m.position).padStart(2, "0")}</span>
            <span className="acad-curr__words">
              <b>{m.title}</b>
              <small>
                {m.lessons} lesson{m.lessons === 1 ? "" : "s"}
                {m.seconds ? ` · ${asLength(m.seconds)}` : ""}
                {m.quizzes > 0 ? " · quiz" : ""}
              </small>
            </span>
            {m.free ? <span className="acad-tag">Free</span> : null}
            <i className="acad-curr__mark" aria-hidden="true" />
          </summary>

          <ol className="acad-curr__lessons">
            {(m.lesson_list || []).map((l) => (
              <li key={l.position}>
                <span className="acad-curr__icon" aria-hidden="true">
                  {l.type === "quiz" ? <TickIcon /> : <PlayIcon />}
                </span>
                <span className="acad-curr__title">{l.title}</span>
                {m.free ? <span className="acad-tag">Free</span> : null}
                <span className="acad-curr__len">
                  {l.seconds ? asClock(l.seconds) : ""}
                </span>
              </li>
            ))}
            {m.quizzes > 0 ? (
              <li className="acad-curr__quizrow">
                <span className="acad-curr__icon" aria-hidden="true">
                  <TickIcon />
                </span>
                <span className="acad-curr__title">
                  Module {m.position} quiz
                </span>
                <span className="acad-curr__len" />
              </li>
            ) : null}
          </ol>
        </details>
      ))}
    </div>
  );
}
