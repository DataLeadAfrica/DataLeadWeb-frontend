// Chapters of a video lesson: reading the text a facilitator pastes,
// and deciding which chapters a learner may jump to.
//
// TWO JOBS, AND ONLY ONE OF THEM IS THE REAL PARSER.
//
//   parseChapters is a copy of lms_parse_chapters in
//   database/lms/16_restructure.sql, for the staff screen's live
//   preview, so a facilitator sees what their paste will become before
//   they save it. The database is the authority: it parses the text
//   again on the way in and refuses anything this missed. A disagreement
//   can only ever show a preview that is then rejected, never save
//   something bad.
//
//   jumpable is the learner's side, and has no copy anywhere. A chapter
//   can be jumped to once it has been reached. The rest say "After you
//   reach it".
//
// tests/chapters.test.mjs runs both in plain Node, and checks the error
// messages still match the ones the database raises.

/** The format YouTube uses, which is where this text is pasted from. */
const LINE = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/;

/**
 * Read a pasted chapter list.
 *
 * Returns { chapters } or { error: { line, message } }. It never
 * throws: the staff screen shows the message under the box as it is
 * typed, and a half typed list is the normal state, not a failure.
 *
 * The rules, which are YouTube's own:
 *   one chapter per line, blank lines ignored
 *   mm:ss Title, or h:mm:ss Title
 *   the first one must be 00:00
 *   the times must rise
 */
export function parseChapters(text) {
  const chapters = [];
  if (!text || !String(text).trim()) return { chapters };

  const lines = String(text).replace(/\r/g, "").split("\n");
  let last = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    const no = i + 1;
    if (raw === "") continue;

    const m = raw.match(LINE);
    if (!m) {
      return {
        chapters,
        error: {
          line: no,
          message:
            `Line ${no} is not a chapter: "${raw.slice(0, 60)}". ` +
            `A chapter line looks like "01:15 Finding duplicates" or "1:01:15 Finding duplicates".`,
        },
      };
    }

    const [, h, mm, ss, title] = m;
    if (Number(ss) > 59) {
      return { chapters, error: { line: no, message: `Line ${no} has ${ss} seconds, and a minute only has 60: "${raw.slice(0, 60)}".` } };
    }
    if (h !== undefined && Number(mm) > 59) {
      return { chapters, error: { line: no, message: `Line ${no} has ${mm} minutes, and an hour only has 60: "${raw.slice(0, 60)}".` } };
    }

    const seconds = h === undefined
      ? Number(mm) * 60 + Number(ss)
      : Number(h) * 3600 + Number(mm) * 60 + Number(ss);

    const name = title.trim();
    if (name.length > 120) {
      return { chapters, error: { line: no, message: `Line ${no} has a chapter title longer than 120 characters. Shorten it: "${name.slice(0, 60)}...".` } };
    }
    if (chapters.length === 0 && seconds !== 0) {
      return { chapters, error: { line: no, message: `The first chapter must start at 00:00. Line ${no} starts at ${clock(seconds)}.` } };
    }
    if (seconds <= last) {
      return { chapters, error: { line: no, message: `Line ${no} goes backwards. A chapter must start after the one before it: "${raw.slice(0, 60)}".` } };
    }

    last = seconds;
    chapters.push({ start_seconds: seconds, title: name });
  }

  return { chapters };
}

/**
 * mm:ss, or h:mm:ss once there is an hour of it. The same shape the
 * facilitator typed, so a chapter reads the same on the page as it did
 * in the description they pasted.
 */
export function clock(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const two = (x) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/**
 * Which chapters this learner may jump to.
 *
 * A chapter is open once they have reached it. On a first watch that
 * means everything behind the furthest point; once the lesson is fully
 * watched, all of them, because rewatching is free.
 *
 * furthestSeconds comes from the server, not from the player: the
 * player's own idea of how far it has got is exactly the number
 * somebody would change to skip the video.
 */
export function jumpable(chapters, { furthestSeconds = 0, fullyWatched = false } = {}) {
  return (chapters || []).map((c) => ({
    ...c,
    open: fullyWatched || c.start_seconds <= Number(furthestSeconds || 0),
  }));
}
