import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import "../../academy.css";
import "../learn.css";
import "./page.css";
import Seo from "../../../../components/Seo/component";
import AcadStage from "../../ui/AcadStage";
import Breadcrumb from "../../ui/Breadcrumb";
import EmptyState from "../../ui/EmptyState";
import WatchTape from "../../ui/WatchTape";
import LessonCheck from "../Check/LessonCheck";
import { ArrowIcon, InfoIcon, LockIcon, TickIcon, WarnIcon } from "../../ui/Icons";
import { routes } from "../../../routes";
import {
  clock,
  completeLesson,
  getMyCourse,
  lessonPath,
  openLesson,
  quizPath,
  type LearnLesson,
  type MyCourse,
  type OpenLesson,
} from "../../../../lib/learn";
import { useWatchQueue } from "./useWatchQueue";
import {
  loadYouTube,
  videoProblem,
  YT_ENDED,
  YT_PLAYING,
  type YTPlayer,
} from "./youtube";
import {
  cappedRate,
  finalSlice,
  MAX_RATE_FIRST_WATCH,
  shownPercent,
  sliceCount,
  slicesCrossed,
} from "./slices";

// /lms/learn/:slug/:lessonId. The lesson player.
//
// THE RULES IT KEEPS, and why each one exists.
//
//   ONE SLICE EVERY TEN SECONDS OF REAL PLAYING. Not every ten seconds
//   of wall clock: a paused video records nothing. The slice index is
//   worked out from the position in the video, so a slice can only ever
//   be credited for a part that was actually on screen.
//
//   FIRST WATCH: NO SKIPPING PAST THE FURTHEST POINT. Not "no skipping
//   at all": going back is always allowed, and going forward over
//   ground already watched is allowed. Only running ahead of yourself
//   is refused, with a line saying so rather than a silent jump back.
//
//   FIRST WATCH: 1.5x AT MOST. This is not a preference, it is
//   arithmetic. lms_record_watch refuses more than nine slices a minute
//   as script-like, and a player at 2x produces twelve. A quarter of
//   the watching would be thrown away and the lesson would never
//   unlock, with nothing on screen to explain why. After the first full
//   watch both limits come off completely.
//
//   A SLICE THAT DOES NOT GET THROUGH IS KEPT. See useWatchQueue.
//
//   A VIDEO THAT WILL NOT PLAY SAYS SO. Never a black rectangle.
//
// NOINDEX, and the WhatsApp bubble is hidden by AcadStage focus.

const TICK_MS = 1000;

export default function AcademyLesson() {
  const params = useParams();
  const navigate = useNavigate();
  const slug = params.slug || "";
  const lessonId = params.lessonId || "";

  const [course, setCourse] = useState<MyCourse | "missing" | null>(null);
  const [lesson, setLesson] = useState<OpenLesson | "closed" | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(1);
  const [problem, setProblem] = useState("");
  const [rewound, setRewound] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishNote, setFinishNote] = useState("");

  const mount = useRef<HTMLDivElement | null>(null);
  const player = useRef<YTPlayer | null>(null);
  const furthest = useRef(0);
  // Where the playhead was at the previous tick, so the one after it
  // can work out everything it went past. null means "not playing", so
  // the next playing tick is treated as a fresh start rather than as a
  // seek across however long the video was paused for.
  const before = useRef<number | null>(null);
  // When that tick happened, by the wall clock. The gap between ticks
  // is NOT reliably the timer's interval: a browser throttles timers
  // hard in a background tab, sometimes to once a minute. Judging a
  // move against the nominal one second would call a minute of
  // legitimate background playing a seek and credit none of it.
  const beforeAt = useRef<number | null>(null);
  // Set by the ENDED event, read by the tick. A ref rather than state
  // because the player's callbacks are built once and would otherwise
  // close over the first render's setters for ever.
  const endedAt = useRef(false);
  // Slices handed to the queue already. The queue keeps them if a send
  // fails, so this is "asked for", not "arrived", and it stops a
  // re-watch spending the server's per minute allowance on slices that
  // are already recorded.
  const asked = useRef<Set<number>>(new Set());

  const bucketSeconds =
    lesson && lesson !== "closed" ? lesson.bucket_seconds || 10 : 10;
  const duration =
    lesson && lesson !== "closed" ? lesson.duration_seconds || 0 : 0;
  const needed =
    lesson && lesson !== "closed" ? lesson.coverage_percent || 90 : 90;
  const totalSlices = sliceCount(duration, bucketSeconds);

  // The outline, and this lesson's own state inside it.
  const here: LearnLesson | null =
    course && course !== "missing"
      ? course.modules
          .flatMap((m) => m.lessons)
          .find((l) => l.id === lessonId) || null
      : null;

  const watch = useWatchQueue(lessonId, here ? here.coverage : 0, bucketSeconds);
  const covered = Math.max(watch.coverage, here ? here.coverage : 0);
  const open = covered >= needed || Boolean(here && here.completed);

  // ------------------------------------------------------------ loading
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setShowCheck(false);
    setProblem("");
    Promise.all([getMyCourse(slug), openLesson(lessonId)]).then(([c, l]) => {
      if (!alive) return;
      setCourse(c);
      // openLesson answers null both when the call failed and when the
      // lesson is not open to this person. The course call tells them
      // apart: if the course came back, the database is answering.
      setLesson(l ? l : c === null ? null : "closed");
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [slug, lessonId]);

  // Where they stopped last time. Set once, from the outline, so a
  // later render cannot drag the player backwards.
  const startAt = useRef<number | null>(null);
  if (startAt.current === null && here) {
    startAt.current = here.completed ? 0 : here.last_position || 0;
    furthest.current = Math.max(
      here.last_position || 0,
      // Already watched ground is already watched: coverage is the
      // honest measure of how far the no-skipping line has moved.
      duration > 0 ? (covered / 100) * duration : 0,
    );
  }

  // ------------------------------------------------------- the player
  useEffect(() => {
    if (!lesson || lesson === "closed") return;
    if (!lesson.video_ref) {
      setProblem("This lesson has no video attached yet. Please tell your tutor.");
      return;
    }
    if (!mount.current) return;

    let alive = true;
    let instance: YTPlayer | null = null;

    // THE PLAYER IS GIVEN A DIV REACT DOES NOT OWN.
    //
    // YouTube's API does not fill the element you hand it: it REPLACES
    // it with an iframe. Hand it a node React rendered and React will
    // later try to remove a node that is no longer there, which throws
    // "The node to be removed is not a child of this node" and takes
    // the whole page down with it. It happens on any re-render that
    // swaps the player out, which includes showing the message for a
    // video that will not play.
    //
    // So React owns the outer frame and never looks inside it, and this
    // creates the inner div for YouTube to consume. Each side only ever
    // removes its own nodes.
    const inner = document.createElement("div");
    mount.current.appendChild(inner);

    loadYouTube()
      .then((YT) => {
        if (!alive || !mount.current) return;
        instance = new YT.Player(inner, {
          videoId: lesson.video_ref,
          // youtube-nocookie, and no related videos from other
          // channels at the end: a learning page should not finish by
          // offering somebody a different video.
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            start: Math.max(0, Math.floor(startAt.current || 0)),
          },
          events: {
            onReady: () => {
              if (!alive) return;
              player.current = instance;
            },
            onStateChange: (e: { data: number }) => {
              if (!alive) return;
              setPlaying(e.data === YT_PLAYING);
              // THE END OF THE VIDEO. The last slice is usually a part
              // of one, so the playhead can stop inside it without the
              // tick ever seeing the boundary. Watching a lesson all
              // the way through has to finish it, so the end credits
              // the final slice itself.
              if (e.data === YT_ENDED) {
                endedAt.current = true;
              }
            },
            onError: (e: { data: number }) => {
              if (!alive) return;
              setProblem(videoProblem(e.data));
            },
          },
        });
      })
      .catch(() => {
        if (alive) {
          setProblem(
            "The video player could not be loaded. Check your connection and try again.",
          );
        }
      });

    return () => {
      alive = false;
      try {
        if (instance) instance.destroy();
      } catch {
        // The iframe is already gone, which is fine.
      }
      // Whatever is left inside the frame is ours, not React's, so it
      // is cleared here rather than being left for React to trip over.
      try {
        if (mount.current) mount.current.replaceChildren();
      } catch {
        // nothing to do
      }
      player.current = null;
    };
    // lesson.video_ref is the only thing that should rebuild the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson && lesson !== "closed" ? lesson.video_ref : null]);

  // ------------------------------------------- the once a second tick
  //
  // One timer does all of it: reads the position, counts real playing
  // time, hands over a slice every bucket_seconds, and pulls somebody
  // back if they have run ahead of themselves. One timer rather than
  // four, because four would drift apart from each other.
  /** Hands one slice to the queue, once. */
  const send = useCallback(
    (slice: number, at: number) => {
      if (slice < 0 || asked.current.has(slice)) return;
      asked.current.add(slice);
      watch.record(slice, Math.round(at));
    },
    [watch],
  );

  const onTick = useCallback(() => {
    const p = player.current;
    if (!p) return;

    let now = 0;
    try {
      now = p.getCurrentTime() || 0;
    } catch {
      return; // the iframe is between states
    }
    setPosition(now);

    let isPlaying = false;
    let playRate = 1;
    try {
      isPlaying = p.getPlayerState() === YT_PLAYING;
      playRate = p.getPlaybackRate() || 1;
    } catch {
      return;
    }
    if (endedAt.current) {
      endedAt.current = false;
      send(finalSlice(totalSlices), duration);
    }

    if (!isPlaying) {
      // Paused, or ended. Forget where we were, so coming back is a
      // fresh start and not a seek across the length of the pause.
      before.current = null;
      beforeAt.current = null;
      return;
    }

    // NO RUNNING AHEAD ON THE FIRST WATCH.
    if (!open && now > furthest.current + bucketSeconds * 1.5) {
      try {
        p.seekTo(Math.max(0, furthest.current), true);
      } catch {
        // nothing to do: the next tick tries again
      }
      before.current = null;
      beforeAt.current = null;
      setRewound(true);
      window.setTimeout(() => setRewound(false), 6000);
      return;
    }
    if (now > furthest.current) furthest.current = now;

    // 1.5x AT MOST until the lesson is open. Checked against the
    // player's own rate, because YouTube's menu can change it without
    // going anywhere near this page.
    if (!open && playRate > MAX_RATE_FIRST_WATCH) {
      try {
        p.setPlaybackRate(MAX_RATE_FIRST_WATCH);
        setRate(MAX_RATE_FIRST_WATCH);
        playRate = MAX_RATE_FIRST_WATCH;
      } catch {
        // nothing to do
      }
    }

    // EVERY SLICE THE PLAYHEAD WENT THROUGH, not one per ten seconds of
    // wall clock. The old way lost every third slice at 1.5x and the
    // lesson could never be finished. See slices.js.
    const atMs = Date.now();
    const sinceLast =
      beforeAt.current === null
        ? TICK_MS / 1000
        : Math.max(0.1, (atMs - beforeAt.current) / 1000);

    const { slices } = slicesCrossed({
      previous: before.current,
      current: now,
      bucketSeconds,
      rate: playRate,
      tickSeconds: sinceLast,
      totalSlices: totalSlices,
    });
    before.current = now;
    beforeAt.current = atMs;
    for (const slice of slices) send(slice, now);
  }, [open, bucketSeconds, totalSlices, duration, send]);

  useEffect(() => {
    const timer = window.setInterval(onTick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [onTick]);

  // Send whatever is waiting when the tab is hidden or the page is
  // left. Somebody who closes the tab mid lesson keeps their minutes.
  useEffect(() => {
    function leaving() {
      void watch.flush();
    }
    document.addEventListener("visibilitychange", leaving);
    window.addEventListener("pagehide", leaving);
    return () => {
      document.removeEventListener("visibilitychange", leaving);
      window.removeEventListener("pagehide", leaving);
    };
  }, [watch]);

  // ------------------------------------------------------- finishing
  const nextLesson = (() => {
    if (!course || course === "missing" || !here) return null;
    const all = course.modules.flatMap((m) => m.lessons);
    const at = all.findIndex((l) => l.id === lessonId);
    return at >= 0 && at + 1 < all.length ? all[at + 1] : null;
  })();

  const moduleQuiz = (() => {
    if (!course || course === "missing") return null;
    const m = course.modules.find((mm) => mm.lessons.some((l) => l.id === lessonId));
    return m && m.quiz && !m.quiz.passed ? m.quiz : null;
  })();

  /** Called once the check is passed, or straight away if there is none. */
  const finish = useCallback(async () => {
    setFinishing(true);
    setFinishNote("");
    const got = await completeLesson(lessonId);
    setFinishing(false);
    if (!got) {
      setFinishNote("We could not save that just now. Please try again.");
      return;
    }
    if (!got.completed) {
      setFinishNote(got.reason);
      return;
    }
    // The course may be finished now. The server decides, and it is
    // safe to ask every time: see claimCertificate.
    const fresh = await getMyCourse(slug);
    if (fresh && fresh !== "missing") {
      const done =
        fresh.lessons_done >= fresh.lesson_count &&
        fresh.quizzes_passed >= fresh.quiz_count &&
        fresh.lesson_count > 0;
      if (done) {
        navigate(`/lms/learn/${encodeURIComponent(slug)}/complete`);
        return;
      }
    }
    if (nextLesson && nextLesson.unlocked !== false) {
      navigate(lessonPath(slug, nextLesson.id));
    } else if (moduleQuiz) {
      navigate(quizPath(slug, moduleQuiz.id));
    } else {
      navigate(routes.academyLearn.replace(":slug", encodeURIComponent(slug)));
    }
  }, [lessonId, slug, nextLesson, moduleQuiz, navigate]);

  // ------------------------------------------------------------ states
  if (!loaded) {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Lesson | Data-Lead Academy" noindex />
        <div className="acad-player__waiting" aria-hidden="true" />
      </AcadStage>
    );
  }

  if (course === null || lesson === null) {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Lesson | Data-Lead Academy" noindex />
        <EmptyState label="Lesson" title="We could not load this just now">
          Something went wrong on our side, not yours. Everything you have
          watched is saved. Please try again in a moment.
        </EmptyState>
        <p className="acad-actions">
          <button
            type="button"
            className="acad-btn acad-btn--auto"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </p>
      </AcadStage>
    );
  }

  if (course === "missing" || lesson === "closed") {
    return (
      <AcadStage width="wide" focus>
        <Seo title="Lesson | Data-Lead Academy" noindex />
        <EmptyState label="Lesson" title="This lesson is not open to you yet">
          Either the lesson before it is not finished, or your access to this
          course has ended. Nothing you have done has been lost.
        </EmptyState>
        <p className="acad-actions">
          <Link
            className="acad-btn acad-btn--auto"
            to={routes.academyLearn.replace(":slug", encodeURIComponent(slug))}
          >
            Back to the course
            <ArrowIcon />
          </Link>
        </p>
      </AcadStage>
    );
  }

  const watchedSeconds = duration > 0 ? (covered / 100) * duration : 0;

  return (
    <AcadStage width="wide" focus>
      <Seo title={`${lesson.title} | Data-Lead Academy`} noindex />

      <Breadcrumb
        items={[
          { label: course.title, to: routes.academyLearn.replace(":slug", slug) },
          { label: lesson.title },
        ]}
      />

      <div className="acad-learn">
        <div className="acad-player">
          {/* ------------------------------------------------ the video */}
          {problem ? (
            <div className="acad-player__broken">
              <WarnIcon />
              <div>
                <b>{problem}</b>
                <p>
                  This is not something you have done. Please tell your tutor,
                  and mention the lesson name so they can find it:{" "}
                  <b>{lesson.title}</b>.
                </p>
              </div>
            </div>
          ) : (
            <div className="acad-player__frame" ref={mount} />
          )}

          {/* ------------------------------------------------- the tape */}
          <div className="acad-player__tape">
            <WatchTape
              durationSeconds={duration}
              watchedSeconds={watchedSeconds}
              unlockPercent={needed}
              title={lesson.title}
              note={
                open
                  ? "You have watched this one. Skip about as much as you like."
                  : "Skipping ahead opens once you have watched a part"
              }
            />
          </div>

          {/* --------------------------------------- what the page is saying */}
          {rewound ? (
            <p className="acad-note acad-note--warn">
              <InfoIcon />
              <span>
                That part is still ahead of you. The lesson opens up for
                skipping once you have watched it through once.
              </span>
            </p>
          ) : null}

          {watch.offline ? (
            <p className="acad-note acad-note--warn">
              <WarnIcon />
              <span>
                Offline, your progress will save when you reconnect.{" "}
                {watch.waiting > 0
                  ? `${watch.waiting} ${
                      watch.waiting === 1 ? "part is" : "parts are"
                    } waiting.`
                  : ""}{" "}
                Keep watching, nothing is being lost.
              </span>
            </p>
          ) : watch.catchingUp && watch.waiting > 0 ? (
            <p className="acad-note">
              <InfoIcon />
              <span>
                Catching up on {watch.waiting}{" "}
                {watch.waiting === 1 ? "part" : "parts"} you watched while the
                connection was down. Keep watching, this sorts itself out.
              </span>
            </p>
          ) : watch.stuck && playing ? (
            <p className="acad-note acad-note--warn">
              <WarnIcon />
              <span>
                Your progress has stopped moving even though the video is
                playing. If you have sped it up, try 1x: above 1.5x the recording
                cannot keep up and the lesson will not open.
              </span>
            </p>
          ) : null}

          {finishNote ? (
            <p className="acad-note acad-note--bad">
              <WarnIcon />
              <span>{finishNote}</span>
            </p>
          ) : null}

          {/* -------------------------------------------------- the gate */}
          <div className="acad-gate">
            {/* The sentence is wrapped in one span on purpose. This
                paragraph is a flex row so the tick sits beside the
                words, and a flex container puts its gap between EVERY
                child, including bare text nodes. Without the span,
                "You are at 52%." rendered as "You are at 52% ." with
                the full stop pushed off on its own. */}
            <p className="acad-gate__say">
              {here && here.completed ? <TickIcon /> : null}
              <span>
                {here && here.completed ? (
                  "You have finished this lesson."
                ) : open ? (
                  "The whole lesson is watched. Now the questions."
                ) : (
                  <>
                    The lesson check opens at {needed}%. You are at{" "}
                    <b>{shownPercent(covered)}%</b>.
                  </>
                )}
              </span>
            </p>

            {here && here.completed ? (
              nextLesson ? (
                <Link
                  className="acad-btn acad-btn--auto"
                  to={lessonPath(slug, nextLesson.id)}
                >
                  Next lesson
                  <ArrowIcon />
                </Link>
              ) : null
            ) : here && here.has_check ? (
              <button
                type="button"
                className="acad-btn acad-btn--auto"
                disabled={!open}
                onClick={() => setShowCheck(true)}
              >
                {open ? "Take the lesson check" : "Lesson check"}
                {open ? <ArrowIcon /> : <LockIcon />}
              </button>
            ) : (
              <button
                type="button"
                className="acad-btn acad-btn--auto"
                disabled={!open || finishing}
                onClick={() => void finish()}
              >
                {finishing ? "Saving..." : "Mark this lesson done"}
                {open && !finishing ? <ArrowIcon /> : null}
              </button>
            )}
          </div>

          {/* ------------------------------------------------- the speed */}
          {problem ? null : (
            <div className="acad-speed">
              <label htmlFor="acad-speed-pick">Speed</label>
              <select
                id="acad-speed-pick"
                value={String(rate)}
                onChange={(e) => {
                  const want = Number(e.target.value) || 1;
                  const capped = cappedRate(want, open);
                  setRate(capped);
                  try {
                    if (player.current) player.current.setPlaybackRate(capped);
                  } catch {
                    // the player is not ready yet
                  }
                }}
              >
                {(open
                  ? [0.75, 1, 1.25, 1.5, 1.75, 2]
                  : [0.75, 1, 1.25, MAX_RATE_FIRST_WATCH]
                ).map(
                  (r) => (
                    <option key={r} value={String(r)}>
                      {r}x
                    </option>
                  ),
                )}
              </select>
              <span>
                {open
                  ? "Any speed, now you have watched it through."
                  : "Up to 1.5x counts on your first watch. Faster than that and the recording cannot keep up."}
              </span>
              <span className="acad-speed__time acad-mono">
                {clock(position)} / {clock(duration)}
              </span>
            </div>
          )}

          {/* ------------------------------------------- the lesson check */}
          {showCheck && here && here.has_check ? (
            <LessonCheck
              lessonId={lessonId}
              lessonTitle={lesson.title}
              onPassed={() => void finish()}
              onWatchAgain={() => {
                setShowCheck(false);
                try {
                  if (player.current) player.current.seekTo(0, true);
                } catch {
                  // the player is gone, which is fine: the page stands
                }
              }}
            />
          ) : null}
        </div>

        {/* ------------------------------------------------- the outline */}
        <aside className="acad-learn__side">
          <Outline course={course} lessonId={lessonId} />
        </aside>
      </div>
    </AcadStage>
  );
}

/**
 * The outline beside the player. The same data the course page draws,
 * from the same call, so the two can never disagree about what is open.
 */
function Outline({ course, lessonId }: { course: MyCourse; lessonId: string }) {
  return (
    <nav className="acad-outline" aria-label="Course outline">
      <h2 className="acad-h3">{course.title}</h2>
      <p className="acad-outline__count acad-mono">
        {course.lessons_done} of {course.lesson_count} lessons complete
      </p>

      {course.modules.map((m) => (
        <div key={m.position}>
          <p className="acad-outline__mod">
            Module {m.position} &middot; {m.title}
          </p>
          <ol className="acad-rows">
            {m.lessons.map((l) => {
              const state = l.completed
                ? "done"
                : l.id === lessonId
                  ? "now"
                  : l.unlocked
                    ? "open"
                    : "locked";
              const inside = (
                <>
                  <span className="acad-dot">
                    {state === "done" ? <TickIcon /> : null}
                    {state === "locked" ? <LockIcon /> : null}
                  </span>
                  <span className="acad-row__name">{l.title}</span>
                  <small>{clock(l.seconds)}</small>
                </>
              );
              if (state === "locked") {
                return (
                  <li key={l.id} className="acad-row acad-row--locked">
                    {inside}
                  </li>
                );
              }
              return (
                <li key={l.id}>
                  <Link
                    className={`acad-row acad-row--${state === "now" ? "now" : state === "done" ? "done" : "open"}`}
                    to={lessonPath(course.slug, l.id)}
                    aria-current={state === "now" ? "page" : undefined}
                  >
                    {inside}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      ))}

      <p className="acad-outline__back">
        <Link
          className="acad-link"
          to={routes.academyLearn.replace(":slug", course.slug)}
        >
          Back to the whole course
        </Link>
      </p>
    </nav>
  );
}
