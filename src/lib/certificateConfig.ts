// ============================================================
// THE ONLY FILE YOU NEED TO EDIT
//
// Everything the certificate system needs to be told about is here.
// The rest of the code reads from this file, so you should never have
// to touch the other files.
// ============================================================

// ------------------------------------------------------------
// 1. YOUR SUPABASE PROJECT
//    Fill these in after running the click by click setup guide.
//    Project Settings -> API -> Project URL and the "anon public" key.
//    NEVER paste the service_role key here.
// ------------------------------------------------------------
export const SUPABASE_URL = "https://zndjhvcqrgusorflnkxd.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZGpodmNxcmd1c29yZmxua3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTI3NTEsImV4cCI6MjEwMDM4ODc1MX0.jgl7vnGsqWcN7TYplyyPOYlo2v_jlaA1SYhCqb0Qh9U";
// While the two lines above are still placeholders the pages show a
// friendly "coming soon" message instead of breaking.
export const isConfigured =
  !SUPABASE_URL.startsWith("PASTE_") &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith("PASTE_");

// ------------------------------------------------------------
// 2. YOUR SOCIAL HANDLES
//    Used in the share captions. Update when confirmed.
// ------------------------------------------------------------
export const SITE = "https://www.dataleadafrica.com";
export const HASHTAG = "#DLAcertificate";
export const HANDLES = {
  x: "@DataLeadAfrica",
  linkedin: "@Data-Lead Africa",
  facebook: "@Data-Lead Africa",
};

// The numeric LinkedIn Organization ID for the Data-Lead Africa company page
// (https://www.linkedin.com/company/18394661). This is what lets a graduate
// add the certificate straight into the Licenses and Certifications section
// of their LinkedIn profile, permanently linked to your company page.
export const LINKEDIN_ORGANIZATION_ID = "18394661";

// ------------------------------------------------------------
// 3. WHICH PARTNER LOGOS EACH PROGRAMME CARRIES
//    The key is the programme "slug" in your Supabase programmes table.
//    Leave the arrays empty for a Data-Lead Africa only certificate.
//
//    top    = the strip beside the Data-Lead Africa logo, top right
//    bottom = bottom right, beside "Verified Certificate"
//
//    Available logo names: talentforge, tacommunity, giz, fmle, deafintech
// ------------------------------------------------------------
export type PartnerSet = { top: string[]; bottom: string[] };

export const PROGRAMME_LOGOS: Record<string, PartnerSet> = {
  "digital-marketing-web-design": { top: ["talentforge"], bottom: ["tacommunity"] },
  "giz-remote-work": { top: ["giz"], bottom: ["fmle"] },
  "giz-employability": { top: ["giz"], bottom: ["fmle"] },
  // everything else falls back to Data-Lead Africa only
};

export const DEFAULT_PARTNERS: PartnerSet = { top: [], bottom: [] };

export const LOGO_FILES: Record<string, string> = {
  talentforge: "/assets/certificates/logo-talentforge.png",
  tacommunity: "/assets/certificates/logo-tacommunity.png",
  giz: "/assets/certificates/logo-giz.png",
  fmle: "/assets/certificates/logo-fmle.png",
  deafintech: "/assets/certificates/logo-deafintech.png",
};

// ------------------------------------------------------------
// 4. CERTIFICATE TEMPLATES
//
//    Each programme in Supabase has a "template_key". That key picks one
//    of the designs below. A template owns its own background image, its
//    own text positions, and whether partner logos are drawn on top.
//
//    "default"  = the Data-Lead Africa bootcamp certificate
//    "module"   = the same, with the TOOL CERTIFIED badge (weekly tools)
//    "giz-remote-work" = the GIZ / ZME two day Remote Work Training
//                        certificate. Its partner logos and its course
//                        wording are already part of the artwork, so
//                        nothing is drawn on top and only the name and
//                        the dates change.
// ------------------------------------------------------------
export type TextBox = {
  x: number;          // left edge, or the centre when align is "center"
  baseline: number;
  size: number;
  max: number;
  font: string;
  track: number;
  upper?: boolean;
  grey?: boolean;
  weight?: number;
  align?: "left" | "center";
};

export type Template = {
  plate: string;
  drawPartnerLogos: boolean;
  // A template can leave any of these out. Missing means "not printed".
  name?: TextBox;
  course?: TextBox;
  date?: TextBox;
  sub?: TextBox;
  certNo?: { x: number; baseline: number; size: number; align?: "left" | "center" };
  // Wording wrapped around the completion date, e.g. "From 3rd July 2026"
  datePrefix?: string;
};

export const TEMPLATES: Record<string, Template> = {
  default: {
    plate: "/assets/certificates/plate-bootcamp.jpg",
    drawPartnerLogos: true,
    name: { x: 0.331, baseline: 0.4234, size: 0.0665, max: 0.6,
            font: '"Bebas Neue DLA"', track: 0.02, upper: true },
    course: { x: 0.3315, baseline: 0.551, size: 0.0455, max: 0.59,
              font: '"Antonio DLA"', track: 0 },
    date: { x: 0.3333, baseline: 0.6, size: 0.03, max: 0.26,
            font: "Poppins", track: 0.01 },
    sub: { x: 0.3333, baseline: 0.656, size: 0.0225, max: 0.5,
           font: "Poppins", track: 0.01, grey: true },
    certNo: { x: 0.3333, baseline: 0.956, size: 0.0115 },
  },

  module: {
    plate: "/assets/certificates/plate-module.jpg",
    drawPartnerLogos: true,
    name: { x: 0.331, baseline: 0.4234, size: 0.0665, max: 0.6,
            font: '"Bebas Neue DLA"', track: 0.02, upper: true },
    course: { x: 0.3315, baseline: 0.551, size: 0.0455, max: 0.59,
              font: '"Antonio DLA"', track: 0 },
    date: { x: 0.3333, baseline: 0.6, size: 0.03, max: 0.26,
            font: "Poppins", track: 0.01 },
    sub: { x: 0.3333, baseline: 0.656, size: 0.0225, max: 0.5,
           font: "Poppins", track: 0.01, grey: true },
    certNo: { x: 0.3333, baseline: 0.956, size: 0.0115 },
  },

  "giz-remote-work": {
    plate: "/assets/certificates/plate-giz-remote-work.jpg",
    drawPartnerLogos: false,
    name: { x: 0.5134, baseline: 0.3942, size: 0.0605, max: 0.46,
            font: '"Poppins Black DLA"', track: 0, align: "center" },
    date: { x: 0.5010, baseline: 0.6049, size: 0.0284, max: 0.62,
            font: '"Pagella DLA"', track: 0, weight: 700, align: "center" },
    certNo: { x: 0.5010, baseline: 0.9330, size: 0.0130, align: "center" },
    datePrefix: "From ",
  },
};

export const LOGO_SLOTS = {
  top: { rightEdge: 0.833, centerY: 0.1735, maxH: 0.172, gap: 0.013 },
  bottom: { rightEdge: 0.964, centerY: 0.896, maxH: 0.056, gap: 0.013 },
};
