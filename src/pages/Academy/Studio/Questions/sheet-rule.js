// Does the first line of a pasted sheet hold the column names?
//
// PLAIN JAVASCRIPT, WITH A .d.ts BESIDE IT, so tests/paste-sheet.test.mjs
// can import it and run the real decision in plain Node. That is the same
// arrangement as Player/slices.js, and for the same reason: this one
// question broke pasting completely and a test that reads the source as
// text would not have caught it.
//
// THE RULE THIS REPLACED WAS "ANY CELL MATCHES A COLUMN NAME".
//
// A, B, C and D are column names. The Right column of every question
// holds A, B, C or D. So the first question of any sheet pasted WITHOUT
// its header row matched, was taken as the column names and dropped, and
// every row after it was then read against that question's cells instead
// of against the real names. Three rows pasted came back as "2 rows
// read", both skipped, "No question text." Dr Ayoola found it with a
// real sheet, and thirty rows pasted WITH the header row had always
// worked, which is why it survived.

/** The columns, in the order a sheet pasted without a header is read in. */
export const HEADERS = ["Question", "A", "B", "C", "D", "Right", "Why", "Lesson", "Time"];

/**
 * True when these cells are the column names rather than a question.
 *
 * Either of two things, and a row of real questions can manage neither:
 *
 *   the FIRST cell is the word Question, in any case, or
 *   FOUR OR MORE cells match a column name.
 *
 * Four, because a question row can only ever match on its Right cell,
 * which is one, while a header row written with different wording still
 * matches on A, B, C, D and Right, which is five. Three would also do
 * and four leaves room.
 *
 * THE ONE ACCEPTED MISS: a question whose entire text is the single word
 * "Question" is read as a header. That is a word and not a question, and
 * the alternative rules all give up something worse.
 */
export function hasHeaderRow(cells) {
  const first = (cells[0] || "").trim().toLowerCase();
  if (first === "question") return true;
  const named = cells.filter((c) =>
    HEADERS.some((h) => h.toLowerCase() === (c || "").trim().toLowerCase()),
  ).length;
  return named >= 4;
}
