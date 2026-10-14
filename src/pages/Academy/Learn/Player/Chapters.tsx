import "./Chapters.css";
import { clock, jumpable } from "../chapters.js";
import type { LessonChapter } from "../../../../lib/learn";

// The video's own chapters, under the player.
//
// WHERE THEY COME FROM. A facilitator pastes the chapter list out of the
// YouTube description into one box, and lms_parse_chapters turns it into
// rows. Nobody retypes anything, which is the only way a list like this
// stays true: a second copy of the timings is a second copy to get
// wrong, and the one that is wrong is always the one on the website.
//
// A CHAPTER CAN BE JUMPED TO ONCE IT HAS BEEN REACHED, and not before.
// The rest say "After you reach it" rather than being hidden, because
// the list is also a table of contents: knowing that "Missing value
// codes" is coming is useful even while it is shut.
//
// The rule is worked out by jumpable() in chapters.js, from the furthest
// point the SERVER has recorded, not from where the player happens to
// be. And it is only the page being polite: lms_record_watch refuses to
// credit a jump that was not allowed whatever this lets anybody press.

type Props = {
  chapters: LessonChapter[];
  furthestSeconds: number;
  fullyWatched: boolean;
  /** Where the playhead is, so the one being watched can say so. */
  position: number;
  onJump: (seconds: number) => void;
};

export default function Chapters({
  chapters,
  furthestSeconds,
  fullyWatched,
  position,
  onJump,
}: Props) {
  if (chapters.length === 0) return null;

  // jumpable returns each chapter with an open flag on it, rather than
  // a parallel array, so the two cannot get out of step.
  const rows = jumpable(chapters, { furthestSeconds, fullyWatched });

  // Which one the playhead is inside: the last one that starts at or
  // before it.
  let watching = -1;
  for (let i = 0; i < chapters.length; i += 1) {
    if (chapters[i].start_seconds <= position) watching = i;
  }

  return (
    <section className="acad-chapters" aria-label="Chapters">
      <div className="acad-chapters__top">
        <span>Chapters</span>
        <span>From the video's description</span>
      </div>

      <ol>
        {rows.map((c, i) => {
          const can = c.open;
          const now = i === watching;
          return (
            <li
              key={`${c.start_seconds}-${c.title}`}
              className={`acad-chapters__row${can ? " is-open" : ""}${now ? " is-now" : ""}`}
            >
              <button
                type="button"
                disabled={!can}
                onClick={() => onJump(c.start_seconds)}
                // A shut chapter is a disabled button rather than a span,
                // so a keyboard lands on it and a screen reader says it
                // is unavailable, instead of it simply not being there.
                aria-label={
                  can
                    ? `Watch ${c.title} from ${clock(c.start_seconds)}`
                    : `${c.title}. Not yet: you can jump to it once you have reached it.`
                }
              >
                <b className="acad-mono">{clock(c.start_seconds)}</b>
                <span>{c.title}</span>
                <small>{now ? "Watching" : can ? "Watched" : "After you reach it"}</small>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
