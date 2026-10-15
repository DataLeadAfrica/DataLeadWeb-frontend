import { certDb } from "../../../../lib/certificates";
import type { Answer, CourseState, PublishCheck } from "../../../../lib/studio";

export type { PublishCheck };

// The builder's own calls, kept beside the builder rather than in
// lib/studio.ts, because nothing else in the control room uses them and
// a data layer that holds every call any page ever makes is one nobody
// can read.

export type StudioChapter = { start_seconds: number; title: string };

export type StudioLesson = {
  id: string;
  module_id?: string;
  title: string;
  summary: string;
  type: "video" | "reading" | "download";
  position: number;
  video_provider: string | null;
  video_ref: string | null;
  duration_seconds: number | null;
  chapters_text: string;
  chapters: StudioChapter[];
  check_id: string | null;
  check_status: string | null;
  check_questions: number;
};

export type StudioModule = {
  id: string;
  title: string;
  position: number;
  lessons: StudioLesson[];
};

export type StudioCourseFull = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  state: CourseState;
  level: string;
  tool: string;
  area: string;
  cover_code: string;
  cover_url: string | null;
  price_kobo: number;
  first_module_free: boolean;
  outcomes: string[];
  audience: string[];
  prerequisites: string[];
  faq: { q: string; a: string }[];
  programme_id: string | null;
  review_note: string;
  sent_for_review_at: string | null;
  sent_by: string | null;
  built_by: string | null;
  areas: string[];
  next: string[];
  modules: StudioModule[];
  exam: {
    id: string;
    status: string;
    serve_count: number;
    minutes: number;
    pass_percent: number;
    tries: number;
    bank: number;
    needed: number;
  } | null;
  checks: PublishCheck[];
};

function failed(error: unknown): { ok: false; message: string } {
  const e = error as { message?: string } | null;
  return {
    ok: false,
    message: (e && e.message) || "That did not work. Try again.",
  };
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<Answer<T>> {
  if (!certDb) return { ok: false, message: "The Academy database is not reachable from here." };
  const { data, error } = await certDb.rpc(fn, args);
  if (error) return failed(error);
  return { ok: true, data: data as T };
}

export function getStudioCourse(course: string) {
  return call<StudioCourseFull>("lms_studio_course", { p_course: course });
}

/**
 * Save one lesson. Null leaves a field alone.
 *
 * The video goes up as whatever was pasted. The database reduces a
 * YouTube address to its id, in any of the forms somebody might paste,
 * and refuses anything that is not one. Doing that here instead would
 * mean a second parser to keep in step with the first.
 */
export function saveLesson(args: {
  lesson?: string | null;
  module?: string | null;
  title?: string;
  summary?: string;
  type?: string;
  videoRef?: string;
  durationSeconds?: number | null;
  chaptersText?: string;
}) {
  return call<string>("lms_save_lesson", {
    p_lesson: args.lesson ?? null,
    p_module: args.module ?? null,
    p_title: args.title ?? null,
    p_summary: args.summary ?? null,
    p_type: args.type ?? null,
    p_video_ref: args.videoRef ?? null,
    p_duration_seconds: args.durationSeconds ?? null,
    p_chapters_text: args.chaptersText ?? null,
  });
}

export function addModule(course: string, title?: string) {
  return call<string>("lms_add_module", { p_course: course, p_title: title ?? null });
}

export function removeLesson(lesson: string) {
  return call<null>("lms_remove_lesson", { p_lesson: lesson });
}

export function reorderLessons(module: string, lessons: string[]) {
  return call<null>("lms_reorder_lessons", { p_module: module, p_lessons: lessons });
}

export type StudioQuestion = {
  id: string;
  prompt: string;
  explanation: string;
  shown_at: number;
  active: boolean;
  locked: boolean;
  options: { id: string; label: string; is_correct: boolean }[];
  lesson_id: string | null;
  chapter_start: number | null;
};

export function getQuestions(quiz: string) {
  return call<StudioQuestion[]>("lms_studio_questions", { p_quiz: quiz });
}

/** "6:00" from 360, which is how a length is written everywhere here. */
export function asClock(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, "0")}`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 360 from "6:00". Null for anything that is not a time. */
export function fromClock(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,2}(:\d{1,2}){1,2}$/.test(t)) return null;
  const p = t.split(":").map(Number);
  return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
}
