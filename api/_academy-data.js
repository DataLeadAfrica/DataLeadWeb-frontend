// Shared by api/academy-meta.js and api/sitemap.js.
//
// Vercel does not route a file whose name begins with an underscore, so
// this is a module rather than an endpoint.
//
// Everything here is written so it can be imported and tested in plain
// Node with a stubbed global fetch. That is the only way to prove the
// five cases the edge function has to survive: a normal course, a draft
// one, an unknown slug, Supabase being slow, and Supabase being down.

// The same public key the website's own JavaScript uses. Not a secret:
// it is in the client bundle already, and row security is what protects
// the data. See docs/lms/SEO.md.
export const SUPABASE_URL = "https://zndjhvcqrgusorflnkxd.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZGpodmNxcmd1c29yZmxua3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTI3NTEsImV4cCI6MjEwMDM4ODc1MX0.jgl7vnGsqWcN7TYplyyPOYlo2v_jlaA1SYhCqb0Qh9U";

// How long we will wait for Supabase before giving up and serving the
// ordinary page. A crawler that waits is a crawler that scores the site
// as slow, and a visitor who waits just leaves. Serving the plain app is
// a worse page, and a worse page beats a blank one.
export const SUPABASE_TIMEOUT_MS = 1500;

// The title and description rules live in one file that the React page
// imports too, so the two cannot drift apart. See api/_seo-rules.js.
export {
  SITE_ORIGIN,
  siteUrl,
  siteAsset,
  MAX_TITLE,
  MAX_DESCRIPTION,
  clip,
  asLength,
  courseTitle,
  courseDescription,
  landingWords,
  plural,
  LANDING,
  CATALOGUE,
  NOT_FOUND,
} from "./_seo-rules.js";

/** HTML escaping, for anything that came out of the database. */
export function esc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}



/** 1000000 kobo becomes "10,000". Naira, with the sign added by the caller. */
export function asNaira(kobo) {
  const naira = Math.round((Number(kobo) || 0) / 100);
  return naira.toLocaleString("en-NG");
}

/**
 * Call one of the public Academy functions.
 *
 * Returns { ok, data }. ok is false for EVERY kind of failure: no
 * network, a bad status, a timeout, anything thrown.
 *
 * WHY THIS SHAPE, AND WHY IT MATTERS MORE THAN IT LOOKS.
 *
 * This used to return null for both "Supabase said there is no such
 * course" and "Supabase did not answer". The course page then treated
 * null as not found and replied 404 with noindex. So any moment
 * Supabase was slow, down, or paused, EVERY course page told Google the
 * course did not exist.
 *
 * The free Supabase plan pauses a project after a week without
 * traffic. One quiet week would have had Google drop every course from
 * its index, and getting back in takes far longer than getting dropped.
 *
 * An empty answer and a failed call are completely different facts and
 * the caller has to be able to tell them apart. That is the whole
 * reason for the object.
 */
export async function callRpc(name, body, { timeoutMs = SUPABASE_TIMEOUT_MS, fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await doFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    if (!res || !res.ok) return { ok: false, data: null };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Read a table through PostgREST. Same { ok, data } contract. */
export async function callRest(path, { timeoutMs = SUPABASE_TIMEOUT_MS, fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await doFetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      signal: controller.signal,
    });
    if (!res || !res.ok) return { ok: false, data: null };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
  }
}

/** { ok, courses }. courses is [] only when Supabase really said so. */
export async function getCatalogue(options) {
  const r = await callRpc("lms_public_catalogue", {}, options);
  if (!r.ok) return { ok: false, courses: [] };
  return { ok: true, courses: Array.isArray(r.data) ? r.data : [] };
}

/**
 * { ok, course }.
 *
 *   ok: true,  course: {...}   published, here it is
 *   ok: true,  course: null    Supabase answered: no such published course
 *   ok: false, course: null    we could not ask
 *
 * Only the middle one is a 404.
 */
export async function getCourse(slug, options) {
  const r = await callRpc("lms_public_course", { p_slug: slug }, options);
  if (!r.ok) return { ok: false, course: null };
  const rows = Array.isArray(r.data) ? r.data : [];
  return { ok: true, course: rows.length > 0 ? rows[0] || null : null };
}

/**
 * The landing page's words, from lms_settings.
 *
 * { ok, settings }. The page and the edge function both fall back to
 * the same written out defaults when this fails, so a Supabase hiccup
 * costs the landing page nothing.
 */
export async function getSettings(options) {
  const r = await callRest(
    "lms_settings?id=eq.1&select=headline,subhead,announce_on,announce_text",
    options,
  );
  if (!r.ok) return { ok: false, settings: null };
  const rows = Array.isArray(r.data) ? r.data : [];
  return { ok: true, settings: rows[0] || null };
}

/**
 * Published learning paths, with the courses in each, in order.
 *
 * { ok, paths }. An empty list is a real answer: the section is hidden
 * when there are none, which is most of the time to begin with.
 */
export async function getPaths(options) {
  const r = await callRest(
    "lms_paths?status=eq.published" +
      "&select=id,slug,name,description,position," +
      "lms_path_courses(position,lms_courses(slug,title,summary,cover_code,status))" +
      "&order=position.asc",
    options,
  );
  if (!r.ok) return { ok: false, paths: [] };
  return { ok: true, paths: Array.isArray(r.data) ? r.data : [] };
}
