import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { ArrowIcon, TickIcon } from "../Icons";
import { Done, Problem } from "../ui";
import {
  asClock,
  fromClock,
  removeLesson,
  saveLesson,
  type StudioLesson,
} from "./data";
import { routes } from "../../../routes";

// The lesson editor.
//
// IT SAVES AS YOU TYPE, after three quarters of a second of quiet. A
// builder with a Save button is a builder somebody loses an hour of work
// in, and saving on every keystroke would be a request per letter.
//
// WHAT A LIVE COURSE WILL NOT LET YOU CHANGE is greyed out here AND
// refused by the database. The greying is so somebody does not type into
// a field that will throw their work away; the refusal is the part that
// actually holds. If this component were wrong about which fields are
// locked, the database would still be right.
//
// THE LENGTH IS TYPED, NOT MEASURED HERE, and the player checks it the
// first time anybody plays the lesson. A length typed wrong makes the
// watch tape wrong, which is why the field says what it is for rather
// than just "Length".

const WAIT_MS = 750;

type Props = {
  lesson: StudioLesson | null;
  moduleId: string;
  live: boolean;
  courseId: string;
  onSaved: (id?: string) => void;
};

export default function Lesson({ lesson, moduleId, live, courseId, onSaved }: Props) {
  const [title, setTitle] = useState(lesson?.title || "");
  const [summary, setSummary] = useState(lesson?.summary || "");
  const [video, setVideo] = useState(lesson?.video_ref || "");
  const [length, setLength] = useState(asClock(lesson?.duration_seconds));
  const [chapters, setChapters] = useState(lesson?.chapters_text || "");
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState("");
  const timer = useRef(0);
  const first = useRef(true);

  // Save after the typing stops. The first run is skipped, or opening a
  // lesson would write it straight back unchanged.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setProblem("");
      const seconds = length.trim() ? fromClock(length) : null;
      if (length.trim() && seconds === null) {
        setProblem(`"${length.trim()}" is not a length. Write it as 6:00 or 1:06:00.`);
        return;
      }
      const got = await saveLesson({
        lesson: lesson?.id ?? null,
        module: lesson ? null : moduleId,
        title,
        summary,
        videoRef: video,
        durationSeconds: seconds,
        chaptersText: chapters,
      });
      if (!got.ok) {
        setProblem(got.message);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
      if (!lesson) onSaved(got.data);
    }, WAIT_MS);
    return () => window.clearTimeout(timer.current);
  }, [title, summary, video, length, chapters, lesson, moduleId, onSaved]);

  const checked = (lesson?.check_questions || 0) > 0;

  return (
    <div className="stu__grid">
      <div className="stu__panel__h">
        <span className="stu__label">{lesson ? "Lesson" : "New lesson"}</span>
        {saved ? (
          <span className="stu__label" style={{ color: "var(--acad-ok)" }}>
            Saved
          </span>
        ) : null}
      </div>

      <label className="stu__field">
        <span>Lesson title</span>
        <input className="stu__in" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="stu__field">
        <span>YouTube link</span>
        <input
          className="stu__in"
          value={video}
          disabled={live}
          placeholder="https://youtu.be/..."
          onChange={(e) => setVideo(e.target.value)}
        />
        <small>
          {live
            ? "The video of a live course cannot change. Take the course down first."
            : "Paste the whole link. Only the id is kept, so the video host can change later without a migration."}
        </small>
      </label>

      <label className="stu__field">
        <span>Length</span>
        <input
          className="stu__in"
          value={length}
          disabled={live}
          placeholder="6:00"
          style={{ maxWidth: 140 }}
          onChange={(e) => setLength(e.target.value)}
        />
        <small>
          Checked by the player the first time anybody plays it. A learner must watch all of it,
          and cannot skip ahead or go faster than 1.5x on a first watch.
        </small>
      </label>

      <label className="stu__field">
        <span>Chapters</span>
        <textarea
          className="stu__in"
          rows={5}
          value={chapters}
          placeholder={"00:00 Introduction\n02:00 The idea\n04:00 Doing it step by step"}
          onChange={(e) => setChapters(e.target.value)}
        />
        <small>
          Paste them from the YouTube description. One per line, a time then a name. Learners can
          jump to a chapter once they have reached it, and each check question links to one.
        </small>
      </label>

      {lesson && lesson.chapters.length > 0 ? (
        <div className="stu__chips">
          {lesson.chapters.map((c) => (
            <span className="stu__tag" key={c.start_seconds}>
              {asClock(c.start_seconds)} {c.title}
            </span>
          ))}
        </div>
      ) : null}

      <label className="stu__field">
        <span>What this lesson covers</span>
        <textarea
          className="stu__in"
          rows={2}
          value={summary}
          placeholder="One or two sentences, shown under the title in the course outline."
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>

      {lesson ? (
        <div className="stu__panel" style={{ background: "var(--acad-surface-2)" }}>
          <header>
            <h3>Lesson check</h3>
            {checked ? (
              <span className="stu__tag is-live">
                <TickIcon />
                {lesson.check_questions} question{lesson.check_questions === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="stu__tag is-review">None yet</span>
            )}
          </header>
          <p className="stu__hint" style={{ marginBottom: 12 }}>
            A few questions after the lesson. Unlimited tries, all right to pass, and a miss takes
            the learner back to the chapter the question came from. It goes live when the course
            does.
          </p>
          <Link
            className="acad-btn acad-btn--auto"
            to={`${routes.studioQuestions.replace(":id", courseId)}?lesson=${lesson.id}`}
          >
            {checked ? "Edit the questions" : "Write the questions"}
            <ArrowIcon />
          </Link>
        </div>
      ) : null}

      <Problem>{problem}</Problem>
      {saved ? <Done>Saved.</Done> : null}

      {lesson && !live ? (
        <button
          type="button"
          className="stu__chip"
          style={{ justifySelf: "start", color: "var(--acad-bad)" }}
          onClick={async () => {
            const got = await removeLesson(lesson.id);
            if (got.ok) onSaved();
            else setProblem(got.message);
          }}
        >
          Remove this lesson
        </button>
      ) : null}

      <p className="stu__hint">Changes save as you type.</p>
    </div>
  );
}
