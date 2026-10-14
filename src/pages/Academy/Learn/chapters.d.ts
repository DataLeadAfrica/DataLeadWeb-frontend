// Types for chapters.js. See that file for why the parser exists in
// both JavaScript and SQL.

export type Chapter = { start_seconds: number; title: string };
export type ParseResult = {
  chapters: Chapter[];
  error?: { line: number; message: string };
};

export declare function parseChapters(text: string | null | undefined): ParseResult;
export declare function clock(seconds: number): string;
export declare function jumpable(
  chapters: Chapter[] | undefined,
  opts?: { furthestSeconds?: number; fullyWatched?: boolean },
): (Chapter & { open: boolean })[];
