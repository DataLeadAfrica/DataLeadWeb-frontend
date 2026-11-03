import { certDb } from "./certificates";

// Everything the attendance screens ask of Supabase, and the first
// sign-in screen with them.
//
// EVERY ONE OF THESE IS A FUNCTION CALL. Not one of the five tables
// database file 28 makes is writable from a browser, and two of them are
// not readable either, so there is no table read in this file to write
// even if somebody wanted one. The rules live in the database and a page
// that reached past them would be a page that could be wrong about them.
//
// THE ONE EXCEPTION IS THE PHONE NUMBER, and it is marked where it
// happens. File 18 narrowed the browser's privileges on lms_profiles to
// UPDATE on two columns, full_name and phone, and there is no function
// for the phone. So the phone is read and written directly, on those two
// granted columns, and nothing else on that table can be touched.
//
// WHAT HAPPENS WHEN THE DATABASE REFUSES. File 28 raises with messages
// written for a person: "You have not been marked present today, so the
// form is locked." Those are shown as they are. The database knows why
// it refused and a page does not, and rewording them here would mean two
// places claiming to say what the rule is.
//
// NOTHING IS CACHED. A facilitator reveals a code and then looks to see
// whether it is live. A cache here would be a screen that lies about the
// thing somebody just did.

/** What the database said, or what went wrong, in words a person can read. */
export type Answer<T> = { ok: true; data: T } | { ok: false; message: string };

function failed(error: unknown): { ok: false; message: string } {
  const e = error as { message?: string } | null;
  const raw = (e && e.message) || "";
  const clean = raw.replace(/^.*?(?:ERROR:\s*)?/, "").trim();

  // A CONNECTION THAT NEVER REACHED THE DATABASE IS NOT A REFUSAL, and
  // it must not read like one. The browser's own words for it are
  // "Failed to fetch" and "NetworkError", which tell somebody standing
  // in a classroom with one bar of signal nothing they can act on. Every
  // other message here is the database's own wording and is passed
  // through untouched, because it was written for a person.
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(clean)) {
    return {
      ok: false,
      message: "We could not reach the Academy just now. Check your connection and try again.",
    };
  }

  return {
    ok: false,
    message:
      clean || "That did not work. Try again, and tell somebody if it keeps happening.",
  };
}

async function call<T>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<Answer<T>> {
  if (!certDb) {
    return { ok: false, message: "The Academy database is not reachable from here." };
  }
  try {
    const { data, error } = await certDb.rpc(fn, args);
    if (error) return failed(error);
    return { ok: true, data: data as T };
  } catch (thrown) {
    // A dropped connection rather than a refusal. The queue in the
    // scanner depends on being able to tell the two apart, so this
    // catch exists rather than letting the throw escape.
    return failed(thrown);
  }
}

// ---------------------------------------------------------------------
// The first sign-in screen
// ---------------------------------------------------------------------

/**
 * The five answers the screen collects, as lms_learner_setup holds them.
 *
 * THERE IS NO NAME IN HERE, and that is the name rule rather than an
 * omission. lms_learner_setup has no name column, no write permission
 * and no name parameter on its save function, so the screen has nowhere
 * to write a name to. A disabled text box is a box somebody can
 * re-enable in their own browser. This is not.
 */
export type MySetupAnswers = {
  preferred_name: string | null;
  device: "laptop" | "phone" | string | null;
  internet: "reliable" | "sometimes" | "poor" | string | null;
  topic_experience: "none" | "some" | "confident" | string | null;
  goal_note: string | null;
  completed_at: string | null;
};

/**
 * The six things the sign-up page already asked, shown back read only.
 *
 * READ HERE RATHER THAN IN THE BROWSER, because they live on
 * lms_learner_profiles, which also holds the disability answer, and file
 * 26 took the browser's SELECT on that table away entirely. The only way
 * in is one administrator function that writes an audit line every time
 * it is used, and showing somebody their own age band should not do that.
 * So lms_my_setup selects these seven columns server side and hands back
 * nothing else.
 */
export type AlreadyToldUs = {
  age_band: string | null;
  gender: string | null;
  state: string | null;
  country: string | null;
  education_level: string | null;
  occupation: string | null;
  heard_from: string | null;
};

export type MySetup = {
  /** True once the five answers have been saved at least once. */
  done: boolean;
  /** From lms_profiles. Read only on the screen: only staff change it. */
  full_name: string | null;
  mine: MySetupAnswers | null;
  already_told_us: AlreadyToldUs | null;
};

/** This learner's own setup, and the six answers to show back. */
export async function getMySetup(): Promise<Answer<MySetup>> {
  const got = await call<MySetup | null>("lms_my_setup");
  if (!got.ok) return got;
  const row = got.data ?? ({} as MySetup);
  return {
    ok: true,
    data: {
      done: Boolean(row.done),
      full_name: row.full_name ?? null,
      mine: row.mine ?? null,
      already_told_us: row.already_told_us ?? null,
    },
  };
}

/** Saves the five answers. Safe to call again: it updates in place. */
export function saveMySetup(a: {
  preferredName: string;
  device: string;
  internet: string;
  topicExperience: string;
  goalNote?: string;
}): Promise<Answer<MySetup>> {
  return call<MySetup>("lms_save_my_setup", {
    p_preferred_name: a.preferredName,
    p_device: a.device,
    p_internet: a.internet,
    p_topic_experience: a.topicExperience,
    p_goal_note: a.goalNote && a.goalNote.trim() ? a.goalNote.trim() : null,
  });
}

/**
 * The phone number on this person's own profile row.
 *
 * THE ONE TABLE READ IN THIS FILE. There is no function for the phone
 * and file 18 left the browser UPDATE on exactly full_name and phone, so
 * this is the sanctioned way at it. The policy p_profiles_self_read from
 * file 06 is what limits it to one row: this query asks for the row
 * whose id is the signed in person, and would come back empty for
 * anybody else's even without the filter.
 *
 * An empty answer is not an error. Plenty of accounts have no phone
 * number on them, and the screen offers the box either way.
 */
export async function getMyPhone(): Promise<string> {
  if (!certDb) return "";
  try {
    const who = await certDb.auth.getSession();
    const id = who.data?.session?.user?.id;
    if (!id) return "";
    const { data, error } = await certDb
      .from("lms_profiles")
      .select("phone")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return "";
    return ((data as { phone: string | null }).phone ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Saves the phone number, and says plainly when it could not.
 *
 * It is a separate call from saveMySetup on purpose. The five answers go
 * to a function and the phone goes to a column, so one can succeed while
 * the other fails, and the screen says which rather than claiming the
 * whole save failed when four fifths of it worked.
 */
export async function saveMyPhone(phone: string): Promise<Answer<string>> {
  if (!certDb) {
    return { ok: false, message: "The Academy database is not reachable from here." };
  }
  const typed = phone.trim();
  try {
    const who = await certDb.auth.getSession();
    const id = who.data?.session?.user?.id;
    if (!id) return { ok: false, message: "Sign in first." };
    const { error } = await certDb
      .from("lms_profiles")
      .update({ phone: typed || null })
      .eq("id", id);
    if (error) return failed(error);
    return { ok: true, data: typed };
  } catch (thrown) {
    return failed(thrown);
  }
}

// ---------------------------------------------------------------------
// The learner's own day
// ---------------------------------------------------------------------

export type MyDay = {
  /** False when this account is not linked to a bootcamp enrolment. */
  bootcamp: boolean;
  /** Null when no day is open for any cohort this person is in. */
  day_id: string | null;
  cohort?: string;
  meets_on?: string;
  mode?: "in_person" | "virtual" | "both" | string;
  title?: string | null;
  /** Whether a code is live. Never what it is. */
  code_live?: boolean;
  checked_in?: boolean;
  checked_in_at?: string | null;
  method?: "scan" | "code" | "staff" | string | null;
  form_open?: boolean;
  form_closes_at?: string | null;
  answered?: boolean;
  mine?: {
    followed: string;
    confidence: number;
    unclear: string | null;
    repeat_request: string | null;
    submitted_at: string;
  } | null;
};

/** Today, for this learner. Holds no code and no fingerprint of one. */
export function getMyDay(): Promise<Answer<MyDay>> {
  return call<MyDay>("lms_attendance_my_day");
}

/**
 * The code door. One generic refusal for a wrong code, an expired one
 * and one belonging to another cohort, so nothing can be learned by
 * trying codes.
 */
export function useAttendanceCode(code: string): Promise<Answer<MyDay>> {
  return call<MyDay>("lms_attendance_use_code", { p_code: code.trim().toUpperCase() });
}

/** The day's short form. Refused outright for anybody not checked in. */
export function submitDayForm(a: {
  followed: string;
  confidence: number;
  unclear?: string;
  repeatRequest?: string;
}): Promise<Answer<MyDay>> {
  return call<MyDay>("lms_attendance_submit", {
    p_followed: a.followed,
    p_confidence: a.confidence,
    p_unclear: a.unclear && a.unclear.trim() ? a.unclear.trim() : null,
    p_repeat_request:
      a.repeatRequest && a.repeatRequest.trim() ? a.repeatRequest.trim() : null,
  });
}

// ---------------------------------------------------------------------
// What staff do
// ---------------------------------------------------------------------

export type AttendanceDay = {
  id: string;
  cohort: string;
  meets_on: string;
  mode: "in_person" | "virtual" | "both" | string;
  title: string | null;
  form_closes_at: string | null;
  closed_at: string | null;
  code_live: boolean;
  code_closes_at: string | null;
  checked_in: number;
  expected: number;
};

export type RevealedCode = {
  /** The plain code. It exists here, on the facilitator's screen, and
      nowhere else: the database keeps a salted fingerprint of it. */
  code: string;
  closes_at: string;
  window_minutes: number;
};

export type CohortRow = { cohort: string; people: number; last_day: string | null };

export type LiveRow = {
  user_id: string;
  full_name: string | null;
  method: string;
  checked_in_at: string;
  answered: boolean;
};

export type RegisterRow = {
  meets_on: string;
  /** How a grid joins a row to the roster. Matching on the name would
      put two people called Chidi Okeke in one cohort into one row. */
  participant_id: string | null;
  user_id: string;
  full_name: string | null;
  participant_no: string | null;
  method: string;
  checked_in_at: string;
  followed: string | null;
  confidence: number | null;
};

/** The cohorts there are, so no screen asks anybody to type one. */
export function listCohorts(): Promise<Answer<CohortRow[]>> {
  return call<CohortRow[]>("lms_attendance_cohorts");
}

/**
 * Opens today for a cohort, or hands back the day already open.
 *
 * The form closing time is given in hours from now rather than as a
 * timestamp, so a facilitator never types a date. The database clamps it
 * between 1 and 72 hours.
 */
export function openDay(a: {
  cohort: string;
  mode: string;
  title?: string;
  formHours?: number;
}): Promise<Answer<AttendanceDay>> {
  return call<AttendanceDay>("lms_attendance_open_day", {
    p_cohort: a.cohort,
    p_mode: a.mode,
    p_title: a.title && a.title.trim() ? a.title.trim() : null,
    p_form_hours: a.formHours ?? 12,
  });
}

/**
 * Reveals a fresh code and returns it ONCE.
 *
 * Calling it again makes a new code and kills the old one, which is how
 * a code that has been passed around is dealt with in the middle of a
 * class. The window is clamped between 1 and 180 minutes.
 */
export function revealCode(
  day: string,
  windowMinutes = 20,
): Promise<Answer<RevealedCode>> {
  return call<RevealedCode>("lms_attendance_reveal_code", {
    p_day: day,
    p_window_minutes: windowMinutes,
  });
}

/** Closes the day. The records stay, and the code stops working. */
export function closeDay(day: string): Promise<Answer<AttendanceDay>> {
  return call<AttendanceDay>("lms_attendance_close_day", { p_day: day });
}

/** One day as staff see it. Never returns the fingerprint or the salt. */
export function getDay(day: string): Promise<Answer<AttendanceDay>> {
  return call<AttendanceDay>("lms_attendance_day", { p_day: day });
}

/**
 * Today for a cohort, or null when there is no class open.
 *
 * NOT openDay. That one hands back the day already open, which looks
 * like the same question, but where there is none it makes one. A panel
 * that asked it on every page load would stand up an attendance day for
 * whichever cohort the dropdown happened to be showing, every time any
 * member of staff glanced at the screen.
 *
 * Null is the ordinary answer, not a fault: most cohorts have no class
 * on most days.
 */
export function getToday(cohort: string): Promise<Answer<AttendanceDay | null>> {
  return call<AttendanceDay | null>("lms_attendance_today", { p_cohort: cohort });
}

export type RosterRow = {
  participant_id: string;
  /** Null when this participant has never made an Academy account, which
      is what stops them being scanned in: attendance belongs to an
      account and the card belongs to a participant. */
  user_id: string | null;
  full_name: string;
  participant_no: string | null;
  has_card: boolean;
  lost_at: string | null;
  replaced_count: number;
  has_account: boolean;
};

/** Everybody in a cohort, whether they have ever turned up or not. */
export function getRoster(cohort: string): Promise<Answer<RosterRow[]>> {
  return call<RosterRow[]>("lms_attendance_roster", { p_cohort: cohort });
}

export type DayRow = {
  id: string;
  meets_on: string;
  mode: string;
  title: string | null;
  closed_at: string | null;
  checked_in: number;
};

/** The days a cohort has had. The grid's columns. */
export function getDaysList(
  cohort: string,
  from?: string,
  to?: string,
): Promise<Answer<DayRow[]>> {
  return call<DayRow[]>("lms_attendance_days_list", {
    p_cohort: cohort,
    p_from: from ?? null,
    p_to: to ?? null,
  });
}

/** Who has arrived, newest first. */
export function getLive(day: string): Promise<Answer<LiveRow[]>> {
  return call<LiveRow[]>("lms_attendance_live", { p_day: day });
}

/** The cohort's register, which is what the grid and the export read. */
export function getRegister(
  cohort: string,
  from?: string,
  to?: string,
): Promise<Answer<RegisterRow[]>> {
  return call<RegisterRow[]>("lms_attendance_register", {
    p_cohort: cohort,
    p_from: from ?? null,
    p_to: to ?? null,
  });
}

export type ScanResult = {
  ok: boolean;
  /** True when that person was already marked present. Not an error. */
  already_in: boolean;
  full_name: string | null;
  cohort: string;
  checked_in_at: string | null;
  method: string | null;
};

/**
 * The scan door. Staff only, which is what stops somebody scanning a
 * borrowed card: there is no learner account on the site that can scan
 * anything at all, their own card included.
 *
 * clientRef is the scanner's own receipt number for this scan. A phone
 * that lost its signal mid-scan sends the queue again when it comes
 * back, and does not know whether the first attempt landed. The
 * receipt number means the second attempt writes nothing instead of a
 * second record, and comes back already_in rather than as an error.
 */
export function scanCard(
  day: string,
  token: string,
  clientRef?: string,
): Promise<Answer<ScanResult>> {
  return call<ScanResult>("lms_attendance_scan", {
    p_day: day,
    p_token: token.trim(),
    p_client_ref: clientRef ?? null,
  });
}

/** A correction, with a reason. Never a deletion. Administrators only. */
export function correctRecord(
  day: string,
  user: string,
  note: string,
): Promise<Answer<{ ok: boolean; checkin_id: string }>> {
  return call<{ ok: boolean; checkin_id: string }>("lms_attendance_correct", {
    p_day: day,
    p_user: user,
    p_note: note,
  });
}

// ---------------------------------------------------------------------
// The ID cards
// ---------------------------------------------------------------------

export type PrintableCard = {
  participant_id: string;
  full_name: string;
  participant_no: string;
  /** The secret the QR carries. Administrators only, and this is the one
      place it leaves the database, because the QR has to be drawn from
      it. It is never written to a file and never put in an address. */
  card_token: string;
  cohort: string;
};

/**
 * Gives a participant a number and a token if they have none, and
 * returns the number. Safe to call twice: a participant who already has
 * a card keeps the one they have.
 */
export function issueCard(participant: string): Promise<Answer<string>> {
  return call<string>("lms_issue_participant_card", { p_participant: participant });
}

/**
 * Marks a card lost. The token is replaced, so the old card stops
 * working the instant this is pressed, and the printed number is kept,
 * so the participant's paperwork does not change.
 */
export function markCardLost(participant: string): Promise<Answer<string>> {
  return call<string>("lms_card_mark_lost", { p_participant: participant });
}

/**
 * Issues a card to everybody in a cohort who has none, and says how
 * many it made. One call rather than one per person, and safe to press
 * twice: anybody already holding a card is skipped, so a second press
 * makes nothing rather than invalidating the cards already printed.
 */
export function issueCardsForCohort(cohort: string): Promise<Answer<number>> {
  return call<number>("lms_issue_cards_for_cohort", { p_cohort: cohort });
}

/** The printable sheet for a cohort. Administrators only. */
export function cardsForPrint(cohort: string): Promise<Answer<PrintableCard[]>> {
  return call<PrintableCard[]>("lms_participant_cards_for_print", { p_cohort: cohort });
}

// ---------------------------------------------------------------------
// Words for the codes the database stores
// ---------------------------------------------------------------------

export const DEVICES: readonly [string, string][] = [
  ["laptop", "A laptop or desktop"],
  ["phone", "A phone only"],
];

export const INTERNET: readonly [string, string][] = [
  ["reliable", "Reliable"],
  ["sometimes", "On and off"],
  ["poor", "Poor"],
];

export const TOPIC_EXPERIENCE: readonly [string, string][] = [
  ["none", "None at all"],
  ["some", "A little"],
  ["confident", "Confident"],
];

export const FOLLOWED: readonly [string, string][] = [
  ["little", "Very little"],
  ["some", "Some of it"],
  ["most", "Most of it"],
  ["all", "All of it"],
];

export const MODES: readonly [string, string][] = [
  ["in_person", "In the room"],
  ["virtual", "Online"],
  ["both", "Both"],
];

/** The person's words for a stored code, or the code itself if unknown. */
export function say(
  list: readonly (readonly [string, string])[],
  code: string | null | undefined,
): string {
  if (!code) return "";
  const found = list.find(([v]) => v === code);
  return found ? found[1] : code;
}

/** How somebody was marked present, in words. */
export function methodWord(method: string | null | undefined): string {
  if (method === "scan") return "ID card scanned";
  if (method === "code") return "Code typed in";
  if (method === "staff") return "Added by staff";
  return "";
}
