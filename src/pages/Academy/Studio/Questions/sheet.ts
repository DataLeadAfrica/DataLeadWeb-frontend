// Reading a pasted sheet.
//
// IN ITS OWN FILE because Paste.tsx is a component and this is not.
// A module that exports both means every edit to the function reloads
// the component tree in development, which is what the fast refresh
// rule is warning about, and it is right.

import { HEADERS, hasHeaderRow } from "./sheet-rule";

/**
 * Tab separated text to rows, using the first line as the headings.
 *
 * TAB SEPARATED, because that is what Excel and Google Sheets put on the
 * clipboard. Nothing is uploaded and no file is read: a paste is what
 * somebody actually does, and asking for a .csv means asking them to
 * Save As first, find the file, and discover Excel wrote it in the wrong
 * encoding.
 *
 * A FIRST LINE THAT LOOKS LIKE THE HEADINGS IS THE HEADINGS. One that
 * does not is data, and the columns are assumed in the order above,
 * because somebody who copied without the header row should not have to
 * go back for it.
 *
 * AND "LOOKS LIKE THE HEADINGS" USED TO MEAN "ANY CELL MATCHES ONE",
 * which broke pasting without a header row completely.
 *
 * A, B, C and D are column names. The Right column of every question
 * holds A, B, C or D. So the first question of any sheet pasted without
 * its header row matched, was taken as the headings and dropped, and
 * every other row was then read against ITS cells rather than against
 * the real column names. Three rows pasted came back as "2 rows read",
 * both skipped, "No question text." Dr Ayoola found it with a real
 * sheet.
 *
 * The rule now needs one of two things, either of which is nearly
 * impossible in a row of real questions:
 *
 *   the FIRST cell is the word Question, in any case, or
 *   FOUR OR MORE cells match a column name.
 *
 * Four, because a question row can only ever match on its Right cell,
 * and a header row written with different wording still matches on A, B,
 * C, D and Right. A question whose text is the single word "Question"
 * and nothing else would be read as a header, which is a sentence and
 * not a question, so it is left as the one accepted miss.
 */
export function readSheet(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  const firstCells = lines[0].split("\t").map((c) => c.trim());
  const hasHeader = hasHeaderRow(firstCells);
  const heads = hasHeader
    ? firstCells.map((c) => HEADERS.find((h) => h.toLowerCase() === c.toLowerCase()) || c)
    : HEADERS;

  return lines.slice(hasHeader ? 1 : 0).map((line) => {
    const cells = line.split("\t");
    const row: Record<string, string> = {};
    heads.forEach((h, i) => {
      row[h] = (cells[i] || "").trim();
    });
    return row;
  });
}

export { HEADERS };
