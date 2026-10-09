import { certDb } from "./certificates";

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

/** The two letters on a course's tile, from the database or the title. */
export function coverCode(course: {
  cover_code?: string | null;
  title?: string;
}): string {
  const given = (course.cover_code || "").trim();
  if (given) return given.slice(0, 2).toUpperCase();
  return (course.title || "??").slice(0, 2).toUpperCase();
}

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
