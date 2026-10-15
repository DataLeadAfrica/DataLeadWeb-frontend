import { useCallback, useEffect, useState } from "react";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { GoalIcon } from "../../ui/Icons";
import { PlusIcon } from "../Icons";
import { Done, Head, Problem, Waiting } from "../ui";
import { addAreaTool, getAreas, removeAreaTool, type AreaOverview } from "../../../../lib/studio";

// Areas and tools.
//
// A TOOL WITH NO COURSE IS THE POINT OF THIS PAGE. The landing picker
// shows every tool an area teaches, and says "Coming soon" for the ones
// with nothing behind them yet. You cannot build that list out of the
// courses, because the whole value is the ones that are not there.
//
// THE ICONS ARE THE DATABASE'S. Each area carries an icon_key and the
// page draws whatever that says, so the seven here are the same seven a
// learner sees on the landing page. A test holds the two in step.

function Inner({ isAdmin }: { isAdmin: boolean }) {
  const [areas, setAreas] = useState<AreaOverview[] | null>(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const [adding, setAdding] = useState("");
  const [tool, setTool] = useState("");

  const load = useCallback(() => {
    getAreas().then((a) => {
      if (a.ok) setAreas(a.data);
      else setProblem(a.message);
    });
  }, []);

  useEffect(load, [load]);

  if (problem && !areas) return <Problem>{problem}</Problem>;
  if (!areas) return <Waiting what="the areas" />;

  return (
    <>
      <Seo title="Areas and tools | Control room" noindex />

      <Head
        eyebrow="Build"
        title="Areas and tools"
        sub="The seven areas the Academy teaches, and every tool or skill inside them, whether or not there is a course for it yet."
      />

      <Problem>{problem}</Problem>
      <Done>{done}</Done>

      <div className="stu__grid stu__g2">
        {areas.map((a) => (
          <section className="stu__panel" key={a.area_id}>
            <header>
              <div className="stu__who">
                <GoalIcon area={a.icon_key} className="stu__areaicon" />
                <span>
                  <b>{a.name}</b>
                  <small>
                    {a.published_count} live, {a.course_count} in all
                  </small>
                </span>
              </div>
              <span className="stu__label">
                {a.tool_count} tool{a.tool_count === 1 ? "" : "s"}
              </span>
            </header>

            <div className="stu__chips">
              {a.tools.map((t) => (
                <span className="stu__chip" key={t.id} style={{ cursor: "default" }}>
                  {t.name}
                  {t.course ? null : <small>coming soon</small>}
                  {isAdmin ? (
                    <button
                      type="button"
                      className="stu__link"
                      aria-label={`Remove ${t.name}`}
                      style={{ color: "var(--acad-faint)" }}
                      onClick={async () => {
                        const got = await removeAreaTool(t.id);
                        if (got.ok) {
                          setDone(`${t.name} removed from ${a.name}.`);
                          load();
                        } else setProblem(got.message);
                      }}
                    >
                      x
                    </button>
                  ) : null}
                </span>
              ))}
              {a.tools.length === 0 ? (
                <p className="stu__hint">Nothing listed yet.</p>
              ) : null}
            </div>

            {isAdmin ? (
              adding === a.name ? (
                <div className="stu__grid" style={{ gap: 8, marginTop: 12 }}>
                  <input
                    className="stu__in"
                    value={tool}
                    autoFocus
                    placeholder="KoboToolbox"
                    aria-label={`A tool for ${a.name}`}
                    onChange={(e) => setTool(e.target.value)}
                  />
                  <small className="stu__hint">
                    Exact names matter. MySQL, not SQL. It appears on the landing page straight
                    away, as Coming soon until a course uses it.
                  </small>
                  <div className="stu__chips">
                    <button
                      type="button"
                      className="acad-btn acad-btn--auto"
                      onClick={async () => {
                        const got = await addAreaTool(a.name, tool);
                        if (got.ok) {
                          setDone(`${tool} added to ${a.name}.`);
                          setTool("");
                          setAdding("");
                          load();
                        } else setProblem(got.message);
                      }}
                    >
                      Add it
                    </button>
                    <button type="button" className="stu__chip" onClick={() => setAdding("")}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="stu__chip"
                  style={{ marginTop: 12 }}
                  onClick={() => setAdding(a.name)}
                >
                  <PlusIcon />
                  Add a tool
                </button>
              )
            ) : null}
          </section>
        ))}
      </div>

      {!isAdmin ? (
        <p className="stu__hint" style={{ marginTop: 16 }}>
          Only an administrator can add or remove a tool.
        </p>
      ) : null}
    </>
  );
}

export default function StudioAreasPage() {
  return <RequireStaff>{(role) => <Inner isAdmin={role === "admin"} />}</RequireStaff>;
}
