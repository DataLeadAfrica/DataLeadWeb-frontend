import { supabase } from "./supabase";

const ALLOWED_DOMAIN = "@dataleadafrica.com";

// Admin emails (approvers). The database is the real source of truth via the
// is_admin() function and RLS policies; this is a fast UI-side check.
const ADMIN_EMAILS = [
  "arowolo.ayoola@dataleadafrica.com",
  "info@dataleadafrica.com",
];

export function isAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(ALLOWED_DOMAIN);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export type SignUpInput = {
  email: string;
  password: string;
  honorific: string;
  fullName: string;
  designation: string;
  department: string;
  phone: string;
};

// Register a new staff account and save their profile details.
export async function registerStaff(
  input: SignUpInput,
): Promise<{ ok: boolean; message: string }> {
  const email = input.email.trim().toLowerCase();
  if (!isAllowedEmail(email)) {
    return {
      ok: false,
      message: "Submission of articles is only open to staff of Data-Lead Africa.",
    };
  }
  if (input.password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
  });
  if (error) {
    return { ok: false, message: error.message };
  }

  // Save the profile. If the session is active (email confirmation off),
  // this writes immediately.
  const userId = data.user?.id;
  if (userId) {
    const { error: pErr } = await supabase.from("profiles").insert({
      id: userId,
      email,
      full_name: input.fullName.trim(),
      honorific: input.honorific.trim(),
      designation: input.designation.trim(),
      department: input.department.trim(),
      phone: input.phone.trim(),
    });
    if (pErr) {
      // Account exists but profile failed; not fatal for login.
      console.error("Profile save failed:", pErr.message);
    }
  }

  return { ok: true, message: "Account created. You can start writing." };
}

// Log in an existing staff member with email + password.
export async function login(
  email: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  const clean = email.trim().toLowerCase();
  if (!isAllowedEmail(clean)) {
    return {
      ok: false,
      message: "Submission of articles is only open to staff of Data-Lead Africa.",
    };
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: clean,
    password,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Signed in." };
}

// Send a password-reset email. Note: depends on email delivery being set up.
export async function resetPassword(
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const clean = email.trim().toLowerCase();
  if (!isAllowedEmail(clean)) {
    return {
      ok: false,
      message: "Submission of articles is only open to staff of Data-Lead Africa.",
    };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(clean, {
    redirectTo: window.location.origin + "/studio",
  });
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    message: "If email is set up, a reset link is on its way to your inbox.",
  };
}

// Update the current user's password (used after a reset link or from settings).
export async function updatePassword(
  newPassword: string,
): Promise<{ ok: boolean; message: string }> {
  if (newPassword.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Password updated." };
}

export async function getCurrentEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
