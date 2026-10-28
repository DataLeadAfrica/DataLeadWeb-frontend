import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import "../../academy.css";
import "../learn.css";
import "./page.css";
import Seo from "../../../../components/Seo/component";
import AcadStage from "../../ui/AcadStage";
import Breadcrumb from "../../ui/Breadcrumb";
import EmptyState from "../../ui/EmptyState";
import Chapters from "./Chapters";
import Controls from "./Controls";
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
import { clampVolume } from "./controls.js";
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

// THE CAPTION MODULE HAS TWO NAMES, and which one answers depends on
// the video rather than on anything we control, so both are tried and
// silence is taken to mean this video has no captions. Neither name is
// documented by Google any more, which is reason enough never to let a
// failure here reach somebody's screen as an error.
const CC_MODULES = ["captions", "cc"];

export default function AcademyLesson() {
  const params = useParams();
  const navigate = useNavigate();
  const slug = params.slug || "";
  const lessonId = params.lessonId || "";

  // ?at= AND ?back=, WHICH IS HOW SOMEBODY GETS SENT HERE FROM A MISS.
  //
  // A missed check question and a failed exam both hand back a lesson
  // and a moment in it. The link carries the second to start at and
  // where the person came from, so there is a way back to the thing
  // they were in the middle of. Without the second half, "watch this
  // part again" is a one way door out of the check.
  //
  // THE SEEK IS STILL THE SERVER'S TO ALLOW. This asks the player to
  // start there; lms_record_watch credits nothing that was skipped,
  // whatever the address says.
  const [search] = useSearchParams();
  const askedSecond = Math.max(0, Number(search.get("at")) || 0);
  const cameFrom = search.get("back") || "";

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

  // The controls YouTube's own bar used to provide. Volume is the
  // player's own, not the device's, so muting here leaves whatever else
  // the person is listening to alone.
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  // null means "not known yet". The player cannot say whether a video
  // has a caption track until its caption module has loaded, and a
  // button that disappears and comes back is worse than one that is
  // offered and turns out to do nothing.
  const [captionsAvailable, setCaptionsAvailable] = useState<boolean | null>(null);
  const [captionsOn, setCaptionsOn] = useState(false);

  const mount = useRef<HTMLDivElement | null>(null);
  // The thing that goes full screen: the video AND the bar under it, so
  // that going full screen does not take the controls away.
  const shell = useRef<HTMLDivElement | null>(null);
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
    // 100 is the default from file 16: every video lesson is watched to
    // the end before its check opens. The fallback only matters for a
    // lesson row written before that.
    lesson && lesson !== "closed" ? lesson.coverage_percent || 100 : 100;
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
    // A second asked for in the address wins over where they left off:
    // somebody who pressed "watch this part again" asked for a
    // particular moment and does not want to be put back where they
    // stopped.
    startAt.current = askedSecond || (here.completed ? 0 : here.last_position || 0);
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
            // FILE 25. YouTube'S OWN BAR IS OFF, and with it the share
            // button and the copy link that sat on it. A learning page
            // should not hand somebody the video's address.
            //
            // THIS DOES NOT MAKE THE VIDEO UNDOWNLOADABLE. The video id
            // is in this page's source and in its network traffic
            // whatever the player looks like. Taking the button away
            // stops the link being offered. Anybody who goes looking
            // will still find it, and the only real answer to that is
            // to stop hosting the videos on YouTube.
            controls: 0,
            // No keyboard shortcuts of theirs either: ours are the only
            // ones, so a key cannot do two different things.
            disablekb: 1,
            // No annotations or cards, which are links out by another
            // name.
            iv_load_policy: 3,
            // Their full screen button would be on their bar, which is
            // gone. Ours goes full screen on the shell instead, so the
            // controls come with it.
            fs: 0,
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
  // ------------------------------------------------------- the controls
  //
  // Each one is wrapped, because every call here can arrive before the
  // player is ready or after it has been destroyed by a lesson change,
  // and neither is worth an error on somebody's screen.

  function togglePlay() {
    try {
      if (!player.current) return;
      if (playing) player.current.pauseVideo();
      else player.current.playVideo();
    } catch {
      // the player is not ready yet
    }
  }

  function seekTo(seconds: number) {
    try {
      if (!player.current) return;
      player.current.seekTo(seconds, true);
      setPosition(seconds);
    } catch {
      // the player is not ready yet
    }
  }

  function changeVolume(value: number) {
    const v = clampVolume(value);
    setVolume(v);
    try {
      if (!player.current) return;
      player.current.setVolume(v);
      // Dragging the slider up off zero is how most people unmute, so
      // it is taken as meaning that rather than leaving them wondering
      // why nothing came back.
      if (v > 0 && muted) {
        player.current.unMute();
        setMuted(false);
      }
    } catch {
      // the player is not ready yet
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try {
      if (!player.current) return;
      if (next) player.current.mute();
      else player.current.unMute();
    } catch {
      // the player is not ready yet
    }
  }

  function toggleCaptions() {
    const next = !captionsOn;
    setCaptionsOn(next);
    let worked = false;
    for (const mod of CC_MODULES) {
      try {
        if (next) {
          player.current?.loadModule(mod);
          player.current?.setOption(mod, "track", { languageCode: "en" });
        } else {
          player.current?.setOption(mod, "track", {});
        }
        worked = true;
      } catch {
        // this player does not answer to that module name
      }
    }
    // Asked only once the learner has pressed it, because that is the
    // first moment the answer is both knowable and worth knowing.
    if (!worked) setCaptionsAvailable(false);
  }

  function goFullscreen() {
    try {
      const el = shell.current;
      if (!el) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void el.requestFullscreen();
    } catch {
      // the browser said no, which is its right
    }
  }

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

      {/* A WAY BACK TO THE THING THEY WERE IN THE MIDDLE OF.
          Somebody sent here by a missed check question, or by a failed
          exam, came to watch one part and then go back. Without this
          the breadcrumb only offers the whole course, and they have to
          find their way to the check again themselves. */}
      {cameFrom === "check" || cameFrom === "exam" ? (
        <p className="acad-player__back">
          <Link
            className="acad-link"
            to={
              cameFrom === "exam"
                ? routes.academyExam.replace(":slug", slug)
                : lessonPath(slug, lessonId)
            }
          >
            Back to the {cameFrom === "exam" ? "exam" : "check"}
          </Link>
        </p>
      ) : null}

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
            <div className="acad-player__shell" ref={shell}>
              <div className="acad-player__stage">
                <div className="acad-player__frame" ref={mount} />
                {/* THE SHIELD. With their bar off, YouTube still puts
                    the video's title and a share button over the top on
                    hover, and still offers "Copy video URL" on a right
                    click. This covers both. It is also where a click on
                    the picture is caught, which is what a click on a
                    video is expected to do.

                    A SIBLING, NOT A CHILD of the frame: the frame's
                    children belong to the YouTube API, which replaces
                    them wholesale when a lesson changes.

                    Hidden from screen readers and from the tab order,
                    because the bar underneath has a real play button
                    that says what it does. */}
                <div
                  className="acad-player__shield"
                  aria-hidden="true"
                  onClick={togglePlay}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>

              <Controls
                playing={playing}
                onPlayPause={togglePlay}
                position={position}
                duration={duration}
                onSeek={seekTo}
                volume={volume}
                muted={muted}
                onVolume={changeVolume}
                onMute={toggleMute}
                captionsAvailable={captionsAvailable}
                captionsOn={captionsOn}
                onCaptions={toggleCaptions}
                rate={rate}
                rateOptions={
                  open ? [0.75, 1, 1.25, 1.5, 1.75, 2] : [0.75, 1, 1.25, MAX_RATE_FIRST_WATCH]
                }
                onRate={(want) => {
                  const capped = cappedRate(want, open);
                  setRate(capped);
                  try {
                    if (player.current) player.current.setPlaybackRate(capped);
                  } catch {
                    // the player is not ready yet
                  }
                }}
                onFullscreen={goFullscreen}
              />
            </div>
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
                  ? "You have watched this one through. Skip about as much as you like."
                  : "No skipping ahead until you have watched to the end once"
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

          {/* THE SPEED ROW HAS GONE INTO THE BAR. It was the only
              control of ours, sitting under a YouTube bar that had all
              the others, which is the two sets of controls this package
              was for. The cap on a first watch is unchanged: the bar is
              handed a list of speeds that is already capped. */}
          {problem || !open ? null : (
            <p className="acad-note">Any speed, now you have watched it through.</p>
          )}

          {/* ----------------------------------------------- the chapters */}
          {problem ? null : (
            <Chapters
              chapters={lesson.chapters || []}
              furthestSeconds={lesson.furthest_seconds || 0}
              fullyWatched={Boolean(lesson.fully_watched) || open}
              position={position}
              onJump={(seconds) => {
                try {
                  if (player.current) player.current.seekTo(seconds, true);
                } catch {
                  // the player is not ready, and the next press will work
                }
              }}
            />
          )}

          {/* ------------------------------------------- the lesson check */}
          {showCheck && here && here.has_check ? (
            <LessonCheck
              slug={course.slug}
              lessonId={lessonId}
              lessonTitle={lesson.title}
              next={nextLesson}
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

      {/* AT THE END. The exam belongs in the outline because the
          outline is the shape of the course, and the exam is its last
          step. Leaving it out makes the course look like it finishes
          with whatever the last lesson happens to be. */}
      {course.exam ? (
        <div>
          <p className="acad-outline__mod">At the end</p>
          <ol className="acad-rows">
            <li>
              <Link
                className={`acad-row acad-row--${
                  course.exam.state === "passed"
                    ? "done"
                    : course.exam.state === "open" || course.exam.state === "in_progress"
                      ? "open"
                      : "locked"
                }`}
                to={routes.academyExam.replace(":slug", course.slug)}
              >
                <span className="acad-dot">
                  {course.exam.state === "passed" ? <TickIcon /> : <LockIcon />}
                </span>
                <span className="acad-row__name">Course exam</span>
                <small className="acad-mono">{course.exam.question_count} Qs</small>
              </Link>
            </li>
          </ol>
        </div>
      ) : null}

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
