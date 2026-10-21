import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import Paste from "./Paste";
import { ArrowIcon, PlusIcon, TickIcon } from "../Icons";
import { Done, Head, Problem, Waiting } from "../ui";
import {
  asClock,
  getQuestions,
  getStudioCourse,
  type StudioCourseFull,
  type StudioQuestion,
} from "../Builder/data";
import { retireQuestion, saveQuestion } from "../../../../lib/studio";
import { routes } from "../../../routes";

// Checks and exams: every question in one set, and the way to write one.
//
// IT IS A "COURSE EXAM", NEVER A QUIZ. The word quiz belonged to the
// module quizzes file 16 made history, and using it here would mean two
// names for the one thing somebody has to pass to be certified.
//
// WHAT A LOCKED QUESTION LOOKS LIKE. Once anybody has been served a
// question, its options and its answer are frozen and the row says so.
// The wording is still editable, because improving a badly worded
// question is a Tuesday job. The database refuses the rest, so this is
// a label on a rule rather than the rule.
//
// THIS PAGE CARRIES THE ANSWER KEY. is_correct leaves the server here
// and nowhere else in the whole system. That is why lms_studio_questions
// checks the role before returning a row, and why nothing on this page
// is reachable without it.

function Editor({
  quiz,
  question,
  lessons,
  onDone,
}: {
  quiz: string;
  question: StudioQuestion | null;
  lessons: { id: string; title: string; chapters: { start_seconds: number; title: string }[] }[];
  onDone: () => void;
}) {
  const [prompt, setPrompt] = useState(question?.prompt || "");
  const [why, setWhy] = useState(question?.explanation || "");
  const [options, setOptions] = useState(
    question?.options.map((o) => ({ label: o.label, is_correct: o.is_correct })) || [
      { label: "", is_correct: true },
      { label: "", is_correct: false },
    ],
  );
  const [lesson, setLesson] = useState(question?.lesson_id || "");
  const [start, setStart] = useState(question?.chapter_start ?? null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const locked = question?.locked || false;
  const chapters = lessons.find((l) => l.id === lesson)?.chapters || [];

  async function save() {
    setProblem("");
    setBusy(true);
    const got = await saveQuestion({
      quiz,
      question: question?.id ?? null,
      prompt,
      explanation: why,
      // A locked question sends no options at all, so the trigger never
      // fires and the wording still saves.
      options: locked ? undefined : options.filter((o) => o.label.trim()),
      lesson: lesson || null,
      chapterStart: start,
    });
    setBusy(false);
    if (!got.ok) setProblem(got.message);
    else onDone();
  }

  return (
    <div className="stu__grid">
      {locked ? (
        <p className="stu__msg is-warn">
          <TickIcon />
          <span>
            Somebody has already sat this question, so its options and its answer cannot change.
            The wording can still be improved. To change the answer, retire it and write a new one.
          </span>
        </p>
      ) : null}

      <label className="stu__field">
        <span>The question</span>
        <textarea
          className="stu__in"
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>

      <div className="stu__field">
        <span>The options</span>
        {options.map((o, i) => (
          <div className="stu__who" key={i} style={{ gap: 8, marginBottom: 6 }}>
            <input
              type="radio"
              name="right"
              checked={o.is_correct}
              disabled={locked}
              aria-label={`Option ${i + 1} is the right answer`}
              onChange={() =>
                setOptions(options.map((x, n) => ({ ...x, is_correct: n === i })))
              }
            />
            <input
              className="stu__in"
              value={o.label}
              disabled={locked}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              onChange={(e) => {
                const next = [...options];
                next[i] = { ...next[i], label: e.target.value };
                setOptions(next);
              }}
            />
          </div>
        ))}
        {!locked && options.length < 5 ? (
          <button
            type="button"
            className="stu__chip"
            style={{ justifySelf: "start" }}
            onClick={() => setOptions([...options, { label: "", is_correct: false }])}
          >
            <PlusIcon />
            Another option
          </button>
        ) : null}
        <small>Mark the right one. A question needs exactly one right answer.</small>
      </div>

      <label className="stu__field">
        <span>Why that is the answer</span>
        <textarea
          className="stu__in"
          rows={2}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
        />
        <small>
          Shown to a learner who got it right. Somebody who got it wrong gets the chapter to watch
          again instead, never the answer.
        </small>
      </label>

      <div className="stu__grid stu__g2">
        <label className="stu__field">
          <span>Which lesson is it from?</span>
          <select className="stu__in" value={lesson} onChange={(e) => setLesson(e.target.value)}>
            <option value="">Not linked</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
        <label className="stu__field">
          <span>Which chapter?</span>
          <select
            className="stu__in"
            value={start ?? ""}
            disabled={!lesson}
            onChange={(e) => setStart(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">Not linked</option>
            {chapters.map((c) => (
              <option key={c.start_seconds} value={c.start_seconds}>
                {asClock(c.start_seconds)} {c.title}
              </option>
            ))}
          </select>
          <small>A miss takes the learner back to exactly this moment.</small>
        </label>
      </div>

      <Problem>{problem}</Problem>

      <button type="button" className="acad-btn" disabled={busy} onClick={save}>
        {busy ? "Saving" : question ? "Save the question" : "Add the question"}
      </button>
    </div>
  );
}

function Inner() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const lessonId = params.get("lesson");

  const [course, setCourse] = useState<StudioCourseFull | null>(null);
  const [questions, setQuestions] = useState<StudioQuestion[] | null>(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const [editing, setEditing] = useState<StudioQuestion | null | "new">(null);
  const [pasting, setPasting] = useState(false);

  const load = useCallback(async () => {
    const c = await getStudioCourse(id);
    if (!c.ok) {
      setProblem(c.message);
      return;
    }
    setCourse(c.data);
    const lesson = c.data.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
    const quiz = lessonId ? lesson?.check_id : c.data.exam?.id;
    if (!quiz) {
      setQuestions([]);
      return;
    }
    const q = await getQuestions(quiz);
    if (q.ok) setQuestions(q.data);
    else setProblem(q.message);
  }, [id, lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  if (problem && !course) return <Problem>{problem}</Problem>;
  if (!course || !questions) return <Waiting what="the questions" />;

  const lessons = course.modules.flatMap((m) => m.lessons);
  const lesson = lessons.find((l) => l.id === lessonId);
  const quiz = lessonId ? lesson?.check_id : course.exam?.id;
  const live = questions.filter((q) => q.active);

  // NO QUIZ MEANS NO EDITOR, AND NO PASTE DRAWER EITHER.
  //
  // This page used to render the editor with `quiz={quiz || ""}`, and an
  // empty string is not a uuid. Writing a question answered "invalid
  // input syntax for type uuid" with nothing on screen to explain it.
  //
  // The real fault was behind it: nothing in the control room created a
  // lesson check, so `quiz` was null for every lesson the builder made.
  // File 20 fixes that at the source, and this is the guard that means
  // a null can never again be laundered into an empty string and posted
  // to the database. If there is no check, the page says so in words.
  const ready = Boolean(quiz);

  return (
    <>
      <Seo title={`Questions | ${course.title}`} noindex />

      <p className="stu__hint" style={{ marginBottom: 10 }}>
        <Link to={routes.studioCourses} style={{ color: "inherit" }}>
          Courses
        </Link>{" "}
        /{" "}
        <Link to={routes.studioBuilder.replace(":id", id)} style={{ color: "inherit" }}>
          {course.title}
        </Link>{" "}
        / {lesson ? `${lesson.title} check` : "Course exam"}
      </p>

      <Head
        eyebrow={lesson ? "Lesson check" : "Course exam"}
        title={lesson ? lesson.title : `${course.title} exam`}
        sub={
          lesson
            ? "A few questions after the lesson. Unlimited tries, all right to pass, and a miss takes the learner back to the chapter it came from."
            : `${course.exam?.serve_count ?? 20} questions a try, ${course.exam?.minutes ?? 40} minutes, ${course.exam?.pass_percent ?? 70} per cent to pass, ${course.exam?.tries ?? 2} tries then a day.`
        }
        actions={
          ready ? (
            <>
              <button type="button" className="stu__chip" onClick={() => setPasting(true)}>
                Paste from a sheet
              </button>
              <button type="button" className="acad-btn" onClick={() => setEditing("new")}>
                <PlusIcon />
                Write one
              </button>
            </>
          ) : null
        }
      />

      {/* Said plainly rather than with the buttons greyed out, because a
          disabled button with no reason beside it is the same dead end
          with better manners. */}
      {!ready ? (
        <div className="stu__step is-todo" style={{ marginBottom: 18 }}>
          <div>
            <b>This lesson has no check yet</b>
            <small>
              {lessonId
                ? "A check is made with the lesson, so this is a lesson from before that was true. Open the lesson in the builder and save it once, and its check will be there when you come back."
                : "This course has no exam yet. Open the course in the builder and the exam is made with it."}
            </small>
          </div>
        </div>
      ) : null}

      {!lesson && course.exam ? (
        <div className="stu__step is-todo" style={{ marginBottom: 18 }}>
          <TickIcon />
          <div>
            <b>
              {course.exam.bank} in the bank ({course.exam.needed} needed)
            </b>
            <small>
              A bank bigger than one try means two tries are not the same paper twice.
            </small>
            <div className={`stu__meter${course.exam.bank >= course.exam.needed ? " is-done" : ""}`}>
              <i
                style={{
                  width: `${Math.min(100, Math.round((course.exam.bank / course.exam.needed) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <Problem>{problem}</Problem>
      <Done>{done}</Done>

      {editing && ready ? (
        <div className="stu__panel" style={{ marginBottom: 18 }}>
          <header>
            <h2>{editing === "new" ? "A new question" : "This question"}</h2>
            <button type="button" className="stu__chip" onClick={() => setEditing(null)}>
              Close
            </button>
          </header>
          <Editor
            quiz={quiz as string}
            question={editing === "new" ? null : editing}
            lessons={lessons.map((l) => ({ id: l.id, title: l.title, chapters: l.chapters }))}
            onDone={() => {
              setEditing(null);
              setDone("Saved.");
              load();
            }}
          />
        </div>
      ) : null}

      <div className="stu__panel">
        <header>
          <h2>{live.length} question{live.length === 1 ? "" : "s"}</h2>
          <span className="stu__label">
            {questions.length - live.length} retired
          </span>
        </header>

        {live.length === 0 ? (
          <div className="stu__empty">
            Nothing here yet. Write one, or paste a sheet.
          </div>
        ) : (
          <div className="stu__scroll">
            <table className="stu__table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Right answer</th>
                  <th>From</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {live.map((q) => (
                  <tr key={q.id}>
                    <td>
                      {q.prompt}
                      {q.locked ? (
                        <span className="stu__tag" style={{ marginLeft: 8 }}>
                          Sat
                        </span>
                      ) : null}
                    </td>
                    <td>{q.options.find((o) => o.is_correct)?.label || "none"}</td>
                    <td>
                      {q.lesson_id
                        ? `${lessons.find((l) => l.id === q.lesson_id)?.title || "a lesson"}${
                            q.chapter_start !== null ? ` · ${asClock(q.chapter_start)}` : ""
                          }`
                        : "-"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="stu__chip"
                        onClick={() => setEditing(q)}
                      >
                        Edit
                        <ArrowIcon />
                      </button>{" "}
                      <button
                        type="button"
                        className="stu__link"
                        onClick={async () => {
                          const got = await retireQuestion(q.id);
                          if (got.ok) {
                            setDone("Retired. Old attempts still make sense.");
                            load();
                          } else setProblem(got.message);
                        }}
                      >
                        Retire
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pasting && quiz ? (
        <Paste
          quiz={quiz}
          onClose={() => setPasting(false)}
          onDone={() => {
            setPasting(false);
            load();
          }}
        />
      ) : null}
    </>
  );
}

export default function StudioQuestionsPage() {
  return <RequireStaff>{() => <Inner />}</RequireStaff>;
}
