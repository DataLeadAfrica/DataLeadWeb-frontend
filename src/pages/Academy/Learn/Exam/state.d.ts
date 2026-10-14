// Types for state.js, the course exam page's five states.

export type ExamStatus = {
  state: "not_open" | "open" | "in_progress" | "waiting" | "passed" | string;
  exam_id?: string;
  lessons_done?: number;
  lessons_total?: number;
  tries_allowed?: number;
  tries_used?: number;
  tries_left?: number;
  attempt_id?: string | null;
  deadline_at?: string | null;
  reopens_at?: string | null;
  best_percent?: number | null;
  pass_mark?: number;
  question_count?: number;
  minutes?: number;
};

export type ExamView = {
  state: string;
  heading: string;
  button: { label: string; disabled: boolean } | null;
  note: string;
  canStart: boolean;
  showTryAgain: boolean;
  deadlineAt?: string | null;
  reopensAt?: string | null;
};

export declare function examView(s: ExamStatus | null | undefined, now?: number): ExamView;
export declare function countdown(when: string, now?: number): string;
export declare function answerPayload(
  chosen: Record<string, string[] | string> | null | undefined,
): { payload: Record<string, string[]>; answered: number };
