import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { ArrowIcon, PlusIcon, SendIcon, WarnIcon } from "../Icons";
import { Head, Stat, StateTag, Problem, Waiting } from "../ui";
import NewCourse from "../Courses/NewCourse";
import { getOverview, asWhen, type StudioOverview, type StudioCourse } from "../../../../lib/studio";
import { routes } from "../../../routes";

// The first screen. Two roles, one page, and the difference is what the
// database returned rather than anything decided here.
//
// IT STARTS WITH WHAT NEEDS A PERSON. A queue, most urgent first, each
// row with the one button that deals with it. When nothing is wrong the
// queue is empty and says so in one line, which is the state it should
// be in most days: a dashboard that always has four red things on it
// teaches people to stop looking.
//
// EVERY NUMBER IS COUNTED. The week's figures come from the Academy's
// own tables, in one call, through lms_studio_overview. There is no
// analytics script anywhere in here and nothing is estimated.

const STAGES: { key: string; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "review", label: "Ready for review" },
  { key: "published", label: "Live" },
];

function CourseChip({ c }: { c: StudioCourse }) {
  return (
    <Link className="stu__course" to={routes.studioBuilder.replace(":id", c.id)}>
      <span className="stu__course__code">{c.cover_code || c.title.slice(0, 2).toUpperCase()}</span>
      <span>
        <b>{c.title}</b>
        <small>
          {c.state === "published"
            ? `${c.learners.toLocaleString("en-GB")} learner${c.learners === 1 ? "" : "s"}`
            : `Edited ${asWhen(c.updated_at)}`}
        </small>
      </span>
    </Link>
  );
}

function Inner() {
  const navigate = useNavigate();
  const [data, setData] = useState<StudioOverview | null>(null);
  const [problem, setProblem] = useState("");
  const [making, setMaking] = useState(false);

  function load() {
    getOverview().then((a) => {
      if (a.ok) setData(a.data);
      else setProblem(a.message);
    });
  }

  useEffect(load, []);

  if (problem) return <Problem>{problem}</Problem>;
  if (!data) return <Waiting what="the Academy" />;

  const first = (data.name || "").split(/\s+/)[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <Seo title="Control room | Data-Lead Academy" noindex />

      <Head
        eyebrow={new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        title={`${greeting}, ${first}`}
        sub={
          data.queue.length === 0
            ? "Nothing is waiting on you. Everything else is running."
            : `${data.queue.length} thing${data.queue.length === 1 ? "" : "s"} to look at today. Everything else is running.`
        }
        actions={
          <button type="button" className="acad-btn" onClick={() => setMaking(true)}>
            <PlusIcon />
            New course
          </button>
        }
      />

      <section>
        <div className="stu__panel__h">
          <h2 className="stu__h2">Needs you</h2>
          <span className="stu__label">
            {data.queue.length} item{data.queue.length === 1 ? "" : "s"}
          </span>
        </div>

        {data.queue.length === 0 ? (
          <div className="stu__empty">
            Nothing is waiting. Courses in progress are under Courses.
          </div>
        ) : (
          <div className="stu__queue">
            {data.queue.map((q) => (
              <article
                className={`stu__item${q.kind === "blocked" ? " is-warn" : ""}`}
                key={`${q.kind}-${q.subject}`}
              >
                {q.kind === "review" ? <SendIcon /> : <WarnIcon />}
                <div>
                  <b>{q.heading}</b>
                  <span>{q.detail}</span>
                </div>
                <button
                  type="button"
                  /* acad-btn--auto, not acad-btn. The Academy's plain
                     button is full width by design, which is right on a
                     form and wrong in a row: it took the whole card and
                     squeezed the heading beside it to one word per
                     line. */
                  className={q.kind === "review" ? "acad-btn acad-btn--auto" : "stu__chip"}
                  onClick={() => navigate(routes.studioBuilder.replace(":id", q.subject))}
                >
                  {q.button}
                  <ArrowIcon />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <div className="stu__panel__h">
          <h2 className="stu__h2">This week</h2>
          <span className="stu__label">Counted from the Academy database</span>
        </div>
        <div className="stu__grid stu__g4">
          <Stat label="New learners" value={data.week.new_learners} />
          <Stat label="Active in the last 7 days" value={data.week.active} />
          <Stat label="Minutes watched, 7 days" value={data.week.minutes} />
          <Stat label="Certificates this week" value={data.week.certificates} />
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <div className="stu__panel">
          <header>
            <h2>Courses</h2>
            <Link className="stu__chip" to={routes.studioCourses}>
              All courses
              <ArrowIcon />
            </Link>
          </header>

          <div className="stu__grid stu__g2">
            {STAGES.map((s) => {
              const mine = data.courses.filter((c) => c.state === s.key);
              return (
                <div className="stu__pipe" key={s.key}>
                  <div className="stu__pipe__h">
                    <StateTag state={s.key as StudioCourse["state"]} />
                    <span className="stu__label">{mine.length}</span>
                  </div>
                  {mine.length === 0 ? (
                    <p className="stu__hint">None.</p>
                  ) : (
                    mine.slice(0, 8).map((c) => <CourseChip c={c} key={c.id} />)
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {making ? (
        <NewCourse
          onClose={() => setMaking(false)}
          onMade={(id) => {
            setMaking(false);
            navigate(routes.studioBuilder.replace(":id", id));
          }}
        />
      ) : null}
    </>
  );
}

export default function StudioOverviewPage() {
  return <RequireStaff>{() => <Inner />}</RequireStaff>;
}
