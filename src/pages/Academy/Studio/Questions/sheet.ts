// Reading a pasted sheet.
//
// IN ITS OWN FILE because Paste.tsx is a component and this is not.
// A module that exports both means every edit to the function reloads
// the component tree in development, which is what the fast refresh
// rule is warning about, and it is right.

const HEADERS = ["Question", "A", "B", "C", "D", "Right", "Why", "Lesson", "Time"];

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
 */
export function readSheet(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  const firstCells = lines[0].split("\t").map((c) => c.trim());
  const hasHeader = firstCells.some((c) =>
    HEADERS.some((h) => h.toLowerCase() === c.toLowerCase()),
  );
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
