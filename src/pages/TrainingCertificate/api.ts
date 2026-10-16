// Talks to the Google Apps Script that marks the test and keeps the log.
//
// Every request is a plain text POST with no custom headers. That keeps it a
// "simple" request, so the browser never sends the preflight check that Apps
// Script cannot answer, and the JSON reply can still be read.
//
// The answer key never comes to the page. "start" returns the questions and
// options only; "submit" sends the chosen letters and gets back the score.

export type TrainingConfig = {
  training: { title: string; theme: string; dates: string };
  certificate: { courseLine: string; subLine: string };
  passMark: number;
  // 0 means unlimited retakes.
  maxAttempts: number;
  questionCount: number;
  // The names in the dropdown, sorted, exactly as they print.
  participants: string[];
  open: boolean;
};

export type IssuedCertificate = {
  id: string;
  name: string;
  date: string; // yyyy-mm-dd
  score: number;
  total: number;
  percent: number;
  courseLine: string;
  subLine: string;
};

export type Question = {
  id: string;
  text: string;
  options: { key: string; text: string }[];
};

export type StartReply =
  | { ok: true; state: "ready"; name: string; attemptNumber: number; attemptsLeft: number; maxAttempts: number; passMark: number; questions: Question[]; paperSig: string }
  | { ok: true; state: "certified"; certificate: IssuedCertificate }
  | { ok: true; state: "locked"; attemptsUsed: number; maxAttempts: number }
  | { ok: true; state: "closed"; message: string }
  | { ok: false; error: string; message: string };

export type MarkedReply = {
  ok: true;
  state: "marked";
  score: number;
  total: number;
  percent: number;
  passMark: number;
  passed: boolean;
  attemptNumber: number;
  attemptsLeft: number;
  maxAttempts: number;
  certificate: IssuedCertificate | null;
};

export type SubmitReply =
  | MarkedReply
  | { ok: true; state: "certified"; certificate: IssuedCertificate }
  | { ok: true; state: "locked"; attemptsUsed: number; maxAttempts: number }
  | { ok: true; state: "closed"; message: string }
  | { ok: false; error: string; message: string };

const OFFLINE = {
  ok: false as const,
  error: "network",
  message:
    "We could not reach the server. Check your internet connection and try again.",
};

async function call<T>(endpoint: string, payload: object, tries = 2): Promise<T> {
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow",
        signal: ctrl.signal,
      });
      window.clearTimeout(timer);
      if (res.ok) return (await res.json()) as T;
    } catch {
      window.clearTimeout(timer);
    }
    // A short pause before the second try, for a weak signal in the hall.
    if (i < tries - 1) await new Promise((r) => window.setTimeout(r, 1200));
  }
  return OFFLINE as T;
}

export function fetchConfig(endpoint: string) {
  return call<({ ok: true } & TrainingConfig) | { ok: false; message: string }>(
    endpoint,
    { action: "config" },
  );
}

export function startTest(endpoint: string, name: string, device: string) {
  return call<StartReply>(endpoint, { action: "start", name, device });
}

// Safe to retry: the submission ID means the Sheet records it only once.
// paperIds and paperSig let the Sheet check these are the questions this
// person was given, and mark only those.
export function submitTest(
  endpoint: string,
  name: string,
  device: string,
  submissionId: string,
  answers: Record<string, string>,
  paperIds: string[],
  paperSig: string,
) {
  return call<SubmitReply>(
    endpoint,
    { action: "submit", name, device, submissionId, answers, paperIds, paperSig },
    3,
  );
}

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
  );
}

// A random label for this phone, kept in the browser. It only helps you spot
// in the Attempts tab when one phone has sat the test under several names.
export function deviceId(): string {
  const KEY = "dla_training_device";
  try {
    const have = window.localStorage.getItem(KEY);
    if (have) return have;
    const made = newId();
    window.localStorage.setItem(KEY, made);
    return made;
  } catch {
    return "no-storage";
  }
}
