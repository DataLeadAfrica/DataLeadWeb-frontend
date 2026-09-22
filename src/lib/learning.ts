import { certDb } from "./certificates";

// Data layer for the participant learning portal.
//
// Everything here goes through a database function. The browser never reads
// the question tables directly, and no answer key is ever sent to the page:
// module_start_attempt returns the prompt and the options, and nothing else.
// Marking happens inside the database.

const TOKEN_KEY = "dla_learner_token";
const NAME_KEY = "dla_learner_name";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getLearnerName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

function setSession(token: string, name: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // A browser with storage blocked still works for one page load.
  }
}

function clearSession() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(NAME_KEY);
  } catch {
    // nothing to do
  }
}

// ---------------------------------------------------------------- sign in

// Ask for a one time code.
//
// The database checks the address against active enrolments first. An
// enrolled address gets a code. Anything else gets a plain explanation and
// no email is sent.
//
//   sent          enrolled, code on its way
//   not_enrolled  no active enrolment for this address
//   invalid       not an email address
//   error         enrolled, but a code went out very recently
//   failed        the request itself did not get through
export type CodeStatus =
  | "sent"
  | "not_enrolled"
  | "invalid"
  | "error"
  | "failed";

export async function requestCode(
  email: string,
): Promise<{ status: CodeStatus; message: string }> {
  if (!certDb) {
    return { status: "failed", message: "The portal is not configured yet." };
  }
  const clean = email.trim().toLowerCase();
  if (!clean || !clean.includes("@")) {
    return {
      status: "invalid",
      message: "Please enter a valid email address.",
    };
  }
  const { data, error } = await certDb.rpc("participant_request_code", {
    p_email: clean,
  });
  if (error) {
    return {
      status: "failed",
      message: "Something went wrong. Please try again.",
    };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.status) {
    return {
      status: "failed",
      message: "Something went wrong. Please try again.",
    };
  }
  return { status: row.status as CodeStatus, message: row.message || "" };
}

export async function signIn(
  email: string,
  code: string,
): Promise<{ ok: boolean; message: string; name?: string }> {
  if (!certDb) {
    return { ok: false, message: "The portal is not configured yet." };
  }
  const { data, error } = await certDb.rpc("participant_login", {
    p_email: email.trim().toLowerCase(),
    p_code: code.trim(),
  });
  if (error) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.token) {
    return {
      ok: false,
      message:
        "That code was not right, or it has expired. Codes last a few minutes.",
    };
  }
  setSession(row.token, row.full_name || "");
  return { ok: true, message: "", name: row.full_name || "" };
}

// ---------------------------------------------------------------- passwords

// Sign in with an email and a password issued by the training team. Creates
// exactly the same session as the email code, so everything after sign in
// behaves identically whichever route was used.
//
//   ok            signed in
//   wrong         password did not match
//   locked        five wrong attempts, locked for 15 minutes
//   no_password   no password issued to this person yet
//   not_enrolled  no active enrolment for this address
//   invalid       blank email or password
//   failed        the request itself did not get through
export type PasswordStatus =
  | "ok"
  | "wrong"
  | "locked"
  | "no_password"
  | "not_enrolled"
  | "invalid"
  | "failed";

export async function passwordSignIn(
  email: string,
  password: string,
): Promise<{ status: PasswordStatus; message: string }> {
  if (!certDb) {
    return { status: "failed", message: "The portal is not configured yet." };
  }
  const { data, error } = await certDb.rpc("participant_password_login", {
    p_email: email.trim().toLowerCase(),
    p_password: password,
  });
  if (error) {
    return {
      status: "failed",
      message: "Something went wrong. Please try again.",
    };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.status) {
    return {
      status: "failed",
      message: "Something went wrong. Please try again.",
    };
  }
  if (row.status === "ok" && row.token) {
    setSession(row.token, row.full_name || "");
    return { status: "ok", message: "" };
  }
  return { status: row.status as PasswordStatus, message: row.message || "" };
}

export async function changePassword(
  current: string,
  next: string,
): Promise<{ ok: boolean; message: string }> {
  const token = getToken();
  if (!certDb || !token) {
    return { ok: false, message: "Please sign in again." };
  }
  const { data, error } = await certDb.rpc("participant_change_password", {
    p_token: token,
    p_current: current,
    p_new: next,
  });
  if (error) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: Boolean(row?.ok),
    message: row?.message || "Something went wrong. Please try again.",
  };
}

export async function signOut(): Promise<void> {
  const token = getToken();
  clearSession();
  if (certDb && token) {
    await certDb.rpc("participant_logout", { p_token: token });
  }
}

// ---------------------------------------------------------------- dashboard

export type SectionRow = {
  module_slug: string;
  module_title: string;
  module_code: string;
  week_number: number | null;
  pass_percent: number;
  attempts_used: number;
  best_percent: number | null;
  status: "certified" | "retry" | "open";
  closed: boolean;
  cert_number: string | null;
  cert_issued_at: string | null;
  first_sat_at: string | null;
};

export async function fetchDashboard(): Promise<{
  ok: boolean;
  signedIn: boolean;
  sections: SectionRow[];
}> {
  const token = getToken();
  if (!certDb || !token) return { ok: false, signedIn: false, sections: [] };

  const { data, error } = await certDb.rpc("participant_dashboard", {
    p_token: token,
  });
  if (error) return { ok: false, signedIn: true, sections: [] };

  const rows = (data as SectionRow[]) || [];
  // An expired session returns no rows. Check the session separately so an
  // empty enrolment is not mistaken for being signed out.
  if (rows.length === 0) {
    const { data: ok } = await certDb.rpc("participant_session_ok", {
      p_token: token,
    });
    if (!ok) {
      clearSession();
      return { ok: true, signedIn: false, sections: [] };
    }
  }
  return {
    ok: true,
    signedIn: true,
    sections: rows.map((r) => ({
      ...r,
      best_percent: r.best_percent === null ? null : Number(r.best_percent),
      attempts_used: Number(r.attempts_used) || 0,
      pass_percent: Number(r.pass_percent) || 70,
    })),
  };
}

// ---------------------------------------------------------------- assessment

export type PaperQuestion = {
  question_id: string;
  ref: string;
  prompt: string;
  marks: number;
  options: { key: string; text: string }[] | null;
};

export type Paper = {
  attemptId: string;
  questions: PaperQuestion[];
  totalMarks: number;
};

// Fisher-Yates. Used to vary the question order and the order of the four
// options on every attempt, so a participant who retakes does not meet the
// same paper laid out the same way.
function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function startAttempt(
  slug: string,
): Promise<{ ok: boolean; paper?: Paper; message: string }> {
  const token = getToken();
  if (!certDb || !token) {
    return { ok: false, message: "Please sign in first." };
  }

  const { data, error } = await certDb.rpc("module_start_attempt", {
    p_token: token,
    p_module_slug: slug,
  });
  if (error) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  const rows = (data as (PaperQuestion & { attempt_id: string })[]) || [];
  if (rows.length === 0) {
    // The database returns nothing for several different reasons, and it is
    // deliberately quiet about which. This covers all of them honestly.
    return {
      ok: false,
      message:
        "This assessment is not open to you. That usually means you have already passed it, or you are not enrolled on this programme.",
    };
  }

  const questions = shuffle(
    rows.map((r) => ({
      question_id: r.question_id,
      ref: r.ref,
      prompt: r.prompt,
      marks: Number(r.marks) || 1,
      options: r.options ? shuffle(r.options) : null,
    })),
  );

  return {
    ok: true,
    message: "",
    paper: {
      attemptId: rows[0].attempt_id,
      questions,
      totalMarks: questions.reduce((n, q) => n + q.marks, 0),
    },
  };
}

export type Result = {
  score: number;
  max: number;
  percent: number;
  passMark: number;
  passed: boolean;
  certNumber: string | null;
};

export async function submitAttempt(
  attemptId: string,
  answers: Record<string, string>,
): Promise<{ ok: boolean; result?: Result; message: string }> {
  const token = getToken();
  if (!certDb || !token) {
    return { ok: false, message: "Please sign in first." };
  }

  const { data, error } = await certDb.rpc("module_submit_attempt", {
    p_token: token,
    p_attempt: attemptId,
    p_answers: answers,
  });
  if (error) {
    return {
      ok: false,
      message: "Your answers could not be submitted. Please try again.",
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      ok: false,
      message:
        "This attempt could not be marked. It may already have been submitted.",
    };
  }

  return {
    ok: true,
    message: "",
    result: {
      score: Number(row.auto_score) || 0,
      max: Number(row.auto_max) || 0,
      percent: Number(row.percent) || 0,
      passMark: Number(row.pass_mark) || 70,
      passed: Boolean(row.passed),
      certNumber: row.cert_number || null,
    },
  };
}
