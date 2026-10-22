import { certDb } from "./certificates";
import type { ExamState } from "./learn";

// Everything the three public Academy pages ask of Supabase.
//
// Two calls, and that is the whole list: lms_public_catalogue and
// lms_public_course, both added in database file 14. The edge function
// in api/academy-meta.js calls the same two, so what a search engine
// reads and what a person reads are built from one source and cannot
// drift apart.
//
// WHAT IS DELIBERATELY NOT HERE. Nothing selects from lms_lessons. After
// file 14 the video reference and the lesson body are not readable
// through the table at all, by anybody, and no client code may use
// select('*') on it. A lesson's video arrives in Phase 4 through
// lms_open_lesson, which checks first.

export type CourseCard = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  tool: string;
  area: string;
  level: string;
  cover_code: string;
  price_kobo: number;
  first_module_free: boolean;
  published_at: string | null;
  updated_at: string | null;
  module_count: number;
  lesson_count: number;
  quiz_count: number;
  total_seconds: number;
};

export type CourseLesson = {
  position: number;
  title: string;
  type: string;
  seconds: number | null;
};

export type CourseModule = {
  position: number;
  title: string;
  summary: string | null;
  seconds: number;
  lessons: number;
  quizzes: number;
  free: boolean;
  lesson_list: CourseLesson[];
};

export type CourseFaq = { question: string; answer: string };

export type FullCourse = CourseCard & {
  outcomes: string[];
  audience: string[];
  prerequisites: string[];
  faq: CourseFaq[];
  seo_title: string | null;
  seo_description: string | null;
  modules: CourseModule[];
};

export type Settings = {
  headline: string;
  subhead: string;
  announce_on: boolean;
  announce_text: string;
};

export type PathCourse = { slug: string; title: string; summary: string; cover_code: string };
export type LearningPath = {
  id: string;
  slug: string;
  name: string;
  description: string;
  courses: PathCourse[];
};

/** Every published course. ok is false when we could not ask at all. */
export async function getCatalogue(): Promise<{ ok: boolean; courses: CourseCard[] }> {
  if (!certDb) return { ok: false, courses: [] };
  try {
    const { data, error } = await certDb.rpc("lms_public_catalogue");
    if (error) return { ok: false, courses: [] };
    return { ok: true, courses: Array.isArray(data) ? (data as CourseCard[]) : [] };
  } catch {
    return { ok: false, courses: [] };
  }
}

// ---------------------------------------------------- the landing page
//
// ONE CALL FOR THE WHOLE PAGE. The landing page needs the seven areas
// with their tools, the first published path with its courses, and the
// two short lists. Before file 16 that was five round trips, each of
// which could be the one that is slow, and the page could not draw its
// hero until the slowest of them came back.
//
// lms_public_landing returns the lot as one jsonb object. It is a
// security definer function, so a signed out visitor gets exactly these
// columns and no table is readable behind it.

export type AreaTool = {
  name: string;
  /** The published course for this tool in this area, or null. */
  course: {
    slug: string;
    title: string;
    cover_code: string | null;
    kind: string | null;
    level: string | null;
    price_kobo: number | null;
    lesson_count: number;
    total_seconds: number;
  } | null;
};

export type LandingArea = {
  slug: string;
  name: string;
  icon_key: string;
  course_count: number;
  tools: AreaTool[];
};

export type LandingPath = {
  slug: string;
  name: string;
  description: string | null;
  course_count: number;
  total_seconds: number;
  courses: { slug: string; title: string; summary: string; cover_code: string; tool: string; area: string }[];
};

export type Landing = {
  areas: LandingArea[];
  path: LandingPath | null;
  free: CourseCard[];
  short: CourseCard[];
};

const EMPTY_LANDING: Landing = { areas: [], path: null, free: [], short: [] };

/**
 * Everything the landing page draws, in one call.
 *
 * An empty answer is the normal state before file 16 has been run, and
 * every part of the page that uses it hides itself rather than showing
 * an empty heading. So a preview of this branch against a database that
 * has not had file 16 yet looks like the page before this round rather
 * than like a broken page.
 */
export async function getLanding(): Promise<{ ok: boolean; landing: Landing }> {
  if (!certDb) return { ok: false, landing: EMPTY_LANDING };
  try {
    const { data, error } = await certDb.rpc("lms_public_landing");
    if (error || !data || typeof data !== "object") {
      return { ok: false, landing: EMPTY_LANDING };
    }
    const d = data as Partial<Landing>;
    return {
      ok: true,
      landing: {
        areas: Array.isArray(d.areas) ? d.areas : [],
        path: d.path || null,
        free: Array.isArray(d.free) ? d.free : [],
        short: Array.isArray(d.short) ? d.short : [],
      },
    };
  } catch {
    return { ok: false, landing: EMPTY_LANDING };
  }
}

/**
 * The landing page's words.
 *
 * Read from lms_settings so the Phase 6 control room can edit them.
 * null means we could not ask, and the page falls back to the same
 * words the edge function falls back to.
 */
export async function getSettings(): Promise<Settings | null> {
  if (!certDb) return null;
  try {
    const { data, error } = await certDb
      .from("lms_settings")
      .select("headline,subhead,announce_on,announce_text")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return null;
    return data as Settings;
  } catch {
    return null;
  }
}

/**
 * Published learning paths, each with its published courses in order.
 *
 * An empty list is the normal state for a while, and the section hides
 * itself rather than showing an empty heading.
 */
export async function getPaths(): Promise<LearningPath[]> {
  if (!certDb) return [];
  try {
    const { data, error } = await certDb
      .from("lms_paths")
      .select(
        "id,slug,name,description,position," +
          "lms_path_courses(position,lms_courses(slug,title,summary,cover_code,status))",
      )
      .eq("status", "published")
      .order("position", { ascending: true });
    if (error || !Array.isArray(data)) return [];

    type Row = {
      id: string;
      slug: string;
      name: string;
      description: string;
      lms_path_courses?: {
        position: number;
        lms_courses?: {
          slug: string;
          title: string;
          summary: string;
          cover_code: string;
          status: string;
        } | null;
      }[];
    };

    return (data as unknown as Row[])
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        courses: (p.lms_path_courses || [])
          .slice()
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          // A path can hold a course that has since been unpublished.
          // Showing it would be a link to a page that is not there.
          .filter((pc) => pc.lms_courses && pc.lms_courses.status === "published")
          .map((pc) => ({
            slug: pc.lms_courses!.slug,
            title: pc.lms_courses!.title,
            summary: pc.lms_courses!.summary,
            cover_code: pc.lms_courses!.cover_code,
          })),
      }))
      .filter((p) => p.courses.length > 0);
  } catch {
    return [];
  }
}

/**
 * Does the signed in person already have this course?
 *
 * The database decides, through lms_has_course_access, which checks an
 * entitlement. The page must never work it out for itself: a free
 * course, a free first module and a bootcamp enrolment are three
 * different rules and all of them live on the server.
 *
 * false for anybody not signed in, and false when we could not ask,
 * because the safe wrong answer is "you do not have it yet".
 */
// ------------------------------------------------------- one path ---

export type PathCourseState = {
  position: number;
  slug: string;
  title: string;
  summary: string;
  cover_code: string | null;
  tool: string | null;
  area: string | null;
  lesson_count: number;
  total_seconds: number;
  /** Set once the learner holds this course's certificate. */
  certificate_number: string | null;
  percent: number;
  /** Another published path this course is in, named only when it is done. */
  also_in: string | null;
};

/**
 * A path's exam, which is the SAME shape a course exam is.
 *
 * lms_my_path fills it with to_jsonb(lms_exam_status(...)), the very
 * function the course page reads, so every field is present and the
 * optional markers this type used to carry were describing the type
 * rather than the data. Saying so lets the exam page sit a path exam
 * with the machinery that already sits a course one, instead of a
 * second copy of it.
 */
export type PathExam = ExamState | null;

export type MyPath = {
  slug: string;
  name: string;
  description: string | null;
  certificate_name: string;
  course_count: number;
  total_seconds: number;
  courses: PathCourseState[];
  exam: PathExam;
};

/**
 * One learning path, with whatever the signed in learner has done to it.
 *
 * A SIGNED OUT VISITOR GETS THE SAME PAGE WITH NOTHING TICKED. The
 * function does not refuse them: a path is a public thing, and what you
 * have done to it is not, so every per learner field simply comes back
 * empty.
 *
 * null means there is no published path with that slug, which the page
 * shows as a not found rather than as an error.
 */
export async function getMyPath(slug: string): Promise<MyPath | null> {
  if (!certDb) return null;
  try {
    const { data, error } = await certDb.rpc("lms_my_path", { p_slug: slug });
    if (error || !data || typeof data !== "object") return null;
    return data as MyPath;
  } catch {
    return null;
  }
}

// -------------------------------------------------------- the popup ---

export type LivePopup = {
  id: string;
  heading: string;
  message: string;
  button_text: string;
  course_slug: string | null;
  path_slug: string | null;
  url: string | null;
  picture: string | null;
  picture_url: string | null;
  how_often: string;
};

/**
 * The one popup for this place, if there is one.
 *
 * WHICH PLACES ARE ALLOWED IS THE DATABASE'S ANSWER, not this
 * function's: lms_live_popup returns nothing for anything that is not
 * the landing page, the catalogue, a course page or My learning. A
 * lesson, a check or an exam gets nothing, quietly.
 *
 * At most one row ever comes back, so there is no queue and no
 * stacking: which one it is was decided in the control room.
 */
export async function getLivePopup(place: string): Promise<LivePopup | null> {
  if (!certDb) return null;
  try {
    const { data, error } = await certDb.rpc("lms_live_popup", { p_place: place });
    const rows = Array.isArray(data) ? data : [];
    if (error || rows.length === 0) return null;
    return rows[0] as LivePopup;
  } catch {
    return null;
  }
}

/**
 * Write down that somebody saw it, so "once per person" means once.
 *
 * Best effort. If it fails the worst that happens is somebody sees the
 * same popup again, which is a far smaller problem than a page that
 * will not draw because a popup could not be recorded.
 */
export async function popupShown(popupId: string): Promise<void> {
  if (!certDb || !popupId) return;
  try {
    await certDb.rpc("lms_popup_shown", { p_popup: popupId });
  } catch {
    // nothing to do, and nothing worth saying
  }
}

export async function hasCourseAccess(courseId: string): Promise<boolean> {
  if (!certDb || !courseId) return false;
  try {
    const { data, error } = await certDb.rpc("lms_has_course_access", {
      p_course: courseId,
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * One published course.
 *
 * Three answers, and the page shows something different for each:
 *   a course   it exists and is published
 *   "missing"  Supabase answered: it is a draft, or no such slug
 *   null       we could not ask. "Try again", not "does not exist"
 *
 * The difference between the last two is the whole reason this returns
 * three things rather than two. Telling somebody a course does not
 * exist when the truth is that we could not reach the database sends
 * them away for good, and on the search engine side it is worse still:
 * see the note in api/academy-meta.js.
 */
export async function getCourse(
  slug: string,
): Promise<FullCourse | "missing" | null> {
  if (!certDb) return null;
  try {
    const { data, error } = await certDb.rpc("lms_public_course", {
      p_slug: slug,
    });
    if (error) return null;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return "missing";
    return rows[0] as FullCourse;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ wording

/** 5760 becomes "1h 36m". The same shape the edge function writes. */
export function asLength(seconds: number | null | undefined): string {
  const n = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.round((n % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Seconds to "06:20", for a lesson in a list. */
export function asClock(seconds: number | null | undefined): string {
  const n = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** A price, in words a Nigerian reader expects. */
export function asPrice(kobo: number | null | undefined): string {
  const n = Number(kobo) || 0;
  if (n <= 0) return "Free";
  return `₦${Math.round(n / 100).toLocaleString("en-NG")}`;
}

/* coverCode was here. It moved to api/_cover-art.js, which draws every
   course cover and needs the same two letters: having the rule in two
   files meant two places to change it and one of them would eventually
   be missed. The edge function that makes the share picture cannot
   import from here, so the single copy lives there, where both the
   pages and that function can reach it. */

/**
 * The areas to offer as filters: the ones that actually have a course.
 *
 * Never a hard coded list. A filter for an area with nothing in it is a
 * dead end, and an area added later would otherwise be missing from the
 * page until somebody remembered to add it here.
 */
export function areasOf(courses: CourseCard[]): string[] {
  const seen = new Set<string>();
  for (const c of courses) {
    const a = (c.area || "").trim();
    if (a) seen.add(a);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** The same, for tools. Used by the tool rack on the landing page. */
export function toolsOf(courses: CourseCard[]): string[] {
  const seen = new Set<string>();
  for (const c of courses) {
    const t = (c.tool || "").trim();
    if (t) seen.add(t);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Matches a course against what somebody typed. Title, summary or tool. */
export function matches(course: CourseCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    course.title.toLowerCase().includes(q) ||
    (course.summary || "").toLowerCase().includes(q) ||
    (course.tool || "").toLowerCase().includes(q) ||
    (course.area || "").toLowerCase().includes(q)
  );
}

export type SortOrder = "newest" | "shortest" | "title";

export function sortCourses(courses: CourseCard[], order: SortOrder): CourseCard[] {
  const copy = courses.slice();
  if (order === "shortest") {
    copy.sort((a, b) => (a.total_seconds || 0) - (b.total_seconds || 0));
  } else if (order === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    copy.sort((a, b) => {
      const at = a.published_at ? Date.parse(a.published_at) : 0;
      const bt = b.published_at ? Date.parse(b.published_at) : 0;
      return bt - at;
    });
  }
  return copy;
}
