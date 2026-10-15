import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import NewCourse from "./NewCourse";
import { ArrowIcon, PlusIcon, SearchIcon } from "../Icons";
import { Head, Problem, StateTag, Waiting } from "../ui";
import { getOverview, asWhen, type StudioCourse } from "../../../../lib/studio";
import { routes } from "../../../routes";

// Every course, as a table.
//
// A FACILITATOR SEES ONLY WHAT THEY BUILT, and that is not done here.
// lms_studio_overview returns their courses and nobody else's, so this
// page draws what it is given. Filtering in the page would mean the
// whole list travelled to the browser first, which is both slower and
// the wrong place for the rule to live.
//
// THE FILTERS DO NOT GO IN THE ADDRESS. Same reasoning as the learner
// catalogue: this page has one address and it is behind a sign in, so
// there is nothing for a search engine to find and nothing to share.
// Somebody who wants a particular view gets there in two clicks.

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "draft", label: "Draft" },
  { key: "review", label: "Ready for review" },
  { key: "published", label: "Live" },
  { key: "archived", label: "Archived" },
];

function Inner() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<StudioCourse[] | null>(null);
  const [problem, setProblem] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [making, setMaking] = useState(false);

  useEffect(() => {
    getOverview().then((a) => {
      if (a.ok) setCourses(a.data.courses);
      else setProblem(a.message);
    });
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (courses || []).filter(
      (c) =>
        (filter === "all" || c.state === filter) &&
        (!needle ||
          c.title.toLowerCase().includes(needle) ||
          c.tool.toLowerCase().includes(needle) ||
          c.area.toLowerCase().includes(needle)),
    );
  }, [courses, filter, q]);

  const countOf = (key: string) =>
    key === "all" ? (courses || []).length : (courses || []).filter((c) => c.state === key).length;

  if (problem) return <Problem>{problem}</Problem>;
  if (!courses) return <Waiting what="the courses" />;

  return (
    <>
      <Seo title="Courses | Control room" noindex />

      <Head
        eyebrow="Build"
        title="Courses"
        sub="Everything the Academy teaches, and everything on its way there."
        actions={
          <button type="button" className="acad-btn" onClick={() => setMaking(true)}>
            <PlusIcon />
            New course
          </button>
        }
      />

      <div className="stu__panel">
        <header>
          <div className="stu__chips">
            <label className="stu__find" style={{ maxWidth: 280 }}>
              <SearchIcon />
              <input
                className="stu__cmdin"
                style={{ padding: 0, border: 0, fontSize: 13.5 }}
                value={q}
                placeholder="Title, tool or area"
                aria-label="Find a course"
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className="stu__chip"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <small>{countOf(f.key)}</small>
              </button>
            ))}
          </div>
        </header>

        {shown.length === 0 ? (
          <div className="stu__empty">
            {courses.length === 0
              ? "No courses yet. Start one and it opens in the builder."
              : "Nothing matches that."}
          </div>
        ) : (
          <>
            <div className="stu__scroll">
              <table className="stu__table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Area and tool</th>
                    <th>State</th>
                    <th>Learners</th>
                    <th>Last edited</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link
                          className="stu__who"
                          to={routes.studioBuilder.replace(":id", c.id)}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          <span className="stu__course__code">
                            {c.cover_code || c.title.slice(0, 2).toUpperCase()}
                          </span>
                          <span>
                            <b>{c.title}</b>
                            <small>/{c.slug}</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        {c.area || "No area"}
                        {c.tool ? ` · ${c.tool}` : ""}
                      </td>
                      <td>
                        <StateTag state={c.state} />
                      </td>
                      <td>{c.state === "published" ? c.learners.toLocaleString("en-GB") : "-"}</td>
                      <td>{asWhen(c.updated_at)}</td>
                      <td>
                        <button
                          type="button"
                          className="stu__chip"
                          onClick={() => navigate(routes.studioBuilder.replace(":id", c.id))}
                        >
                          Open
                          <ArrowIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="stu__hint">
              {shown.length} of {courses.length} course{courses.length === 1 ? "" : "s"}. The table
              slides sideways on a narrow screen.
            </p>
          </>
        )}
      </div>

      {making ? (
        <NewCourse
          onClose={() => setMaking(false)}
          onMade={(id) => navigate(routes.studioBuilder.replace(":id", id))}
        />
      ) : null}
    </>
  );
}

export default function StudioCoursesPage() {
  return <RequireStaff>{() => <Inner />}</RequireStaff>;
}
