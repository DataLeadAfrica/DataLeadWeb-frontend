// Social preview robots do not run JavaScript, so they never see the tags the
// React app sets. This hands them a plain page carrying the right tags for one
// particular certificate. Real people never reach this: vercel.json only sends
// known preview robots here.
//
// Try it by hand in a browser:
//   /api/certificate-meta?number=DLA-2026-DAB-EXC-7K3Q9F
// You will see a small page. Use View Source to read the og: tags.

export const config = { runtime: "edge" };

// Same public "anon" key as the website's own JavaScript uses. Not a secret.
const SUPABASE_URL = "https://zndjhvcqrgusorflnkxd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZGpodmNxcmd1c29yZmxua3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTI3NTEsImV4cCI6MjEwMDM4ODc1MX0.jgl7vnGsqWcN7TYplyyPOYlo2v_jlaA1SYhCqb0Qh9U";

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

export default async function handler(request) {
  const url = new URL(request.url);
  const number = (url.searchParams.get("number") || "").trim();
  const origin = url.origin;
  const pageUrl = `${origin}/certificate/${encodeURIComponent(number)}`;
  const imageUrl = `${origin}/api/og?number=${encodeURIComponent(number)}`;

  let row = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_certificate`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_number: number }),
    });
    if (res.ok) {
      const rows = await res.json();
      row = (Array.isArray(rows) ? rows[0] : null) || null;
    }
  } catch {
    row = null;
  }

  const ok = row && row.found && !row.revoked;
  const programme =
    (row && (row.is_module && row.module_title
      ? row.module_title
      : row.programme_title)) || "";

  const title = ok
    ? `${row.full_name} | ${programme} | Data-Lead Africa`
    : "Certificate | Data-Lead Africa";

  const description = ok
    ? `${row.full_name} completed the ${programme} programme with Data-Lead Africa` +
      (row.completed_on ? ` on ${prettyDate(row.completed_on)}` : "") +
      `. Certificate number ${number}. Verify it at dataleadafrica.com.`
    : "A Data-Lead Africa training certificate. Check any certificate number at dataleadafrica.com.";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(pageUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Data-Lead Africa" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(pageUrl)}" />
<meta property="og:image" content="${esc(imageUrl)}" />
<meta property="og:image:secure_url" content="${esc(imageUrl)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(title)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(imageUrl)}" />
<meta http-equiv="refresh" content="0; url=${esc(pageUrl)}" />
</head>
<body>
<p>Redirecting to <a href="${esc(pageUrl)}">${esc(pageUrl)}</a></p>
<script>location.replace(${JSON.stringify(pageUrl)});</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=3600",
    },
  });
}
