import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { ArrowIcon, PlusIcon, TickIcon, WarnIcon } from "../Icons";
import { Done, Head, Problem, Waiting } from "../ui";
import { certDb } from "../../../../lib/certificates";
import {
  createPath,
  getOverview,
  getPathBlockers,
  publishPath,
  setPathCourses,
  type PathBlocker,
  type StudioCourse,
} from "../../../../lib/studio";
import { routes } from "../../../routes";

// Learning paths.
//
// A PATH IS SEVERAL COURSES IN A DELIBERATE ORDER, and the order is the
// thing being set here, so the courses are saved as a whole list rather
// than one at a time. A sequence of single inserts has an order of its
// own that nobody chose.
//
// PUBLISHING A PATH IS FILE 16'S lms_publish_path, not a second opinion
// written here. It already refuses while any course in the path is
// unpublished or the exam bank is short, and two functions deciding when
// a path may go live is one too many.
//
// A FACILITATOR SEES THIS PAGE, AND SEES IT READ ONLY, which is the
// honest version of two rules that do not quite meet. The brief puts
// Learning paths in the build group, so it is not an administrator-only
// page. But every path function in file 17 is administrators only, and
// file 10's policy on lms_paths shows a facilitator only the PUBLISHED
// ones.
//
// So without this, a facilitator would open the page, see fewer paths
// than exist with nothing saying why, and press buttons that the
// database would refuse. Hiding the buttons and saying what they are
// looking at is better than either pretending or locking them out: a
// path is the thing their course sits inside, and knowing which paths
// exist is part of building for one.

type PathRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  certificate_name: string | null;
};

function Inner({ isAdmin }: { isAdmin: boolean }) {
  const [paths, setPaths] = useState<PathRow[] | null>(null);
  // WHAT IS STILL STANDING IN THE WAY, per path, asked of the server
  // rather than worked out here, so this screen and lms_publish_path
  // cannot come to different conclusions about the same path.
  const [blockers, setBlockers] = useState<Record<string, PathBlocker[]>>({});
  const [courses, setCourses] = useState<StudioCourse[]>([]);
  const [inPath, setInPath] = useState<Record<string, string[]>>({});
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [certName, setCertName] = useState("");

  const load = useCallback(async () => {
    if (!certDb) return;
    const { data, error } = await certDb.from("lms_paths").select("*").order("name");
    if (error) {
      setProblem(error.message);
      return;
    }
    setPaths((data || []) as PathRow[]);

    const pc = await certDb.from("lms_path_courses").select("path_id, course_id, position");
    if (!pc.error) {
      const by: Record<string, string[]> = {};
      ((pc.data || []) as { path_id: string; course_id: string; position: number }[])
        .sort((a, b) => a.position - b.position)
        .forEach((r) => {
          by[r.path_id] = [...(by[r.path_id] || []), r.course_id];
        });
      setInPath(by);
    }

    const o = await getOverview();
    if (o.ok) setCourses(o.data.courses);

    const rows = (data || []) as PathRow[];
    const found: Record<string, PathBlocker[]> = {};
    for (const row of rows) {
      if (row.status === "published") continue;
      const b = await getPathBlockers(row.id);
      if (b.ok) found[row.id] = b.data;
    }
    setBlockers(found);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (problem && !paths) return <Problem>{problem}</Problem>;
  if (!paths) return <Waiting what="the paths" />;

  return (
    <>
      <Seo title="Learning paths | Control room" noindex />

      <Head
        eyebrow="Build"
        title="Learning paths"
        sub="Several courses in the order that makes sense, with one professional certificate at the end."
        actions={
          isAdmin ? (
            <button type="button" className="acad-btn" onClick={() => setMaking(true)}>
              <PlusIcon />
              New path
            </button>
          ) : null
        }
      />

      {!isAdmin ? (
        <p className="stu__msg is-warn" style={{ marginBottom: 18 }}>
          <WarnIcon />
          <span>
            <b>You are seeing the published paths, and seeing them read only.</b> Building a path
            is an administrator's job, and the ones still in draft are not shown. Your courses can
            be put into a path by an administrator at any time.
          </span>
        </p>
      ) : null}

      <Problem>{problem}</Problem>
      <Done>{done}</Done>

      {making && isAdmin ? (
        <div className="stu__panel" style={{ marginBottom: 18 }}>
          <header>
            <h2>A new path</h2>
            <button type="button" className="stu__chip" onClick={() => setMaking(false)}>
              Close
            </button>
          </header>
          <div className="stu__grid stu__g2">
            <label className="stu__field">
              <span>What is it called?</span>
              <input
                className="stu__in"
                value={name}
                autoFocus
                placeholder="Data Analyst"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="stu__field">
              <span>What the certificate says</span>
              <input
                className="stu__in"
                value={certName}
                placeholder="Professional Certificate in Data Analysis"
                onChange={(e) => setCertName(e.target.value)}
              />
              <small>Left empty, it becomes "Professional Certificate in {name || "..."}".</small>
            </label>
          </div>
          <button
            type="button"
            className="acad-btn"
            style={{ marginTop: 14 }}
            onClick={async () => {
              const got = await createPath(name, certName);
              if (got.ok) {
                setDone("Made as a draft, with its path exam ready to write.");
                setName("");
                setCertName("");
                setMaking(false);
                load();
              } else setProblem(got.message);
            }}
          >
            Make the path
          </button>
        </div>
      ) : null}

      <div className="stu__grid">
        {paths.length === 0 ? (
          <div className="stu__empty">No paths yet.</div>
        ) : (
          paths.map((p) => {
            const mine = inPath[p.id] || [];
            return (
              <section className="stu__panel" key={p.id}>
                <header>
                  <div>
                    <h3>{p.name}</h3>
                    <p className="stu__hint" style={{ marginTop: 4 }}>
                      {p.certificate_name || "No certificate name"}
                    </p>
                  </div>
                  <span className={`stu__tag ${p.status === "published" ? "is-live" : "is-draft"}`}>
                    {p.status === "published" ? "Live" : "Draft"}
                  </span>
                </header>

                <p className="stu__label" style={{ marginBottom: 8 }}>
                  The courses, in order
                </p>
                <div className="stu__chips">
                  {courses.map((c) => {
                    const at = mine.indexOf(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="stu__chip"
                        aria-pressed={at >= 0}
                        disabled={!isAdmin}
                        onClick={async () => {
                          const next =
                            at >= 0 ? mine.filter((x) => x !== c.id) : [...mine, c.id];
                          const got = await setPathCourses(p.id, next);
                          if (got.ok) {
                            setDone("Saved.");
                            load();
                          } else setProblem(got.message);
                        }}
                      >
                        {at >= 0 ? <small>{at + 1}</small> : null}
                        {c.title}
                      </button>
                    );
                  })}
                </div>

                <p className="stu__hint" style={{ marginTop: 12 }}>
                  {mine.length} course{mine.length === 1 ? "" : "s"}. It can go live once every one
                  of them is published and the path exam holds 60 questions. A learner who finishes
                  a course in another path has it here too.
                </p>

                {p.status !== "published" && (blockers[p.id] || []).length ? (
                  <ul className="stu__steps" style={{ marginTop: 10 }}>
                    {(blockers[p.id] || []).map((b) => (
                      <li key={b.label} className={`stu__step ${b.ok ? "is-done" : "is-todo"}`}>
                        {b.ok ? <TickIcon /> : <WarnIcon />}
                        <div>
                          <b>{b.label}</b>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="stu__chips" style={{ marginTop: 10 }}>
                  {/* THE WAY INTO THE PATH EXAM. Until this link
                      existed the exam had no address at all, so the
                      sentence above about holding 60 questions named a
                      condition nobody could meet. Administrators only,
                      which is what lms_studio_questions enforces
                      underneath whatever this page shows. */}
                  {/* PUBLISHING A PATH. lms_publish_path has been on the
                      server since file 16 and was called by nothing, so no
                      path could ever go live and no path certificate could
                      ever be issued. The blockers are listed above rather
                      than left for the button to discover, because a button
                      that fails and then explains is a worse screen than one
                      that says what is left before you press it. */}
                  {isAdmin && p.status !== "published" ? (
                    <button
                      type="button"
                      className="stu__chip"
                      disabled={(blockers[p.id] || []).some((b) => !b.ok)}
                      onClick={async () => {
                        setProblem("");
                        const got = await publishPath(p.id);
                        if (got.ok) {
                          setDone("The path is live.");
                          load();
                        } else setProblem(got.message);
                      }}
                    >
                      Publish the path
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <Link
                      className="stu__chip"
                      to={routes.studioPathQuestions.replace(":id", p.id)}
                    >
                      Write the path exam
                      <ArrowIcon />
                    </Link>
                  ) : null}
                  <a
                    className="stu__chip"
                    href={`/lms/paths/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    See it as a learner
                    <ArrowIcon />
                  </a>
                </div>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}

export default function StudioPathsPage() {
  return <RequireStaff>{(role) => <Inner isAdmin={role === "admin"} />}</RequireStaff>;
}
