import { createClient } from "@supabase/supabase-js";

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  isConfigured,
} from "./certificateConfig";

// Separate Supabase project from the blog. The publishable key is safe in the
// browser: Row Level Security means the public cannot read participant or
// certificate rows directly. Every lookup goes through a database function
// that returns only what it should.
export const certDb = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

export type Certificate = {
  certificate_number: string;
  full_name: string;
  programme_title: string;
  programme_slug: string;
  module_title: string | null;
  module_slug: string | null;
  week_number: number | null;
  is_module: boolean;
  course_url: string | null;
  duration_text: string | null;
  completed_on: string;
  template_key?: string;
};

export type VerifyResult = {
  found: boolean;
  full_name: string | null;
  programme_title: string | null;
  programme_slug: string | null;
  module_title: string | null;
  week_number: number | null;
  is_module: boolean | null;
  course_url: string | null;
  duration_text: string | null;
  completed_on: string | null;
  revoked: boolean | null;
};

// Step one of signing in. Always reports success, even for an address that is
// not on the list, so this form cannot be used to discover who your graduates
// are. Rate limiting lives in the database function.
export async function requestCode(
  email: string,
): Promise<{ ok: boolean; message: string }> {
  if (!certDb) return { ok: false, message: "Not configured yet." };
  const { error } = await certDb.rpc("request_certificate_code", {
    p_email: email.trim(),
  });
  if (error) {
    console.error("requestCode failed:", error.message);
    return { ok: false, message: "Could not send the code. Please try again." };
  }
  return { ok: true, message: "If that address is on our records, a code is on its way." };
}

// Step two. A wrong or expired code simply returns nothing.
export async function verifyCode(
  email: string,
  code: string,
): Promise<{ ok: boolean; certificates: Certificate[]; message: string }> {
  if (!certDb) return { ok: false, certificates: [], message: "Not configured yet." };
  const { data, error } = await certDb.rpc("verify_certificate_code", {
    p_email: email.trim(),
    p_code: code.trim(),
  });
  if (error) {
    console.error("verifyCode failed:", error.message);
    return { ok: false, certificates: [], message: "Something went wrong. Please try again." };
  }
  const rows = (data as Certificate[]) || [];
  if (rows.length === 0) {
    return {
      ok: false,
      certificates: [],
      message: "That code did not match, or it has expired. Please request a new one.",
    };
  }
  return { ok: true, certificates: rows, message: "" };
}

// Public check of a single certificate number. Returns no email or phone.
export async function verifyNumber(num: string): Promise<VerifyResult | null> {
  if (!certDb) return null;
  const { data, error } = await certDb.rpc("verify_certificate", {
    p_number: num.trim(),
  });
  if (error) {
    console.error("verifyNumber failed:", error.message);
    return null;
  }
  const rows = (data as VerifyResult[]) || [];
  return rows[0] || null;
}

// "3rd July 2026" from "2026-07-03"
export function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = d.toLocaleString("en-GB", { month: "long" });
  return `${day}${suffix} ${month} ${d.getFullYear()}`;
}

// What the certificate should say on its main line.
export function certificateTitle(c: Certificate): string {
  return c.is_module && c.module_title ? c.module_title : c.programme_title;
}

// The small grey line, only on weekly tool certificates.
export function certificateSubtitle(c: Certificate): string {
  if (!c.is_module) return "";
  const wk = c.week_number ? `Week ${c.week_number}` : "Module";
  return `${wk}  |  ${c.programme_title}`;
}

// Builds the LinkedIn "Add to profile" link. This drops the certificate
// directly into the graduate's Licenses and Certifications section, already
// attached to the Data-Lead Africa company page, so it stays on their profile
// permanently rather than scrolling away like an ordinary post.
export function addToLinkedInUrl(
  cert: Certificate,
  organizationId: string,
  verifyUrl: string,
): string {
  const completed = new Date(cert.completed_on + "T00:00:00");
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: certificateTitle(cert),
    organizationId,
    issueYear: String(completed.getFullYear()),
    issueMonth: String(completed.getMonth() + 1),
    certUrl: verifyUrl,
    certId: cert.certificate_number,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}
