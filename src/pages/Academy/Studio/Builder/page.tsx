import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import Lesson from "./Lesson";
import Details from "./Details";
import Publish from "./Publish";
import { ArrowIcon, OutIcon, PlusIcon, SendIcon, TickIcon } from "../Icons";
import { Head, Problem, StateTag, Waiting } from "../ui";
import {
  addModule,
  getStudioCourse,
  type PublishCheck,
  type StudioCourseFull,
  type StudioLesson,
} from "./data";
import { routes } from "../../../routes";

// The course builder.
//
// THREE STEPS ACROSS THE TOP, then an outline, an editor and the publish
// panel. The three steps are the whole job in the order it is done:
// paste each video, write a lesson check, write the course exam. They
// are meters with numbers rather than ticks, because "32 in the bank (30
// needed)" tells somebody what to do next and a tick does not.
//
// EVERYTHING SAVES AS YOU TYPE, after a pause. A builder with a Save
// button is a builder somebody loses an hour of work in, and the pause
// is there so a save does not fire on every keystroke.
//
// THE PUBLISH PANEL DRAWS WHAT THE DATABASE RETURNED. The nine checks
// come from lms_publish_checks, which is also what lms_publish_course
// consults before it agrees. There is one list, so the panel cannot show
// nine green ticks next to a refusal.

const TABS = [
  { key: "lessons", label: "Lessons and exam" },
  { key: "details", label: "Details" },
  { key: "history", label: "History" },
];

function Steps({ course }: { course: StudioCourseFull }) {
  const lessons = course.modules.flatMap((m) => m.lessons);
  const videos = lessons.filter((l) => l.type === "video");
  const withVideo = videos.filter((l) => l.video_ref && l.duration_seconds);
  const withCheck = videos.filter((l) => (l.check_questions || 0) > 0);
  const bank = course.exam?.bank ?? 0;
  const needed = course.exam?.needed ?? 30;

  const steps = [
    {
      title: "Paste each video",
      done: videos.length > 0 && withVideo.length === videos.length,
      note: `${withVideo.length} of ${videos.length} video lesson${videos.length === 1 ? "" : "s"} have their link and length`,
      share: videos.length ? withVideo.length / videos.length : 0,
    },
    {
      title: "Write a lesson check",
      done: videos.length > 0 && withCheck.length === videos.length,
      note: `${withCheck.length} of ${videos.length} video lesson${videos.length === 1 ? "" : "s"} have a check`,
      share: videos.length ? withCheck.length / videos.length : 0,
    },
    {
      title: "Write the course exam",
      done: bank >= needed,
      // The brief's wording, exactly: "36 in the bank (30 needed)".
      note: `${bank} in the bank (${needed} needed)`,
      share: needed ? Math.min(1, bank / needed) : 0,
    },
  ];

  return (
    <div className="stu__steps">
      {steps.map((s) => (
        <div className={`stu__step ${s.done ? "is-done" : "is-todo"}`} key={s.title}>
          <TickIcon />
          <div>
            <b>{s.title}</b>
            <small>{s.note}</small>
            <div className={`stu__meter${s.done ? " is-done" : ""}`}>
              <i style={{ width: `${Math.round(s.share * 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Inner({ isAdmin }: { isAdmin: boolean }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [course, setCourse] = useState<StudioCourseFull | null>(null);
  const [problem, setProblem] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const tab = params.get("tab") || "lessons";

  const load = useCallback(() => {
    getStudioCourse(id).then((a) => {
      if (!a.ok) {
        setProblem(a.message);
        return;
      }
      setCourse(a.data);
      setProblem("");
      // Open the first lesson, so the editor is never an empty box the
      // first time somebody arrives.
      setPicked((was) => was || a.data.modules.flatMap((m) => m.lessons)[0]?.id || null);
    });
  }, [id]);

  useEffect(load, [load]);

  if (problem) return <Problem>{problem}</Problem>;
  if (!course) return <Waiting what="the course" />;

  const lessons: StudioLesson[] = course.modules.flatMap((m) => m.lessons);
  const open = lessons.find((l) => l.id === picked) || null;

  /** The Fix it buttons on the publish panel land somewhere specific. */
  function fix(c: PublishCheck) {
    if (c.fix_tab === "details") setParams({ tab: "details" });
    else if (c.fix_tab === "exam") navigate(routes.studioQuestions.replace(":id", id));
    else {
      setParams({ tab: "lessons" });
      if (c.fix_id) setPicked(c.fix_id);
    }
  }

  return (
    <>
      <Seo title={`${course.title} | Control room`} noindex />

      <p className="stu__hint" style={{ marginBottom: 10 }}>
        <Link to={routes.studioCourses} style={{ color: "inherit" }}>
          Courses
        </Link>{" "}
        / {course.title}
      </p>

      <Head
        /* The "built by" part is left out entirely when there is no
           name, rather than falling back to "somebody". created_by is
           null on every course that existed before file 17, so the
           fallback would have read "BUILT BY SOMEBODY" on all of them,
           which says less than nothing and looks like a fault. */
        eyebrow={[
          course.area,
          course.tool,
          course.level,
          course.built_by ? `built by ${course.built_by}` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
        title={course.title}
        actions={
          <>
            <StateTag state={course.state} />
            <a
              className="stu__chip"
              href={routes.academyCourse.replace(":slug", course.slug)}
              target="_blank"
              rel="noreferrer"
            >
              Preview as a learner
              <OutIcon />
            </a>
          </>
        }
      />

      {course.state === "review" && course.sent_for_review_at ? (
        <p className="stu__msg is-warn">
          <SendIcon />
          <span>
            <b>Sent for review by {course.sent_by || "a facilitator"}.</b>{" "}
            {course.review_note || "No note."} Look it over, preview it as a learner, then publish
            it or send it back with a note.
          </span>
        </p>
      ) : null}

      <div className="stu__chips" style={{ margin: "18px 0" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className="stu__chip"
            aria-pressed={tab === t.key}
            onClick={() => setParams({ tab: t.key })}
          >
            {t.label}
            {t.key === "lessons" ? <small>{lessons.length}</small> : null}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <Details course={course} isAdmin={isAdmin} onSaved={load} />
      ) : tab === "history" ? (
        <div className="stu__panel">
          <header>
            <h2>History</h2>
            <Link className="stu__chip" to={routes.studioHealth}>
              Full log
              <ArrowIcon />
            </Link>
          </header>
          <p className="stu__hint">
            Everything that has happened to this course is in the activity log, which nobody can
            edit. Open it from Health and activity.
          </p>
        </div>
      ) : (
        <>
          <Steps course={course} />

          <div className="stu__build">
            <aside className="stu__outline" aria-label="Course outline">
              <div className="stu__panel__h">
                <span className="stu__label">Outline</span>
                <span className="stu__label">{lessons.length} lessons</span>
              </div>

              {course.modules.map((m) => (
                <div key={m.id}>
                  <p className="stu__mod">
                    {String(m.position).padStart(2, "0")} {m.title}
                  </p>
                  {m.lessons.map((l) => {
                    const ready = Boolean(l.video_ref && l.duration_seconds);
                    const checked = (l.check_questions || 0) > 0;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        className="stu__lesson"
                        aria-current={l.id === picked}
                        onClick={() => setPicked(l.id)}
                      >
                        <span>{l.title}</span>
                        <span>
                          <small>
                            {l.duration_seconds
                              ? `${Math.floor(l.duration_seconds / 60)}:${String(l.duration_seconds % 60).padStart(2, "0")}`
                              : "--:--"}
                          </small>{" "}
                          <i
                            className={`stu__dot${ready && checked ? " is-ok" : ready ? " is-no" : ""}`}
                            title={
                              !ready
                                ? "Needs a video and a length"
                                : !checked
                                  ? "Needs a lesson check"
                                  : "Ready"
                            }
                          />
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="stu__chip"
                    style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
                    onClick={() => {
                      setPicked(null);
                      setParams({ tab: "lessons", add: m.id });
                    }}
                  >
                    <PlusIcon />
                    Add a lesson
                  </button>
                </div>
              ))}

              {course.state !== "published" ? (
                <button
                  type="button"
                  className="stu__chip"
                  style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
                  onClick={async () => {
                    const got = await addModule(id);
                    if (got.ok) load();
                    else setProblem(got.message);
                  }}
                >
                  <PlusIcon />
                  Add a module
                </button>
              ) : null}

              <Link
                className="stu__course"
                to={routes.studioQuestions.replace(":id", id)}
                style={{ marginTop: 12 }}
              >
                <span className="stu__course__code">EX</span>
                <span>
                  <b>Course exam</b>
                  <small>
                    {course.exam?.bank ?? 0} in the bank ({course.exam?.needed ?? 30} needed)
                  </small>
                </span>
              </Link>
            </aside>

            <section className="stu__panel">
              {open || params.get("add") ? (
                <Lesson
                  key={open?.id || params.get("add") || "new"}
                  lesson={open}
                  moduleId={params.get("add") || open?.module_id || course.modules[0]?.id || ""}
                  live={course.state === "published"}
                  courseId={id}
                  onSaved={(newId) => {
                    if (newId) setPicked(newId);
                    setParams({ tab: "lessons" });
                    load();
                  }}
                />
              ) : (
                <div className="stu__empty">Pick a lesson on the left, or add one.</div>
              )}
            </section>

            <Publish course={course} isAdmin={isAdmin} onFix={fix} onChanged={load} />
          </div>
        </>
      )}
    </>
  );
}

export default function StudioBuilderPage() {
  return <RequireStaff>{(role) => <Inner isAdmin={role === "admin"} />}</RequireStaff>;
}
