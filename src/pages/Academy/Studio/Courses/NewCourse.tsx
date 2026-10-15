import { useEffect, useRef, useState } from "react";

import { CrossIcon, PlusIcon } from "../Icons";
import { Problem } from "../ui";
import { createCourse, getAreas, type AreaOverview } from "../../../../lib/studio";

// "Start a course", as a drawer.
//
// FOUR FIELDS AND NOTHING ELSE. A title, an area, a tool and a level.
// Everything else a course needs is on the Details tab afterwards, and
// asking for it here would be a long form standing between somebody and
// the thing they actually came to do, which is write the first lesson.
//
// THE AREA LIST IS THE DATABASE'S SEVEN, not a list typed in here. If
// somebody adds an eighth on Areas and tools, it appears in this drawer
// with no deployment, and a course can never be created in an area that
// does not exist.

type Props = {
  onClose: () => void;
  onMade: (id: string) => void;
};

export default function NewCourse({ onClose, onMade }: Props) {
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [tool, setTool] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [areas, setAreas] = useState<AreaOverview[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    getAreas().then((a) => {
      if (a.ok) {
        setAreas(a.data);
        if (a.data.length) setArea(a.data[0].name);
      }
    });
  }, []);

  // The tools of the chosen area, so the second field narrows the third
  // instead of asking somebody to remember how a tool is spelt. They can
  // still type their own: a course can be the first of its tool.
  const tools = areas.find((a) => a.name === area)?.tools || [];

  async function make() {
    setProblem("");
    setBusy(true);
    const got = await createCourse(title, area, tool, level);
    setBusy(false);
    if (!got.ok) {
      setProblem(got.message);
      return;
    }
    onMade(got.data);
  }

  return (
    <>
      <div className="stu__scrim" onClick={onClose} />
      <aside className="stu__drawer" role="dialog" aria-modal="true" aria-labelledby="newc">
        <header>
          <div>
            <p className="stu__eyebrow">Build</p>
            <h2 id="newc" className="stu__h2">
              Start a course
            </h2>
          </div>
          <button type="button" className="stu__x" onClick={onClose} aria-label="Close">
            <CrossIcon />
          </button>
        </header>

        <div>
          <div className="stu__grid">
            <label className="stu__field">
              <span>What is it called?</span>
              <input
                ref={first}
                className="stu__in"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Power BI for M and E dashboards"
              />
              <small>
                The address is made from this and can be changed later, before it goes live.
              </small>
            </label>

            <label className="stu__field">
              <span>Which area?</span>
              <select
                className="stu__in"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setTool("");
                }}
              >
                {areas.map((a) => (
                  <option key={a.area_id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
              <small>A course can sit in more than one. This is the main one, and it decides the cover.</small>
            </label>

            <label className="stu__field">
              <span>Which tool or skill?</span>
              <input
                className="stu__in"
                value={tool}
                list="stu-tools"
                onChange={(e) => setTool(e.target.value)}
                placeholder="Power BI"
              />
              <datalist id="stu-tools">
                {tools.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
              <small>
                Pick one this area already teaches, or type a new one. Exact names matter: MySQL, not SQL.
              </small>
            </label>

            <label className="stu__field">
              <span>Who is it for?</span>
              <select className="stu__in" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Mastery</option>
              </select>
            </label>

            <Problem>{problem}</Problem>

            <p className="stu__hint">
              It is made as a draft with its first module, its certificate programme and an empty
              course exam, so there is nothing to set up before you write lesson one.
            </p>

            <button
              type="button"
              className="acad-btn"
              disabled={busy || title.trim().length === 0}
              onClick={make}
            >
              {busy ? "Making it" : "Make the course"}
              {busy ? null : <PlusIcon />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
