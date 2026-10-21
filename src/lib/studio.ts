import { certDb } from "./certificates";

// The control room's data layer.
//
// EVERY ONE OF THESE IS A FUNCTION CALL, never a table read. The staff
// pages never select from lms_courses or lms_profiles directly, for the
// same reason the learner pages never do: the rule about who may see
// what lives in file 17, in one place, and a page that reaches past it
// is a page that can be wrong about it.
//
// WHAT HAPPENS WHEN THE DATABASE REFUSES. File 17 raises with a message
// written for a person: "Only an administrator can publish a course."
// Those messages are shown as they are, rather than replaced with
// something vaguer. A refusal somebody can read is one they can act on,
// and inventing our own wording here would mean two places saying what
// the rule is.
//
// NOTHING IS CACHED. The control room is the place where somebody
// changes something and then looks to see whether it changed. A cache
// here would be a page that lies about the thing you just did.

export type Role = "admin" | "facilitator" | "learner";

export type CourseState = "draft" | "review" | "published" | "archived";

export type StudioCourse = {
  id: string;
  slug: string;
  title: string;
  state: CourseState;
  cover_code: string;
  area: string;
  tool: string;
  learners: number;
  updated_at: string;
};

export type StudioQueueItem = {
  kind: string;
  heading: string;
  detail: string;
  button: string;
  subject: string;
};

export type StudioOverview = {
  is_admin: boolean;
  name: string | null;
  week: {
    new_learners: number;
    active: number;
    minutes: number;
    certificates: number;
  };
  courses: StudioCourse[];
  queue: StudioQueueItem[];
};

/** What the database said, or what went wrong, in words a person can read. */
export type Answer<T> = { ok: true; data: T } | { ok: false; message: string };

function failed(error: unknown): { ok: false; message: string } {
  const e = error as { message?: string } | null;
  const raw = (e && e.message) || "";
  // Supabase wraps the database's message. The database's own wording is
  // the useful half, so anything before it is dropped.
  const clean = raw.replace(/^.*?(?:ERROR:\s*)?/, "").trim();
  return {
    ok: false,
    message: clean || "That did not work. Try again, and tell somebody if it keeps happening.",
  };
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<Answer<T>> {
  if (!certDb) return { ok: false, message: "The Academy database is not reachable from here." };
  const { data, error } = await certDb.rpc(fn, args);
  if (error) return failed(error);
  return { ok: true, data: data as T };
}

// ---------------------------------------------------------------------
// Who is asking
// ---------------------------------------------------------------------

/**
 * The signed in person's role, read from the database rather than from
 * anything the browser holds.
 *
 * A TOKEN SAYS WHO SOMEBODY IS, NOT WHAT THEY MAY DO. The role could be
 * put in the session and read from there, and it would be faster and
 * wrong: a token is minted when somebody signs in and keeps saying what
 * it said for an hour. Somebody removed from the staff list at 10:00
 * would still be holding an administrator's token at 10:30.
 *
 * So the role is asked for. Every page that matters also has its answer
 * checked again in the database when it acts, so this is for drawing
 * the right menu rather than for deciding anything.
 */
export async function getMyRole(): Promise<Role> {
  if (!certDb) return "learner";
  const { data, error } = await certDb.rpc("lms_my_role");
  if (error || !data) return "learner";
  return data as Role;
}

// ---------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------

export function getOverview() {
  return call<StudioOverview>("lms_studio_overview");
}

// ---------------------------------------------------------------------
// Courses and the builder
// ---------------------------------------------------------------------

export type PublishCheck = {
  n: number;
  label: string;
  passes: boolean;
  detail: string;
  fix_tab: string;
  fix_id: string | null;
};

export function createCourse(title: string, area: string, tool: string, level = "Beginner") {
  return call<string>("lms_create_course", {
    p_title: title,
    p_area: area,
    p_tool: tool,
    p_level: level,
  });
}

export function getPublishChecks(course: string) {
  return call<PublishCheck[]>("lms_publish_checks", { p_course: course });
}

export function sendForReview(course: string, note: string) {
  return call<null>("lms_send_for_review", { p_course: course, p_note: note });
}

export function sendBack(course: string, note: string) {
  return call<null>("lms_send_back", { p_course: course, p_note: note });
}

/** Returns (published, message) from the database, both shown as they are. */
export async function publishCourse(course: string): Promise<Answer<string>> {
  const got = await call<{ published: boolean; message: string }[]>("lms_publish_course", {
    p_course: course,
  });
  if (!got.ok) return got;
  const row = got.data?.[0];
  if (!row) return { ok: false, message: "The database said nothing at all." };
  return row.published ? { ok: true, data: row.message } : { ok: false, message: row.message };
}

export async function unpublishCourse(course: string, reason: string): Promise<Answer<string>> {
  const got = await call<{ published: boolean; message: string }[]>("lms_unpublish_course", {
    p_course: course,
    p_reason: reason,
  });
  if (!got.ok) return got;
  return { ok: true, data: got.data?.[0]?.message || "Taken down." };
}

/**
 * Archive a course, with a reason.
 *
 * THE REASON IS NOT OPTIONAL, and it is not this file that insists: file
 * 22 refuses without one, so the log always says why a course went out
 * of sight. The call used to take the course alone and the database
 * logged an empty detail.
 *
 * It also refuses a live course. Taking it down is a separate decision
 * with its own blockers, and a learner part way through should not have
 * a course disappear underneath them.
 *
 * NEVER A DELETE, either way round. Somebody may hold a certificate.
 */
export async function archiveCourse(course: string, reason: string) {
  const got = await call<null>("lms_archive_course", {
    p_course: course,
    p_reason: reason,
  });
  if (!got.ok) return got;
  return { ok: true as const, data: "Archived." };
}

/** Bring an archived course back. It returns as a DRAFT, never as live. */
export async function restoreCourse(course: string, reason: string) {
  const got = await call<null>("lms_restore_course", {
    p_course: course,
    p_reason: reason,
  });
  if (!got.ok) return got;
  return { ok: true as const, data: "Back as a draft." };
}

export type CourseDetails = {
  p_course: string;
  p_title?: string;
  p_summary?: string;
  p_level?: string;
  p_tool?: string;
  p_outcomes?: string[];
  p_audience?: string[];
  p_prerequisites?: string[];
  p_faq?: { q: string; a: string }[];
  p_cover_url?: string;
};

export function setCourseDetails(d: CourseDetails) {
  return call<null>("lms_set_course_details", d as Record<string, unknown>);
}

export function setCoursePrice(course: string, kobo: number, firstModuleFree?: boolean) {
  return call<null>("lms_set_course_price", {
    p_course: course,
    p_price_kobo: kobo,
    p_first_module_free: firstModuleFree ?? null,
  });
}

export function setCourseAreas(course: string, areas: string[]) {
  return call<null>("lms_set_course_areas", { p_course: course, p_areas: areas });
}

export function setCourseNext(course: string, next: string[]) {
  return call<null>("lms_set_course_next", { p_course: course, p_next: next });
}

// ---------------------------------------------------------------------
// Question banks
// ---------------------------------------------------------------------

export type PasteOutcome = { row_no: number; outcome: "added" | "skipped"; detail: string };

export function saveQuestion(args: {
  quiz: string;
  question?: string | null;
  prompt?: string;
  explanation?: string;
  options?: { label: string; is_correct: boolean }[];
  lesson?: string | null;
  chapterStart?: number | null;
}) {
  return call<string>("lms_save_question", {
    p_quiz: args.quiz,
    p_question: args.question ?? null,
    p_prompt: args.prompt ?? null,
    p_explanation: args.explanation ?? null,
    p_options: args.options ?? null,
    p_lesson: args.lesson ?? null,
    p_chapter_start: args.chapterStart ?? null,
  });
}

export function retireQuestion(question: string) {
  return call<null>("lms_retire_question", { p_question: question });
}

/**
 * Paste a sheet. Comes back one row per row, saying added or skipped
 * and why, which is what the page lists back.
 */
export function pasteQuestions(quiz: string, rows: Record<string, string>[]) {
  return call<PasteOutcome[]>("lms_paste_questions", { p_quiz: quiz, p_rows: rows });
}

export function publishLessonCheck(quiz: string) {
  return call<string>("lms_publish_lesson_check", { p_quiz: quiz });
}

// ---------------------------------------------------------------------
// Learners.  Administrators only, every one of them.
// ---------------------------------------------------------------------

export type StudioLearner = {
  user_id: string;
  full_name: string;
  email: string;
  joined: string;
  course_count: number;
  furthest_course: string | null;
  furthest_percent: number | null;
  last_active: string | null;
  access_source: string | null;
  certificates: number;
  state: string;
};

export function getLearners(args: {
  search?: string;
  filter?: string;
  access?: string | null;
  limit?: number;
}) {
  return call<StudioLearner[]>("lms_staff_learners", {
    p_search: args.search ?? "",
    p_filter: args.filter ?? "all",
    p_access: args.access ?? null,
    p_limit: args.limit ?? 100,
  });
}

export type LearnerRecord = {
  full_name: string;
  email: string;
  country: string | null;
  state: string | null;
  region: string | null;
  city: string | null;
  age_band: string | null;
  gender: string | null;
  education_level: string | null;
  occupation: string | null;
  disability: string | null;
  disability_detail: string | null;
  heard_from: string | null;
  goals: string[] | null;
  consented_at: string | null;
};

/**
 * One learner's record. EVERY OPEN OF THIS IS LOGGED by the database,
 * which is file 16's rule and is why this calls file 16's function
 * rather than reading the table.
 */
export async function getLearnerRecord(user: string): Promise<Answer<LearnerRecord>> {
  const got = await call<LearnerRecord[]>("lms_learner_record", { p_user: user });
  if (!got.ok) return got;
  const row = got.data?.[0];
  if (!row) return { ok: false, message: "That learner has not filled in the About you form." };
  return { ok: true, data: row };
}

export function liftExamWait(user: string, exam: string) {
  return call<null>("lms_lift_exam_wait", { p_user: user, p_exam: exam });
}

export function giveAccess(args: {
  user: string;
  course: string;
  reason: string;
  source?: string;
  until?: string | null;
}) {
  return call<null>("lms_give_access", {
    p_user: args.user,
    p_course: args.course,
    p_reason: args.reason,
    p_source: args.source ?? "manual",
    p_until: args.until ?? null,
  });
}

export function removeAccess(user: string, course: string, reason: string) {
  return call<null>("lms_remove_access", { p_user: user, p_course: course, p_reason: reason });
}

// ---------------------------------------------------------------------
// Paths, areas and tools
// ---------------------------------------------------------------------

export function createPath(name: string, certificateName: string) {
  return call<string>("lms_create_path", {
    p_name: name,
    p_certificate_name: certificateName,
  });
}

export function setPathCourses(path: string, courses: string[]) {
  return call<null>("lms_set_path_courses", { p_path: path, p_courses: courses });
}

export function setPathDetails(args: {
  path: string;
  name?: string;
  description?: string;
  certificateName?: string;
}) {
  return call<null>("lms_set_path_details", {
    p_path: args.path,
    p_name: args.name ?? null,
    p_description: args.description ?? null,
    p_certificate_name: args.certificateName ?? null,
  });
}

export type AreaOverview = {
  area_id: string;
  slug: string;
  name: string;
  icon_key: string;
  shown_at: number;
  tool_count: number;
  course_count: number;
  published_count: number;
  tools: { id: string; name: string; course: string | null }[];
};

export function getAreas() {
  return call<AreaOverview[]>("lms_areas_overview");
}

export function addAreaTool(area: string, tool: string) {
  return call<string>("lms_add_area_tool", { p_area: area, p_tool: tool });
}

export function removeAreaTool(tool: string) {
  return call<null>("lms_remove_area_tool", { p_tool: tool });
}

// ---------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------

export type ActiveDay = { day: string; learners: number };
export type FunnelStage = { stage: string; learners: number; share: number };
export type LessonDrop = {
  shown_at: number;
  lesson_id: string;
  title: string;
  finished: number;
  share: number;
};
export type HardQuestion = {
  question_id: string;
  prompt: string;
  where_it_is: string;
  answered: number;
  right_share: number;
};

export function getActiveDays(days: 7 | 30 | 90) {
  return call<ActiveDay[]>("lms_report_active_days", { p_days: days });
}

export function getFunnel(course: string) {
  return call<FunnelStage[]>("lms_report_funnel", { p_course: course });
}

export function getLessonDrop(course: string) {
  return call<LessonDrop[]>("lms_report_lesson_drop", { p_course: course });
}

export function getHardQuestions(course: string | null, limit = 10) {
  return call<HardQuestion[]>("lms_report_hard_questions", {
    p_course: course,
    p_limit: limit,
  });
}

/**
 * One breakdown of "Who our learners are". Administrators only, every
 * read logged, totals only, and any group under 5 comes back as the
 * words "fewer than 5" rather than a number.
 *
 * total IS A STRING, not a number, and that is the whole point. The
 * suppression happens in the database, so there is no number here to
 * leak by accident and nothing in this file has to remember the rule.
 */
export function getWhoTotals(field: string) {
  return call<{ value: string; total: string }[]>("lms_report_who", { p_field: field });
}

export function logExport(file: string, rows?: number) {
  return call<null>("lms_log_export", { p_file: file, p_rows: rows ?? null });
}

// ---------------------------------------------------------------------
// Certificates, popups, settings, health, staff
// ---------------------------------------------------------------------

export type StudioCertificate = {
  certificate_number: string;
  full_name: string;
  programme: string;
  issued_on: string | null;
  revoked: boolean;
};

export function getCertificates(search: string, limit = 50) {
  return call<StudioCertificate[]>("lms_studio_certificates", {
    p_search: search,
    p_limit: limit,
  });
}

export async function getCertificateCounts() {
  const got = await call<{ all_time: number; this_month: number; revoked: number }[]>(
    "lms_studio_certificate_counts",
  );
  if (!got.ok) return got;
  return { ok: true as const, data: got.data?.[0] || { all_time: 0, this_month: 0, revoked: 0 } };
}

export type StudioPopup = {
  id: string;
  heading: string;
  message: string;
  button_text: string;
  course_id: string | null;
  path_id: string | null;
  url: string | null;
  picture: string;
  picture_url: string | null;
  audience: string;
  place: string;
  how_often: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
};

export function savePopup(p: Partial<StudioPopup> & { id?: string | null }) {
  return call<string>("lms_save_popup", {
    p_popup: p.id ?? null,
    p_heading: p.heading ?? null,
    p_message: p.message ?? null,
    p_button_text: p.button_text ?? null,
    p_course: p.course_id ?? null,
    p_path: p.path_id ?? null,
    p_url: p.url ?? null,
    p_picture: p.picture ?? null,
    p_picture_url: p.picture_url ?? null,
    p_audience: p.audience ?? null,
    p_place: p.place ?? null,
    p_how_often: p.how_often ?? null,
    p_starts_at: p.starts_at ?? null,
    p_ends_at: p.ends_at ?? null,
  });
}

export function startPopup(id: string) {
  return call<null>("lms_start_popup", { p_popup: id });
}

export function stopPopup(id: string) {
  return call<null>("lms_stop_popup", { p_popup: id });
}

export function setSiteSettings(s: {
  headline?: string;
  subhead?: string;
  announceOn?: boolean;
  announceText?: string;
  welcomeProvider?: string;
  welcomeRef?: string;
  welcomeSeconds?: number;
}) {
  return call<null>("lms_set_site_settings", {
    p_headline: s.headline ?? null,
    p_subhead: s.subhead ?? null,
    p_announce_on: s.announceOn ?? null,
    p_announce_text: s.announceText ?? null,
    p_welcome_provider: s.welcomeProvider ?? null,
    p_welcome_ref: s.welcomeRef ?? null,
    p_welcome_seconds: s.welcomeSeconds ?? null,
  });
}

export type HealthRow = { item: string; severity: string; value: string; detail: string };
export type TableSize = { table_name: string; bytes: number; pretty: string; rows_estimate: number };

export function getHealth() {
  return call<HealthRow[]>("lms_studio_health");
}

export function getBiggestTables(limit = 10) {
  return call<TableSize[]>("lms_studio_biggest_tables", { p_limit: limit });
}

export type LogRow = {
  at: string;
  actor: string;
  action: string;
  subject_type: string | null;
  subject_id: string | null;
  subject: string | null;
  detail: Record<string, unknown>;
};

export function getActivityLog(action: string | null, limit = 50) {
  return call<LogRow[]>("lms_activity_log", { p_action: action, p_limit: limit });
}

export type StaffRow = {
  email: string;
  full_name: string;
  note: string;
  has_account: boolean;
  role: string;
  course_count: number;
  added_at: string;
};

export function getStaff() {
  return call<StaffRow[]>("lms_studio_staff");
}

export async function addFacilitator(email: string, name: string, note: string) {
  const got = await call<{ ok: boolean; message: string }[]>("lms_add_facilitator", {
    p_email: email,
    p_name: name,
    p_note: note,
  });
  if (!got.ok) return got;
  const row = got.data?.[0];
  if (!row) return { ok: false as const, message: "The database said nothing at all." };
  return row.ok
    ? { ok: true as const, data: row.message }
    : { ok: false as const, message: row.message };
}

export async function removeFacilitator(email: string) {
  const got = await call<{ ok: boolean; message: string }[]>("lms_remove_facilitator", {
    p_email: email,
  });
  if (!got.ok) return got;
  const row = got.data?.[0];
  return row && row.ok
    ? { ok: true as const, data: row.message }
    : { ok: false as const, message: row?.message || "That did not work." };
}

export function setStaffRole(user: string, role: Role) {
  return call<null>("lms_set_staff_role", { p_user: user, p_role: role });
}

// ---------------------------------------------------------------------
// Small shared shapes
// ---------------------------------------------------------------------

/** Kobo to naira, for showing. 500000 kobo reads as "NGN 5,000". */
export function asMoney(kobo: number | null | undefined): string {
  if (!kobo) return "Free";
  return "NGN " + Math.round(kobo / 100).toLocaleString("en-NG");
}

/** "Today, 09:12", "Yesterday", "3 Oct". How the mockup writes a time. */
export function asWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// --------------------------------------- joining a certification record

export type ParticipantHit = {
  id: string;
  full_name: string;
  email: string;
  linked: boolean;
};

/**
 * Look up a certification record by name or address.
 *
 * ADMINISTRATORS ONLY, and the database says so as well as this. It
 * searches the certification register, which is a list of real people
 * and their email addresses, and a facilitator sees no learner names at
 * all. Three characters minimum, twenty results: a one letter search
 * would return most of the register.
 */
export function findParticipants(query: string) {
  return call<ParticipantHit[]>("lms_find_participants", { p_query: query });
}

/**
 * Join an Academy account to a certification record by hand.
 *
 * The automatic link matches on email address and only once that
 * address is proven. This is the case that rule cannot cover: the
 * address on the certificate is not the one they signed up with. Rare,
 * and when it happens a person looks at it rather than the system
 * guessing.
 */
export function linkCertificationRecord(input: {
  user: string;
  participant: string;
  reason: string;
}) {
  return call<{ ok: boolean; message: string }>("lms_link_certification_record", {
    p_user: input.user,
    p_participant: input.participant,
    p_reason: input.reason,
  });
}
