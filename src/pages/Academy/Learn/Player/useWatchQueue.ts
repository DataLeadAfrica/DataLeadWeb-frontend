import { useCallback, useEffect, useRef, useState } from "react";

import { recordWatch } from "../../../../lib/learn";
import { sendsAllowedPerMinute } from "./slices";

// The queue that makes watching survive a bad connection.
//
// THE PROBLEM THIS SOLVES. A lesson only unlocks once enough ten second
// slices have reached the server. On a Nigerian mobile connection, two
// minutes in a lift or under a bridge is perfectly normal, and without
// a queue those two minutes of watching simply never happened: the
// learner watched the video and the bar did not move. They would have
// to watch it again, and they would be right to be annoyed.
//
// So a slice that does not get through is kept and sent again later. It
// is not lost, and the learner is told it is not lost, which is the
// part that stops them watching the same two minutes twice.
//
// IT SURVIVES THE TAB CLOSING. The queue is mirrored into localStorage
// under the lesson's id, so somebody whose phone dies with slices
// pending gets them sent the next time they open that lesson. Storage
// can throw in a private window, so every read and write is wrapped and
// the queue works without it, just less forgivingly.
//
// SENDING THE SAME SLICE TWICE IS SAFE AND DELIBERATE. lms_record_watch
// does insert ... on conflict do nothing, so a repeat is counted once.
// That is also what makes two browser tabs on the same lesson harmless.

const KEY = "dla-watch-queue-";
const MAX_QUEUE = 400; // an hour of video. Beyond that something is wrong

/**
 * How fast the queue is allowed to drain, which must not be faster than
 * the database will accept.
 *
 * THE BUG THIS EXISTS TO STOP. lms_record_watch does not fail when it
 * throttles: it answers normally, with the coverage unchanged. So a
 * queue that treats "answered" as "stored" throws the slice away. That
 * is survivable while playing, because the page only ever sends one or
 * two at a time, and it is a disaster on reconnect: a learner who went
 * through a tunnel comes back with thirty slices queued, the queue
 * fires them off as fast as the network allows, the database stores the
 * first dozen and ignores the rest, and the queue deletes all thirty.
 * The feature whose entire promise is "nothing is lost" would lose
 * nearly everything in the one situation it exists for.
 *
 * So the queue keeps to the same rate the database does. A backlog
 * drains at the speed of somebody watching at 1.5x, which is as fast as
 * the slices could honestly have been produced in the first place. The
 * number itself is in slices.js, next to the rest of the arithmetic and
 * next to the note saying it mirrors the SQL.
 */
const WINDOW_MS = 60000;

type Pending = { bucket: number; position: number };

function readStored(lessonId: string): Pending[] {
  try {
    const raw = localStorage.getItem(KEY + lessonId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_QUEUE) : [];
  } catch {
    return [];
  }
}

function writeStored(lessonId: string, queue: Pending[]) {
  try {
    if (queue.length === 0) localStorage.removeItem(KEY + lessonId);
    else localStorage.setItem(KEY + lessonId, JSON.stringify(queue.slice(0, MAX_QUEUE)));
  } catch {
    // A private window, or storage that is full. The queue still works
    // for this tab; it just will not survive the tab closing.
  }
}

export type WatchState = {
  /** The last coverage the server reported, 0 to 100. */
  coverage: number;
  /** True once the server says the lesson check is open. */
  unlocked: boolean;
  /** Slices waiting to be sent. Above zero means something is wrong. */
  waiting: number;
  /** True when sends are failing, so the page can say so. */
  offline: boolean;
  /** True when slices are getting through but coverage is not rising. */
  stuck: boolean;
  /** True while a backlog is draining at the rate the database accepts. */
  catchingUp: boolean;
};

export function useWatchQueue(
  lessonId: string,
  startCoverage: number,
  bucketSeconds = 10,
) {
  const [state, setState] = useState<WatchState>({
    coverage: startCoverage,
    unlocked: false,
    waiting: 0,
    offline: false,
    stuck: false,
    catchingUp: false,
  });

  const queue = useRef<Pending[]>([]);
  const sending = useRef(false);
  const lastCoverage = useRef(startCoverage);
  const flatRuns = useRef(0);
  const alive = useRef(true);
  // When each send went out, so the queue can keep to the same rate the
  // database does. See sendsAllowedPerMinute.
  const sends = useRef<number[]>([]);

  // Pick up anything a previous visit left behind.
  useEffect(() => {
    alive.current = true;
    queue.current = readStored(lessonId);
    setState((s) => ({ ...s, waiting: queue.current.length }));
    return () => {
      alive.current = false;
      writeStored(lessonId, queue.current);
    };
  }, [lessonId]);

  useEffect(() => {
    lastCoverage.current = startCoverage;
    setState((s) => ({ ...s, coverage: startCoverage }));
  }, [startCoverage, lessonId]);

  /** Sends what is queued, oldest first, stopping at the first failure. */
  const flush = useCallback(async () => {
    if (sending.current || queue.current.length === 0) return;
    sending.current = true;

    const perMinute = sendsAllowedPerMinute(bucketSeconds);

    try {
      while (queue.current.length > 0 && alive.current) {
        // KEEP TO THE DATABASE'S RATE. Going faster does not get the
        // slices stored, it gets them thrown away, and because a
        // throttled reply looks exactly like a successful one the queue
        // would then delete them. Stopping here and letting the retry
        // timer come back is slower and loses nothing.
        const now = Date.now();
        sends.current = sends.current.filter((t) => now - t < WINDOW_MS);
        if (sends.current.length >= perMinute) {
          setState((s) => ({
            ...s,
            catchingUp: true,
            offline: false,
            waiting: queue.current.length,
          }));
          return;
        }

        const next = queue.current[0];
        sends.current.push(now);
        const got = await recordWatch(lessonId, next.bucket, next.position);

        if (got === null) {
          // Did not get through. Leave it at the front of the queue and
          // stop: sending the rest now would just fail too, and the
          // order matters for the position that gets stored last.
          setState((s) => ({ ...s, offline: true, waiting: queue.current.length }));
          return;
        }

        queue.current.shift();
        writeStored(lessonId, queue.current);

        // COVERAGE NOT RISING, while slices ARE getting through, is a
        // real state and it used to be invisible. It happens when the
        // throttle is refusing them, which is what 2x playback does.
        // Silence here means a learner watches a whole lesson and the
        // bar does not move, with nothing on the page to explain it.
        if (got.coverage <= lastCoverage.current) {
          flatRuns.current += 1;
        } else {
          flatRuns.current = 0;
        }
        lastCoverage.current = got.coverage;

        setState({
          coverage: got.coverage,
          unlocked: got.unlocked,
          waiting: queue.current.length,
          offline: false,
          stuck: flatRuns.current >= 3,
          catchingUp: queue.current.length > 0,
        });
      }
    } finally {
      sending.current = false;
    }
  }, [lessonId]);

  /** Hand in one slice. It is sent now if it can be, queued if not. */
  const record = useCallback(
    (bucket: number, position: number) => {
      // Already queued? Nothing to add. This is what makes a second tab
      // on the same lesson cost nothing.
      if (!queue.current.some((p) => p.bucket === bucket)) {
        if (queue.current.length < MAX_QUEUE) {
          queue.current.push({ bucket, position });
        }
      }
      setState((s) => ({ ...s, waiting: queue.current.length }));
      void flush();
    },
    [flush],
  );

  // Try again when the browser says the connection is back, and every
  // five seconds in case it never says so. Browsers are not reliable
  // about the online event, especially on a phone switching between
  // wifi and mobile data.
  //
  // Five rather than twenty because this is also what paces a backlog:
  // the queue stops as soon as it has used the minute's allowance, and
  // this is what comes back to send the next one the moment there is
  // room. At twenty seconds a thirty slice backlog would take ten
  // minutes to drain instead of three.
  useEffect(() => {
    function back() {
      void flush();
    }
    window.addEventListener("online", back);
    const timer = window.setInterval(back, 5000);
    return () => {
      window.removeEventListener("online", back);
      window.clearInterval(timer);
    };
  }, [flush]);

  return { ...state, record, flush };
}
