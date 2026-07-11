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
  fullName: string;
  department: string;
  title: string;
};

// Register a new staff account and save their profile details.
export async function registerStaff(
  input: SignUpInput,
): Promise<{ ok: boolean; message: string }> {
  const email = input.email.trim().toLowerCase();
  if (!isAllowedEmail(email)) {
    return {
      ok: false,
      message: "Please use your @dataleadafrica.com email address.",
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

  // Save the profile (name, department, title). If the session is active
  // (email confirmation off), this writes immediately.
  const userId = data.user?.id;
  if (userId) {
    const { error: pErr } = await supabase.from("profiles").insert({
      id: userId,
      email,
      full_name: input.fullName.trim(),
      department: input.department.trim(),
      title: input.title.trim(),
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
      message: "Please use your @dataleadafrica.com email address.",
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

export async function getCurrentEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
