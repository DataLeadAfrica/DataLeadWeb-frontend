import "./WatchTape.css";

// The watch tape: one cell for every ten seconds of a lesson, with the
// unlock line marked on it.
//
// This is the Academy's own signature, and it is not decoration. The
// database records watching in ten second buckets and opens the lesson
// check once enough of them are covered, so the tape is a picture of the
// actual rule rather than a progress bar invented for the look of it. A
// learner can see exactly how much is left, and that skipping forward
// does not fill it in.
//
// BUILT IN PHASE 2, FIRST USED IN PHASE 4. It appears only inside the
// course experience, the lesson player and My learning. It must never
// appear on sign up, sign in or reset: it would be showing progress to
// somebody who does not yet have an account.
//
// TWO THINGS IT HAS TO SURVIVE, both found by rendering it rather than
// by reasoning about it:
//
//   A long lesson. An hour is 360 buckets, and 360 cells will not fit
//   across a phone. Drawn one each they shrink to nothing and the tape
//   renders as an empty strip. So above MAX_CELLS the buckets are drawn
//   in groups, and a group is only lit when every bucket in it is
//   covered. The count underneath still names real buckets, never the
//   drawn ones, because that is the number the rule is about.
//
//   A lesson with no length. duration_seconds can be null while a course
//   is still a draft. There is nothing to draw, so it says so rather
//   than drawing one cell the width of the card.

type Props = {
  /** Length of the lesson, straight from lms_lessons.duration_seconds. */
  durationSeconds: number;
  /** How many seconds are covered by recorded buckets. */
  watchedSeconds: number;
  /** The percentage that opens the lesson check. */
  unlockPercent?: number;
  /** Shown top left, usually the lesson title. */
  title?: string;
  /** Shown bottom left, usually the rule in words. */
  note?: string;
  /** Short version for a dashboard tile: no title row, no footnote. */
  compact?: boolean;
};

const BUCKET = 10;

/** The most cells worth drawing. Beyond this they are thinner than the
    gaps between them and the tape stops reading as anything. */
const MAX_CELLS = 120;

export default function WatchTape({
  durationSeconds,
  watchedSeconds,
  unlockPercent = 92,
  title,
  note,
  compact = false,
}: Props) {
  const timed = durationSeconds > 0;

  const buckets = timed ? Math.ceil(durationSeconds / BUCKET) : 0;
  const covered = Math.max(
    0,
    Math.min(buckets, Math.round(watchedSeconds / BUCKET)),
  );
  // ROUNDED DOWN, never to nearest. This number sits next to the line
  // marking where the lesson check opens, and 91.67 rounded to nearest
  // is 92: the page would say "92% watched" beside a 92% line and a
  // button that still refuses. Rounding down can only understate, and
  // the moment it reaches the mark the button really is open.
  const percent = timed
    ? Math.min(100, Math.floor((watchedSeconds / durationSeconds) * 100))
    : 0;

  // How many buckets each drawn cell stands for. One, for anything up to
  // twenty minutes.
  const perCell = buckets > MAX_CELLS ? Math.ceil(buckets / MAX_CELLS) : 1;
  const drawn = Math.ceil(buckets / perCell);
  const drawnOn = Math.floor(covered / perCell);

  const cells = [];
  for (let i = 0; i < drawn; i += 1) {
    const state = i < drawnOn ? " is-on" : i === drawnOn ? " is-now" : "";
    cells.push(<i key={i} className={`acad-tape__cell${state}`} />);
  }

  return (
    <div className={`acad-tape${compact ? " acad-tape--compact" : ""}`}>
      {!compact && title ? (
        <div className="acad-tape__top">
          <b>{title}</b>
          <span className="acad-mono">
            {timed ? `${covered} of ${buckets} cells` : "Length not set"}
          </span>
        </div>
      ) : null}

      {timed ? (
        <div
          className="acad-tape__cells"
          style={{ "--acad-tape-cells": drawn } as React.CSSProperties}
          role="img"
          aria-label={`${percent}% watched. The lesson check opens at ${unlockPercent}%.`}
        >
          {cells}
          <span
            className="acad-tape__mark"
            style={{ left: `${unlockPercent}%` }}
            data-mark={`${unlockPercent}%`}
            aria-hidden="true"
          />
        </div>
      ) : (
        <div className="acad-tape__blank" />
      )}

      {!compact ? (
        <div className="acad-tape__foot">
          <span>{note}</span>
          {timed ? (
            <span>
              <b>{percent}%</b> watched
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
