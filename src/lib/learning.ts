import { certDb } from "./certificates";
import { isConfigured } from "./certificateConfig";

// The participant's session token. Kept in localStorage so it survives closing
// the tab, which is the whole point of the portal: people come back weekly.
// The token is opaque and short lived on the server side, 30 days. Only its
// hash is stored in the database, never the token itself.
const TOKEN_KEY = "dla_learner_token";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // private browsing with storage blocked
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* nothing we can do, they will be asked to sign in again */
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export type ModuleProgress = {
  module_id: string;
  module_slug: string;
  module_title: string;
  week_number: number | null;
  pass_percent: number;
  max_attempts: number;
  attempts_used: number;
  best_percent: number | null;
  status: "certified" | "awaiting_trainer" | "retry" | "open";
  awaiting_trainer: boolean;
  cert_number: string | null;
  cert_issued_at: string | null;
};

export type LoginResult = {
  token: string;
  participant_id: string;
  full_name: string;
};

/** Sends a one time code to the participant's email. */
export async function requestLoginCode(email: string): Promise<boolean> {
  if (!isConfigured || !certDb) return false;
  const { data, error } = await certDb.rpc("request_certificate_code", {
    p_email: email.trim(),
  });
  if (error) {
    console.error("requestLoginCode failed:", error.message);
    return false;
  }
  return data === true;
}

/** Exchanges the emailed code for a session that lasts 30 days. */
export async function loginWithCode(
  email: string,
  code: string,
): Promise<LoginResult | null> {
  if (!isConfigured || !certDb) return null;
  const { data, error } = await certDb.rpc("participant_login", {
    p_email: email.trim(),
    p_code: code.trim(),
  });
  if (error) {
    console.error("loginWithCode failed:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.token) return null;
  setToken(row.token);
  return row as LoginResult;
}

/**
 * Confirms the stored token is still good.
 *
 * This exists because participant_dashboard returns no rows in TWO different
 * situations: the token was refused, and the participant is enrolled but has
 * no modules open. Those need opposite messages on screen, so the session is
 * checked separately rather than guessed at from an empty list.
 */
export async function verifySession(): Promise<boolean> {
  const token = getToken();
  if (!isConfigured || !certDb || !token) return false;
  const { data, error } = await certDb.rpc("participant_session_ok", {
    p_token: token,
  });
  if (error) {
    console.error("verifySession failed:", error.message);
    return false;
  }
  return Boolean(data);
}

/** Everything the dashboard needs, in one call. */
export async function fetchProgress(): Promise<ModuleProgress[] | null> {
  const token = getToken();
  if (!isConfigured || !certDb || !token) return null;
  const { data, error } = await certDb.rpc("participant_dashboard", {
    p_token: token,
  });
  if (error) {
    console.error("fetchProgress failed:", error.message);
    return null;
  }
  return (data as ModuleProgress[]) || [];
}

export async function logout(): Promise<void> {
  const token = getToken();
  clearToken();
  if (!isConfigured || !certDb || !token) return;
  try {
    await certDb.rpc("participant_logout", { p_token: token });
  } catch {
    /* the token is already gone from this browser, which is what matters */
  }
}

/** "3rd July 2026" */
export function prettyDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${day}${suffix} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Wording that matches what the participant can actually do next. */
export function statusLabel(m: ModuleProgress): string {
  switch (m.status) {
    case "certified":
      return "Passed";
    case "awaiting_trainer":
      return "Awaiting trainer";
    case "retry":
      return m.attempts_used >= m.max_attempts ? "No attempts left" : "Try again";
    default:
      return "Open now";
  }
}

export function attemptsLeft(m: ModuleProgress): number {
  return Math.max(0, m.max_attempts - m.attempts_used);
}
