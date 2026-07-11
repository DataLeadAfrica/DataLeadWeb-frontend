import { supabase } from "./supabase";

const ALLOWED_DOMAIN = "@dataleadafrica.com";

// Admin emails (approvers). Kept here for quick UI role checks; the database
// is the real source of truth via the is_admin() function and RLS policies.
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

// Send a magic link. Rejects any address outside the allowed domain
// before it ever reaches Supabase.
export async function sendMagicLink(
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const clean = email.trim().toLowerCase();
  if (!isAllowedEmail(clean)) {
    return {
      ok: false,
      message: "Please use your @dataleadafrica.com email address.",
    };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: clean,
    options: {
      emailRedirectTo: window.location.origin + "/studio",
      shouldCreateUser: true,
    },
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return {
    ok: true,
    message: "Check your inbox for a secure sign-in link.",
  };
}

export async function getCurrentEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
