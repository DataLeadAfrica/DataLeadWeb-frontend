import { certDb } from "./certificates";

// Everything the four learning pages ask of Supabase.
//
// All of it needs a signed in person, and all of it is private to that
// person. Nothing here is reachable by a stranger: every function is
// revoked from anon in database file 15.
//
// WHAT IS DELIBERATELY NOT HERE. Nothing selects from lms_lessons, and
// nothing anywhere in this file can return a video reference except
// openLesson, which asks the database whether the lesson is open to this
// learner before it answers. The course outline comes from myCourse,
// which has no video column at all. There is a test, file 15 test 4,
// that reads myCourse's whole output and fails if a reference appears.

// --------------------------------------------------------------- types

export type LearnLesson = {
  id: string;
  position: number;
  title: string;
  type: string;
  seconds: number;
  coverage_needed: number;
  completed: boolean;
  check_passed: boolean;
  has_check: boolean;
  coverage: number;
  unlocked: boolean;
  last_position: number;
};

export type LearnModuleQuiz = {
  id: string;
  title: string;
  pass_mark: number;
  question_count: number;
  tries_allowed: number;
  tries_used: number;
  passed: boolean;
  best_percent: number | null;
  next_opens_at: string | null;
};

export type LearnModule = {
  position: number;
  title: string;
  summary: string;
  seconds: number;
  lesson_count: number;
  lessons_done: number;
  lessons: LearnLesson[];
  quiz: LearnModuleQuiz | null;
};

export type MyCourse = {
  course_id: string;
  slug: string;
  title: string;
  summary: string;
  tool: string;
  level: string;
  cover_code: string;
  lesson_count: number;
  lessons_done: number;
  quiz_count: number;
  quizzes_passed: number;
  percent: number;
  resume_lesson_id: string | null;
  resume_lesson_title: string | null;
  resume_second: number | null;
  certificate_number: string | null;
  certificate_issued_on: string | null;
  modules: LearnModule[];
};

export type QuizStatus = {
  kind: "check" | "quiz";
  title: string;
  pass_mark: number;
  question_count: number;
  tries_allowed: number; // 0 means unlimited, which is every lesson check
  tries_used: number;
  tries_left: number | null;
  passed: boolean;
  best_percent: number | null;
  open_attempt_id: string | null;
  next_opens_at: string | null;
  can_start: boolean;
  reason: string;
};

export type QuizOption = { id: string; label: string };
export type QuizQuestion = {
  id: string;
  prompt: string;
  type: string;
  marks: number;
  options: QuizOption[];
};
export type StartedQuiz = { attemptId: string; questions: QuizQuestion[] };

export type QuizResult = {
  kind: string;
  correct_count: number;
  question_count: number;
  score: number;
  max_score: number;
  percent: number;
  passed: boolean;
  pass_mark: number;
  feedback: string;
};

export type QuestionMark = {
  question_id: string;
  prompt: string;
  was_right: boolean;
  explanation: string;
};

export type OpenLesson = {
  lesson_id: string;
  title: string;
  video_provider: string | null;
  video_ref: string | null;
  content_md: string | null;
  duration_seconds: number | null;
  bucket_seconds: number;
  coverage_percent: number;
};

export type WeekDay = { day: string; seconds: number; minutes: number };

export type MyCourseRow = {
  course_id: string;
  slug: string;
  title: string;
  cover_code: string;
  tool: string;
  level: string;
  lesson_count: number;
  quiz_count: number;
  lessons_done: number;
  quizzes_passed: number;
  percent: number;
  has_access: boolean;
  started: boolean;
  last_activity: string | null;
  resume_lesson_id: string | null;
  resume_lesson_title: string | null;
  resume_second: number | null;
  certificate_number: string | null;
};

export type MyCertificate = {
  certificate_number: string;
  course_title: string;
  course_slug: string;
  issued_on: string;
  revoked: boolean;
};

// ------------------------------------------------------------- reading

/**
 * Everything one learning page draws, in one call.
 *
 * THREE ANSWERS, and the page shows something different for each, the
 * same way the public course page does:
 *
 *   a course    they have access and here it is
 *   "missing"   the database answered: no such published course, or
 *               they have no access to it. A calm page, not an error
 *   null        we could not ask. "Try again", not "you do not have this"
 *
 * The difference between the last two is the whole reason this returns
 * three things. Telling somebody they have lost access to a course they
 * paid for, when the truth is that the database did not answer, is the
 * worst wrong thing this page could say.
 */
export async function getMyCourse(
  slug: string,
): Promise<MyCourse | "missing" | null> {
  if (!certDb) return null;
  try {
    const { data, error } = await certDb.rpc("lms_my_course", { p_slug: slug });
    if (error) return null;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return "missing";
    const row = rows[0] as MyCourse;
    // modules arrives as jsonb. Supabase hands it back parsed, but a
    // null would make every map() below throw, so it is normalised once
    // here rather than guarded at every use.
    return { ...row, modules: Array.isArray(row.modules) ? row.modules : [] };
  } catch {
    return null;
  }
}

/** Why a quiz can or cannot be started, in words a page can show. */
export async function getQuizStatus(quizId: string): Promise<QuizStatus | null> {
  if (!certDb || !quizId) return null;
  try {
    const { data, error } = await certDb.rpc("lms_quiz_status", { p_quiz: quizId });
    if (error) return null;
    const rows = Array.isArray(data) ? data : [];
    return rows.length ? (rows[0] as QuizStatus) : null;
  } catch {
    return null;
  }
}

/**
 * The lesson's video, and only if the database agrees it is open.
 *
 * This is the ONLY call in the whole site that can return a video
 * reference, and it checks lms_lesson_is_open before it answers. A page
 * that wanted to be clever and cache the reference would be handing out
 * paid videos, so nothing does.
 */
export async function openLesson(lessonId: string): Promise<OpenLesson | null> {
  if (!certDb || !lessonId) return null;
  try {
    const { data, error } = await certDb.rpc("lms_open_lesson", { p_lesson: lessonId });
    if (error) return null;
    const rows = Array.isArray(data) ? data : [];
    return rows.length ? (rows[0] as OpenLesson) : null;
  } catch {
    return null;
  }
}

/** The last seven days of watching, for the This week chart. */
export async function getMyWeek(): Promise<WeekDay[]> {
  if (!certDb) return [];
  try {
    const { data, error } = await certDb.rpc("lms_my_week");
    if (error || !Array.isArray(data)) return [];
    return data as WeekDay[];
  } catch {
    return [];
  }
}

/** Every course this learner can open or has started. */
export async function getMyCourses(): Promise<{ ok: boolean; courses: MyCourseRow[] }> {
  if (!certDb) return { ok: false, courses: [] };
  try {
    const { data, error } = await certDb.rpc("lms_my_courses");
    if (error) return { ok: false, courses: [] };
    return { ok: true, courses: Array.isArray(data) ? (data as MyCourseRow[]) : [] };
  } catch {
    return { ok: false, courses: [] };
  }
}

/** Their Academy certificates. */
export async function getMyCertificates(): Promise<MyCertificate[]> {
  if (!certDb) return [];
  try {
    const { data, error } = await certDb.rpc("lms_my_certificates");
    if (error || !Array.isArray(data)) return [];
    return (data as MyCertificate[]).filter((c) => !c.revoked);
  } catch {
    return [];
  }
}

// ------------------------------------------------------------- writing

/**
 * One ten second slice of real watching.
 *
 * Returns null when the call did not get through, which the player
 * treats as "queue it and try again", NOT as "that did not count". The
 * difference matters: a learner on a train who loses signal for two
 * minutes must not lose two minutes of credit.
 */
export async function recordWatch(
  lessonId: string,
  bucket: number,
  position: number,
): Promise<{ coverage: number; unlocked: boolean } | null> {
  if (!certDb) return null;
  try {
    const { data, error } = await certDb.rpc("lms_record_watch", {
      p_lesson: lessonId,
      p_bucket: bucket,
      p_position: Math.max(0, Math.round(position)),
    });
    if (error) return null;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return null;
    const r = rows[0] as { coverage: number; unlocked: boolean };
    return { coverage: Number(r.coverage) || 0, unlocked: Boolean(r.unlocked) };
  } catch {
    return null;
  }
}

/**
 * Start or carry on a try.
 *
 * The database returns one row per question per option, which is the
 * shape a SQL function can return. This folds it into questions with
 * their options, which is the shape a page can draw.
 *
 * There is no is_correct in any of it, and there never will be: that
 * single column is the one that would make every quiz in the Academy
 * pointless, and lms_start_quiz does not select it.
 */
export async function startQuiz(quizId: string): Promise<StartedQuiz | null> {
  if (!certDb || !quizId) return null;
  try {
    const { data, error } = await certDb.rpc("lms_start_quiz", { p_quiz: quizId });
    if (error || !Array.isArray(data) || data.length === 0) return null;

    type Row = {
      attempt_id: string;
      question_id: string;
      prompt: string;
      qtype: string;
      marks: number;
      option_id: string | null;
      option_label: string | null;
      option_position: number | null;
    };
    const rows = data as Row[];
    const byId = new Map<string, QuizQuestion>();
    const order: string[] = [];

    for (const r of rows) {
      if (!byId.has(r.question_id)) {
        byId.set(r.question_id, {
          id: r.question_id,
          prompt: r.prompt,
          type: r.qtype,
          marks: r.marks,
          options: [],
        });
        order.push(r.question_id);
      }
      // A short answer question comes back with no option row, which is
      // correct: there is nothing to choose from.
      if (r.option_id) {
        byId.get(r.question_id)!.options.push({
          id: r.option_id,
          label: r.option_label || "",
        });
      }
    }

    return {
      attemptId: rows[0].attempt_id,
      questions: order.map((id) => byId.get(id)!),
    };
  } catch {
    return null;
  }
}

/** Mark a try. Every comparison happens on the server. */
export async function submitQuiz(
  attemptId: string,
  answers: Record<string, string | string[]>,
): Promise<QuizResult | null> {
  if (!certDb) return null;
  try {
    const { data, error } = await certDb.rpc("lms_submit_quiz", {
      p_attempt: attemptId,
      p_answers: answers,
    });
    if (error) return null;
    const rows = Array.isArray(data) ? data : [];
    return rows.length ? (rows[0] as QuizResult) : null;
  } catch {
    return null;
  }
}

/**
 * Right or wrong per question, with the explanation.
 *
 * The server decides what this is allowed to say, and it says different
 * things for the two kinds. A lesson check gives everything, because the
 * explanation IS the lesson. A module quiz gives nothing until it has
 * been passed, because right or wrong per question across three tries is
 * solvable by elimination. The page does not get a say in that, and an
 * empty list here is a normal answer rather than a failure.
 */
export async function getAttemptMarks(attemptId: string): Promise<QuestionMark[]> {
  if (!certDb || !attemptId) return [];
  try {
    const { data, error } = await certDb.rpc("lms_attempt_marks", {
      p_attempt: attemptId,
    });
    if (error || !Array.isArray(data)) return [];
    return data as QuestionMark[];
  } catch {
    return [];
  }
}

/** Mark the lesson done. The server checks the watching and the check. */
export async function completeLesson(
  lessonId: string,
): Promise<{ completed: boolean; reason: string } | null> {
  if (!certDb) return null;
  try {
    const { data, error } = await certDb.rpc("lms_complete_lesson", {
      p_lesson: lessonId,
    });
    if (error) return null;
    const rows = Array.isArray(data) ? data : [];
    return rows.length ? (rows[0] as { completed: boolean; reason: string }) : null;
  } catch {
    return null;
  }
}

/**
 * Ask for the certificate. Safe to call twice, by design.
 *
 * The page calls this after every lesson completed and every quiz
 * passed, without first working out whether the course is finished. The
 * server already knows, and asking it is cheaper and more reliable than
 * two places both deciding. When the course is not finished it answers
 * issued=false with a sentence saying how far off they are, which the
 * page simply ignores.
 */
export async function claimCertificate(
  courseId: string,
): Promise<{ issued: boolean; certificate_number: string | null; message: string } | null> {
  if (!certDb || !courseId) return null;
  try {
    const { data, error } = await certDb.rpc("lms_claim_course_certificate", {
      p_course: courseId,
    });
    if (error) return null;
    const rows = Array.isArray(data) ? data : [];
    return rows.length
      ? (rows[0] as { issued: boolean; certificate_number: string | null; message: string })
      : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- wording

/** 150 becomes "02:30". The time a player shows. */
export function clock(seconds: number | null | undefined): string {
  const n = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "1 lesson", "12 lessons". One lesson is not "1 lessons". */
export function plural(n: number, one: string, many?: string): string {
  const count = Number(n) || 0;
  return `${count} ${count === 1 ? one : many || `${one}s`}`;
}

/** A time of day a learner reads, in their own evening: "14:20 on 9 Oct". */
export function whenItOpens(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    hour12: false,
  });
}

/** The address of a lesson inside a course. One place decides the shape. */
export function lessonPath(slug: string, lessonId: string): string {
  return `/lms/learn/${encodeURIComponent(slug)}/${encodeURIComponent(lessonId)}`;
}

/** The address of a module quiz. */
export function quizPath(slug: string, quizId: string): string {
  return `/lms/learn/${encodeURIComponent(slug)}/quiz/${encodeURIComponent(quizId)}`;
}

/**
 * The name that will actually be printed on the certificate.
 *
 * NOT the one from getSession. That one falls back to the part of the
 * email address before the at sign, which is exactly right for a
 * greeting ("Good morning, ada") and exactly wrong on a certificate,
 * where it would read "This certifies that learner".
 *
 * lms_profiles.full_name is the same field lms_claim_course_certificate
 * reads when it issues the certificate, so showing it here means the
 * card on screen and the certificate in the register carry the same
 * name. An empty answer is a real answer: the page then asks for a name
 * rather than inventing one.
 */
export async function profileName(): Promise<string> {
  if (!certDb) return "";
  try {
    // getSession, not getUser. getUser asks the server who this token
    // belongs to, which is a round trip the certificate page does not
    // need: the id is already in the session this browser holds, and
    // the read below is checked against it by row security anyway.
    const { data } = await certDb.auth.getSession();
    const id = data?.session?.user?.id;
    if (!id) return "";
    const got = await certDb
      .from("lms_profiles")
      .select("full_name")
      .eq("id", id)
      .maybeSingle();
    if (got.error || !got.data) return "";
    return ((got.data as { full_name: string | null }).full_name || "").trim();
  } catch {
    return "";
  }
}
