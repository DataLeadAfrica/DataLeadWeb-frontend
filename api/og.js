// Generates the 1200 x 630 picture that LinkedIn, Facebook, WhatsApp and the
// rest show when somebody shares a certificate link.
//
// Try it by hand in a browser:
//   /api/og?number=DLA-2026-DAB-EXC-7K3Q9F
// It should return a picture. If it does, this half is working.

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

// Same public values as src/lib/certificateConfig.ts. This is the "anon" key,
// which is already visible in the website's own JavaScript, so repeating it
// here exposes nothing new. The service role key must never appear here.
const SUPABASE_URL = "https://zndjhvcqrgusorflnkxd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZGpodmNxcmd1c29yZmxua3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTI3NTEsImV4cCI6MjEwMDM4ODc1MX0.jgl7vnGsqWcN7TYplyyPOYlo2v_jlaA1SYhCqb0Qh9U";

// Which artwork goes with which programme. Mirrors the template list in
// src/lib/certificateConfig.ts. Anything not named here uses the standard
// Data-Lead Africa design, which is what the website does too.
const PLATES = {
  "giz-remote-work": "/assets/certificates/plate-giz-remote-work.jpg",
};
const DEFAULT_PLATE = "/assets/certificates/plate-bootcamp.jpg";
const MODULE_PLATE = "/assets/certificates/plate-module.jpg";

const ORANGE = "#f56e0f";
const DARK = "#111111";
const GREY = "#6e6e6e";
const BLUE = "#1d6da8";
const LINE = "#e6e3dd";

const el = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length > 1 ? children : children[0] },
});

function prettyDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const rest =
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
  return `${day}${rest} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function lookup(number) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_certificate`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_number: (number || "").trim() }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return (Array.isArray(rows) ? rows[0] : null) || null;
}

function plateFor(row) {
  if (!row) return DEFAULT_PLATE;
  const key = row.template_key || row.programme_slug || "";
  if (PLATES[key]) return PLATES[key];
  return row.is_module ? MODULE_PLATE : DEFAULT_PLATE;
}

function card({ eyebrow, name, programme, dateText, number, plateUrl }) {
  const THUMB_W = 520;
  const THUMB_H = Math.round((THUMB_W * 1500) / 2000);
  const nameSize = name.length > 30 ? 34 : name.length > 22 ? 40 : 50;

  const details = [
    el(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "19px",
          fontFamily: "Poppins Bold",
          letterSpacing: "2px",
          color: ORANGE,
          marginBottom: "14px",
        },
      },
      eyebrow,
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          fontSize: `${nameSize}px`,
          fontFamily: "Poppins Bold",
          color: DARK,
          lineHeight: 1.12,
          marginBottom: "10px",
        },
      },
      name,
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "25px",
          fontFamily: "Poppins Bold",
          color: DARK,
          lineHeight: 1.25,
          marginBottom: "6px",
        },
      },
      programme,
    ),
  ];

  if (dateText) {
    details.push(
      el(
        "div",
        { style: { display: "flex", fontSize: "20px", color: GREY } },
        dateText,
      ),
    );
  }

  details.push(
    el("div", {
      style: {
        display: "flex",
        width: "100%",
        height: "1px",
        background: LINE,
        margin: "22px 0 16px",
      },
    }),
    el(
      "div",
      { style: { display: "flex", fontSize: "16px", color: GREY } },
      "Certificate number",
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "22px",
          fontFamily: "Poppins Bold",
          color: BLUE,
          marginTop: "2px",
        },
      },
      number,
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "17px",
          color: GREY,
          marginTop: "16px",
        },
      },
      "Data-Lead Africa  \u00b7  dataleadafrica.com",
    ),
  );

  const left = plateUrl
    ? el(
        "div",
        {
          style: {
            display: "flex",
            width: `${THUMB_W}px`,
            height: `${THUMB_H}px`,
            border: `1px solid ${LINE}`,
          },
        },
        el("img", {
          src: plateUrl,
          width: THUMB_W,
          height: THUMB_H,
          style: { width: `${THUMB_W}px`, height: `${THUMB_H}px` },
        }),
      )
    : null;

  const row = [];
  if (left) row.push(left);
  row.push(
    el(
      "div",
      {
        style: {
          flex: "1",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          marginLeft: left ? "44px" : "0px",
        },
      },
      ...details,
    ),
  );

  return el(
    "div",
    {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        background: "#ffffff",
        fontFamily: "Poppins",
      },
    },
    el("div", { style: { width: "14px", height: "630px", background: ORANGE } }),
    el(
      "div",
      {
        style: {
          flex: "1",
          display: "flex",
          alignItems: "center",
          padding: "44px 52px",
        },
      },
      ...row,
    ),
  );
}

export default async function handler(request) {
  const url = new URL(request.url);
  const number = (url.searchParams.get("number") || "").trim();
  const origin = url.origin;

  // Fonts have to be handed to the drawing engine as data. It cannot read
  // woff2, which is why these are .ttf files.
  let fonts = [];
  try {
    const [reg, bold] = await Promise.all([
      fetch(`${origin}/fonts/Poppins-Regular.ttf`).then((r) => r.arrayBuffer()),
      fetch(`${origin}/fonts/Poppins-Bold.ttf`).then((r) => r.arrayBuffer()),
    ]);
    fonts = [
      { name: "Poppins", data: reg, weight: 400, style: "normal" },
      { name: "Poppins Bold", data: bold, weight: 700, style: "normal" },
    ];
  } catch {
    return new Response("Fonts unavailable", { status: 500 });
  }

  let row = null;
  try {
    row = await lookup(number);
  } catch {
    row = null;
  }

  const ok = row && row.found && !row.revoked;
  const name = ok ? row.full_name || "" : "Data-Lead Africa";
  const programme = ok
    ? (row.is_module && row.module_title
        ? row.module_title
        : row.programme_title) || ""
    : "Certificate verification";
  const dateText = ok && row.completed_on
    ? `Completed ${prettyDate(row.completed_on)}`
    : "";
  const plateUrl = ok ? `${origin}${plateFor(row)}` : null;

  try {
    return new ImageResponse(
      card({
        eyebrow: ok ? "VERIFIED CERTIFICATE" : "CERTIFICATE CHECK",
        name,
        programme,
        dateText,
        number: number || "",
        plateUrl,
      }),
      {
        width: 1200,
        height: 630,
        fonts,
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      },
    );
  } catch {
    // A broken picture is worse than a plain one, so never throw.
    return new ImageResponse(
      card({
        eyebrow: "CERTIFICATE CHECK",
        name: "Data-Lead Africa",
        programme: "Certificate verification",
        dateText: "",
        number: number || "",
        plateUrl: null,
      }),
      { width: 1200, height: 630, fonts },
    );
  }
}
