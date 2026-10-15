import { useCallback, useEffect, useState } from "react";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { DownIcon } from "../Icons";
import { Bar, Head, Problem, Stat, Waiting } from "../ui";
import {
  getActiveDays,
  getFunnel,
  getHardQuestions,
  getLessonDrop,
  getOverview,
  getWhoTotals,
  logExport,
  type ActiveDay,
  type FunnelStage,
  type HardQuestion,
  type LessonDrop,
  type StudioCourse,
} from "../../../../lib/studio";

// How the Academy is doing, counted from its own database.
//
// A FACILITATOR SEES ONLY THEIR OWN COURSES AND NO NAMES. The course
// list this page offers comes from lms_studio_overview, which already
// returns only theirs, and every report function refuses a course that
// is not. "Who our learners are" is not drawn for them at all.
//
// TOTALS ONLY, AND ANY GROUP UNDER 5 READS "fewer than 5". The database
// does that, and the total comes back as a STRING rather than a number,
// which is the point: there is no number here to leak by accident and
// nothing in this page has to remember the rule. When one group in a
// report is small, every group in that report is suppressed, because a
// breakdown where one row says 3 and the rest are exact gives the 3 away
// by subtraction.

const WHO: { field: string; title: string }[] = [
  { field: "state", title: "Where they are" },
  { field: "age_band", title: "Age" },
  { field: "gender", title: "Gender" },
  { field: "education_level", title: "Highest education" },
  { field: "occupation", title: "Right now they are" },
  { field: "disability", title: "Disability" },
];

/** One line, drawn from the numbers. No chart library for one polyline. */
function Line({ days }: { days: ActiveDay[] }) {
  if (days.length < 2) return null;
  const w = 720;
  const h = 180;
  const top = Math.max(...days.map((d) => d.learners), 1);
  const x = (i: number) => (i / (days.length - 1)) * w;
  const y = (v: number) => h - (v / top) * (h - 20);
  const line = days.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(d.learners).toFixed(1)}`).join(" ");

  // THE DATES ARE HTML, NOT <text> IN THE SVG. The chart is stretched to
  // whatever width the panel is, with preserveAspectRatio="none", which
  // is what lets one path fill the box. That same stretch distorts any
  // text inside it, and the two dates came out squashed and unreadable.
  // Outside the svg they are ordinary text at an ordinary size.
  return (
    <>
      <svg
        className="stu__chart"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Active learners per day over ${days.length} days, highest ${top}`}
      >
        <line x1="0" y1={h} x2={w} y2={h} />
        <path className="fill" d={`${line} L${w} ${h} L0 ${h} Z`} />
        <path className="line" d={line} />
      </svg>
      <div className="stu__chartdays">
        <span>{days[0].day}</span>
        <span>highest {top} in a day</span>
        <span>{days[days.length - 1].day}</span>
      </div>
    </>
  );
}

function Who() {
  const [sets, setSets] = useState<Record<string, { value: string; total: string }[]>>({});
  const [problem, setProblem] = useState("");

  useEffect(() => {
    WHO.forEach((w) => {
      getWhoTotals(w.field).then((a) => {
        if (a.ok) setSets((s) => ({ ...s, [w.field]: a.data }));
        else setProblem(a.message);
      });
    });
  }, []);

  return (
    <>
      <Head
        eyebrow="Administrators only"
        title="Who our learners are"
        sub="From the About you answers. Education and work questions only ask what applies, so totals are of the people who were asked. Any group smaller than 5 people shows as fewer than 5, so nobody can be picked out."
        actions={
          <button
            type="button"
            className="stu__chip"
            onClick={() => logExport("who-totals.csv")}
          >
            <DownIcon />
            Record a download
          </button>
        }
      />

      <Problem>{problem}</Problem>

      <div className="stu__grid stu__g2">
        {WHO.map((w) => {
          const rows = sets[w.field] || [];
          const biggest = Math.max(
            ...rows.map((r) => Number(r.total.replace(/[^0-9]/g, "")) || 0),
            1,
          );
          return (
            <section className="stu__panel" key={w.field}>
              <header>
                <h3>{w.title}</h3>
              </header>
              {rows.length === 0 ? (
                <p className="stu__hint">Nothing answered yet.</p>
              ) : (
                <div className="stu__bars">
                  {rows.map((r) => {
                    const n = Number(r.total.replace(/[^0-9]/g, "")) || 0;
                    // A suppressed group has no bar at all, only the
                    // words. Drawing a small bar for "fewer than 5"
                    // would put the number back on the screen.
                    const small = /fewer/i.test(r.total);
                    return (
                      <Bar
                        key={r.value}
                        label={r.value}
                        value={small ? 0 : n}
                        of={biggest}
                        right={r.total}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function Inner({ isAdmin }: { isAdmin: boolean }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [courses, setCourses] = useState<StudioCourse[]>([]);
  const [course, setCourse] = useState("");
  const [active, setActive] = useState<ActiveDay[] | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [drop, setDrop] = useState<LessonDrop[]>([]);
  const [hard, setHard] = useState<HardQuestion[]>([]);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    getOverview().then((a) => {
      if (!a.ok) {
        setProblem(a.message);
        return;
      }
      setCourses(a.data.courses);
      const live = a.data.courses.find((c) => c.state === "published");
      if (live) setCourse(live.id);
    });
  }, []);

  useEffect(() => {
    getActiveDays(days).then((a) => {
      if (a.ok) setActive(a.data);
      else setProblem(a.message);
    });
  }, [days]);

  const loadCourse = useCallback(() => {
    if (!course) return;
    getFunnel(course).then((a) => a.ok && setFunnel(a.data));
    getLessonDrop(course).then((a) => a.ok && setDrop(a.data));
    getHardQuestions(course).then((a) => a.ok && setHard(a.data));
  }, [course]);

  useEffect(loadCourse, [loadCourse]);

  if (problem && !active) return <Problem>{problem}</Problem>;
  if (!active) return <Waiting what="the reports" />;

  const total = active.reduce((n, d) => n + d.learners, 0);
  const best = Math.max(...active.map((d) => d.learners), 0);
  const worst = drop.length ? drop.reduce((a, b) => (b.share < a.share ? b : a)) : null;

  return (
    <>
      <Seo title="Reports | Control room" noindex />

      <Head
        eyebrow="Results"
        title="Reports"
        sub="How the Academy is doing, counted from its own database. No tracking scripts anywhere."
        actions={
          <div className="stu__chips">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                className="stu__chip"
                aria-pressed={days === d}
                onClick={() => setDays(d as 7 | 30 | 90)}
              >
                {d} days
              </button>
            ))}
          </div>
        }
      />

      <div className="stu__grid stu__g4" style={{ marginBottom: 20 }}>
        <Stat label={`Active days counted`} value={active.length} />
        <Stat label="Most active in a day" value={best} />
        <Stat label="Learner days in total" value={total} />
        <Stat label="Courses" value={courses.length} />
      </div>

      <section className="stu__panel" style={{ marginBottom: 20 }}>
        <header>
          <h2>Active learners per day</h2>
          <span className="stu__label">Anyone who watched, read or answered that day</span>
        </header>
        <Line days={active} />
      </section>

      <div className="stu__panel" style={{ marginBottom: 20 }}>
        <header>
          <h2>One course</h2>
          <select
            className="stu__in"
            style={{ width: "auto" }}
            value={course}
            aria-label="Which course"
            onChange={(e) => setCourse(e.target.value)}
          >
            <option value="">Pick a course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </header>

        {!course ? (
          <div className="stu__empty">Pick a course to see how far learners get in it.</div>
        ) : (
          <div className="stu__grid stu__g2">
            <section>
              <h3 className="stu__h2">How far learners get</h3>
              <div className="stu__bars" style={{ marginTop: 12 }}>
                {funnel.map((f) => (
                  <Bar
                    key={f.stage}
                    label={f.stage}
                    value={f.learners}
                    of={funnel[0]?.learners || 1}
                    right={`${f.learners}  ${f.share}%`}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="stu__h2">Where learners stop</h3>
              <div className="stu__bars" style={{ marginTop: 12 }}>
                {drop.map((d) => (
                  <Bar
                    key={d.lesson_id}
                    label={`${d.shown_at}. ${d.title}`}
                    value={d.share}
                    of={100}
                    right={`${d.share}%`}
                  />
                ))}
              </div>
              {worst ? (
                <p className="stu__hint" style={{ marginTop: 10 }}>
                  <b>
                    Lesson {worst.shown_at}, {worst.title}
                  </b>{" "}
                  is the biggest drop. Worth checking its length and its check.
                </p>
              ) : null}
            </section>
          </div>
        )}
      </div>

      <section className="stu__panel" style={{ marginBottom: 20 }}>
        <header>
          <h2>Questions most people get wrong</h2>
          <span className="stu__label">Course exams and lesson checks</span>
        </header>
        {hard.length === 0 ? (
          <p className="stu__hint">
            Nothing yet. A question needs at least five answers before it counts as hard: under
            that it is a new question, not a bad one.
          </p>
        ) : (
          <div className="stu__scroll">
            <table className="stu__table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Where</th>
                  <th>Answered</th>
                  <th>Got it right</th>
                </tr>
              </thead>
              <tbody>
                {hard.map((h) => (
                  <tr key={h.question_id}>
                    <td>{h.prompt}</td>
                    <td>{h.where_it_is}</td>
                    <td>{h.answered}</td>
                    <td>
                      <div className="stu__meter" style={{ width: 90, display: "inline-block" }}>
                        <i style={{ width: `${h.right_share}%` }} />
                      </div>{" "}
                      {h.right_share}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAdmin ? <Who /> : null}
    </>
  );
}

export default function StudioReportsPage() {
  return <RequireStaff>{(role) => <Inner isAdmin={role === "admin"} />}</RequireStaff>;
}
