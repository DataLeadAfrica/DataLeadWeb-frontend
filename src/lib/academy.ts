import { certDb } from "./certificates";

// Everything the Academy pages ask of Supabase lives here. The pages
// themselves contain no Supabase code at all, which is what makes
// docs/lms/PREVIEW-DATA.md able to describe every call in one list.
//
// Three rules hold throughout:
//
//   1. No reply ever reveals whether an email address has an account.
//      Signing in with the wrong password and signing in with an address
//      nobody has used get the same sentence. Asking for a reset code gets
//      the same sentence whether or not there is an account to reset.
//   2. Exactly ONE kind of failure is hidden to keep rule 1 true, and
//      every other kind is reported. See trouble() below, which is where
//      that judgement is made once for the whole file.
//   3. Every function returns the same shape, { ok, message, field }, with
//      the message already written for a person to read. Pages show it as
//      it is and never build their own wording from an error code. The
//      field says which box the message is about, so the page can clear it
//      the moment that box is edited.

/** Which input a message belongs to. "form" means the message is about the
    submission as a whole and is cleared when any field in it changes. */
export type ErrorField = "name" | "email" | "password" | "code" | "form";

export type Result = { ok: boolean; message: string; field?: ErrorField };

export type AccessState = {
  role: string;
  bootcamp: boolean;
  changed: boolean;
  message: string;
};

export type Session = {
  signedIn: boolean;
  email: string;
  fullName: string;
};

export const MIN_PASSWORD = 8;
export const RESEND_WAIT_SECONDS = 60;
export const CODE_LENGTH = 6;

// How long a code lasts. This number must agree with Authentication,
// Sign In / Providers, Email, Email OTP expiration, which is set to 600
// seconds. It is written down once, here, and the countdown on the code
// screen is built from it. If the setting is ever changed, change it here
// in the same sitting, or the page will count down to a moment that is
// not when the code actually dies.
export const CODE_SECONDS = 600;

const NOT_READY = "The Academy is not ready yet. Please try again shortly.";
const GENERIC = "Something went wrong. Please try again.";

const OFFLINE =
  "We could not reach the Academy. Check your connection and try again.";
const TOO_BUSY =
  "We are sending a lot of emails right now. Please try again in an hour.";
const SEND_FAILED =
  "We could not send your code just now. Please try again in a few minutes.";

// -------------------------------------------------------------- trouble
//
// THE MISTAKE THIS REPLACES, because it is an easy one to make again.
//
// supabase-js does NOT throw when the network fails. Look at auth-js:
// _request builds an AuthRetryableFetchError and throws it, but every
// public method catches it again with `if (isAuthError(error)) return
// { error }`. So a dead connection arrives as a RETURNED error, exactly
// like a refusal from the server.
//
// The first version of this file wrapped each call in a try/catch and
// treated "did not throw" as "the server answered". Nothing ever threw,
// so every failure was read as the one failure that has to be hidden, and
// three real ones were hidden with it: no connection, the project's whole
// email allowance used up, and the mailer being down. In all three the
// person was shown the code screen and left waiting for an email that was
// never going to arrive.
//
// So the error is read, and the decision is made on its KIND:
//
//   status 0            the request never left the device
//   429 "after N sec"   the per address wait. THE ONLY ONE THAT LEAKS,
//                       because Supabase sends it only for an address it
//                       already knows. Reported as success
//   429 anything else   the project's email allowance for the hour
//   500 and above       the server, the Send Email Hook or the mailer
//   anything else       not worth a different sentence
//
// A note on the 500: it can only happen when an email was really being
// sent, which for sign up means the address was new. In principle that
// narrows things for somebody watching closely. It is reported anyway,
// because it needs the mailer to be broken at that exact moment, and the
// alternative is telling a real person a code is coming when we know it
// is not.

type Trouble = { message: string } | null;

type SupabaseError = { message?: string; status?: number; name?: string };

/** Reads a returned error and says what to tell the person, or null when
    there is nothing worth saying and the caller should carry on as though
    it had succeeded. */
function trouble(error: unknown): Trouble {
  if (!error) return null;

  const e = error as SupabaseError;
  const status = typeof e.status === "number" ? e.status : undefined;
  const message = typeof e.message === "string" ? e.message : "";

  // The request never arrived. auth-js marks this as status 0.
  if (status === 0 || (status === undefined && e.name === "AuthRetryableFetchError")) {
    return { message: OFFLINE };
  }

  if (status === 429) {
    // "For security purposes, you can only request this after 47 seconds."
    // Per address, and therefore the one that has to stay hidden.
    if (/after \d+ seconds?/i.test(message)) return null;
    // "Email rate limit exceeded." The whole project, so it says nothing
    // about any one address and can be reported plainly.
    return { message: TOO_BUSY };
  }

  if (status !== undefined && status >= 500) return { message: SEND_FAILED };

  return null;
}

// A backstop, so that everything reaches trouble() the same way. Supabase
// catches its own fetch failures and returns them, but anything that does
// throw is turned into the same shape rather than being allowed to leave a
// button spinning for ever.
// PromiseLike, not Promise: certDb.rpc() hands back a query builder that
// can be awaited but is not a real promise.
async function call<T extends { error: unknown }>(
  work: PromiseLike<T>,
): Promise<T> {
  try {
    return await work;
  } catch (e) {
    return { error: e } as T;
  }
}

// Shown for every failed sign in, whatever the real reason, so the page
// cannot be used to find out which addresses have accounts.
const SIGN_IN_FAILED =
  "That email address and password do not match. Please check both and try again.";

const CODE_REFUSED =
  "That code was not right, or it has run out. Ask for a new one and try again.";

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Supabase says "Email not confirmed" when somebody signed up and never
// typed their code. That is the one failure worth telling apart, because
// the answer is to send them a new code rather than to doubt themselves.
function isUnconfirmed(message: string): boolean {
  return /not confirmed/i.test(message);
}

// ------------------------------------------------------------ sign up

export async function signUp(
  fullName: string,
  email: string,
  password: string,
): Promise<Result> {
  if (!certDb) return { ok: false, message: NOT_READY, field: "form" };

  const name = fullName.trim();
  const clean = email.trim().toLowerCase();

  if (name.length < 2) {
    return { ok: false, message: "Please enter your full name.", field: "name" };
  }
  if (!looksLikeEmail(clean)) {
    return {
      ok: false,
      message: "Please enter a valid email address.",
      field: "email",
    };
  }
  if (password.length < MIN_PASSWORD) {
    return {
      ok: false,
      message: `Please choose a password of at least ${MIN_PASSWORD} characters.`,
      field: "password",
    };
  }

  const { error } = await call(
    certDb.auth.signUp({
      email: clean,
      password,
      options: { data: { full_name: name } },
    }),
  );

  // Only the per address wait is hidden. Everything else trouble() names
  // is reported, because in every one of those cases no email was sent and
  // sending the person to the code screen would leave them waiting for
  // something that is not coming.
  const bad = trouble(error);
  if (bad) return { ok: false, message: bad.message, field: "form" };

  // Nothing else is read, and that is the point of the page. Supabase
  // already returns a fake success for an address that is taken, so this
  // form cannot be used as a list of who has an account, and reading any
  // further would undo the protection it is providing.
  //
  // No message either: the code screen already says where the code went
  // and the meter beside it already counts down how long it lasts.
  return { ok: true, message: "" };
}

export async function confirmSignUp(email: string, code: string): Promise<Result> {
  if (!certDb) return { ok: false, message: NOT_READY, field: "form" };

  const { error } = await call(
    certDb.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "signup",
    }),
  );

  // A lost connection must not be reported as a wrong code: the person
  // would burn a good code believing it had failed.
  const bad = trouble(error);
  if (bad) return { ok: false, message: bad.message, field: "form" };

  if (error) return { ok: false, message: CODE_REFUSED, field: "code" };
  return { ok: true, message: "" };
}

export async function resendSignUpCode(email: string): Promise<Result> {
  if (!certDb) return { ok: false, message: NOT_READY, field: "form" };

  const { error } = await call(
    certDb.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    }),
  );

  const bad = trouble(error);
  if (bad) return { ok: false, message: bad.message, field: "form" };

  // Same as signUp. The remaining errors here, the per address wait and
  // "already confirmed", both happen only for an address that exists.
  return { ok: true, message: "A new code is on its way." };
}

// ------------------------------------------------------------ sign in

export type SignInResult = Result & { needsCode: boolean };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (!certDb) {
    return { ok: false, needsCode: false, message: NOT_READY, field: "form" };
  }

  const clean = email.trim().toLowerCase();
  if (!looksLikeEmail(clean) || password.length === 0) {
    return {
      ok: false,
      needsCode: false,
      message: SIGN_IN_FAILED,
      field: "form",
    };
  }

  const { error } = await call(
    certDb.auth.signInWithPassword({ email: clean, password }),
  );

  // Before anything else: a lost connection must not be reported as a
  // wrong password. Telling somebody their password is wrong when the
  // request never left the building sends them off to reset a password
  // that was fine.
  const bad = trouble(error);
  if (bad) {
    return { ok: false, needsCode: false, message: bad.message, field: "form" };
  }

  if (error) {
    // The one failure worth telling apart. It reveals that the address
    // has an unconfirmed account, which is a small thing to give away
    // next to leaving somebody stuck with no idea what is wrong.
    if (isUnconfirmed(error.message)) {
      return {
        ok: false,
        needsCode: true,
        message:
          "This address has not been confirmed yet. We can send you a new code.",
      };
    }
    return {
      ok: false,
      needsCode: false,
      message: SIGN_IN_FAILED,
      field: "form",
    };
  }

  return { ok: true, needsCode: false, message: "" };
}

// ------------------------------------------------------ forgot password

export async function startPasswordReset(email: string): Promise<Result> {
  if (!certDb) return { ok: false, message: NOT_READY, field: "form" };

  const clean = email.trim().toLowerCase();
  if (!looksLikeEmail(clean)) {
    return {
      ok: false,
      message: "Please enter a valid email address.",
      field: "email",
    };
  }

  const { error } = await call(certDb.auth.resetPasswordForEmail(clean));

  const bad = trouble(error);
  if (bad) return { ok: false, message: bad.message, field: "form" };

  // The reply is thrown away on purpose, and this is the whole point of
  // the page. Supabase returns an empty success for an address with no
  // account and the same empty success for one with an account, so the
  // only thing that could tell them apart is the rate limit refusal, which
  // it sends only for addresses it knows. Reading the error at all would
  // reintroduce the leak, so it is not read. The same call does the first
  // send and "send another code", which have to be indistinguishable too.
  //
  // No message: the reset page says "if that address has an account" in
  // its own words, and a sentence here would be shown underneath it
  // saying the same thing again.
  return { ok: true, message: "" };
}

export async function confirmPasswordReset(
  email: string,
  code: string,
): Promise<Result> {
  if (!certDb) return { ok: false, message: NOT_READY, field: "form" };

  const { error } = await call(
    certDb.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "recovery",
    }),
  );

  const bad = trouble(error);
  if (bad) return { ok: false, message: bad.message, field: "form" };

  if (error) return { ok: false, message: CODE_REFUSED, field: "code" };
  return { ok: true, message: "" };
}

export async function setNewPassword(password: string): Promise<Result> {
  if (!certDb) return { ok: false, message: NOT_READY, field: "form" };

  if (password.length < MIN_PASSWORD) {
    return {
      ok: false,
      message: `Please choose a password of at least ${MIN_PASSWORD} characters.`,
      field: "password",
    };
  }

  const { error } = await call(certDb.auth.updateUser({ password }));

  const bad = trouble(error);
  if (bad) return { ok: false, message: bad.message, field: "form" };

  if (error) return { ok: false, message: GENERIC, field: "password" };

  return { ok: true, message: "Your password has been changed." };
}

// ------------------------------------------------------------ session

export async function getSession(): Promise<Session> {
  const empty: Session = { signedIn: false, email: "", fullName: "" };
  if (!certDb) return empty;

  const answer = await call(certDb.auth.getSession());
  if (answer.error || !answer.data?.session) return empty;

  const user = answer.data.session.user;
  const meta = (user.user_metadata ?? {}) as { full_name?: string };
  const email = user.email ?? "";

  return {
    signedIn: true,
    email,
    // Somebody who signed up before the name was asked for still needs
    // something to be greeted by, so fall back to the part of the
    // address before the at sign.
    fullName: (meta.full_name ?? "").trim() || email.split("@")[0],
  };
}

export async function signOut(): Promise<void> {
  if (!certDb) return;
  await call(certDb.auth.signOut());
}

// ------------------------------------------------------------- access

// Called once after every sign in and each time an Academy page opens.
// It re-checks the two email lists in both directions, so somebody taken
// off a cohort loses access and somebody newly added gains it, without
// anybody having to remember to do anything.
export async function syncAccess(): Promise<AccessState | null> {
  if (!certDb) return null;

  const answer = await call(certDb.rpc("lms_sync_my_access"));
  if (answer.error) return null;

  const { data } = answer;
  const row = (Array.isArray(data) ? data[0] : data) as AccessState | undefined;
  if (!row) return null;

  return {
    role: row.role ?? "learner",
    bootcamp: Boolean(row.bootcamp),
    changed: Boolean(row.changed),
    message: row.message ?? "",
  };
}

// lms_my_role is deliberately NOT called from here.
//
// It used to be, by My learning, which asked for the role separately from
// the access sync. That was a second round trip for something the sync had
// already returned, and worse, the two could disagree for a moment and the
// page would show one role and then swap to the other. The role now comes
// from syncAccess alone. If a later phase needs the role somewhere the
// sync has not run, add the call back here rather than in a page.

// Learner, facilitator or admin, written the way a person would say it.
export function roleLabel(role: string): string {
  if (role === "admin") return "Administrator";
  if (role === "facilitator") return "Facilitator";
  return "Learner";
}

/** Good morning, Good afternoon or Good evening, by the clock in the
    browser. There is no server call for this and no stored preference:
    the device's own time is the only thing that knows. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
