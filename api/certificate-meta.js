// Serves the certificate page with the right sharing tags baked into it.
//
// EARLIER APPROACH, AND WHY IT IS GONE
// This used to run only for visitors whose user agent looked like a social
// crawler. Everyone else got the plain React app. That relied on a list of
// user agent strings, which is a guess that can only be proved wrong in
// production and cannot be checked from a browser. It is now removed.
//
// This function now answers EVERY request for /certificate/... It fetches the
// app's own index.html, swaps in the tags for this particular certificate and
// returns it. The browser then boots the React app exactly as before, so
// people see no difference. Crawlers, which do not run JavaScript, get the
// correct tags because they are already sitting in the HTML.
//
// You can check this yourself without LinkedIn: open a certificate page in a
// browser and use View Page Source. The og:image line should name the
// certificate.

export const config = { runtime: "edge" };

// Same public "anon" key the website's own JavaScript uses. Not a secret.
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

  // request.url does not reliably carry the address the visitor actually used,
  // so build it from the headers Vercel sets.
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.host;
  const origin = `${proto}://${host}`;

  const pageUrl = `${origin}/certificate/${encodeURIComponent(number)}`;
  const imageUrl = `${origin}/api/og?number=${encodeURIComponent(number)}`;

  // The app shell. index.html is a real file, so this request is answered from
  // disk rather than coming back through the rewrite rule. It cannot loop.
  let shell = "";
  try {
    const res = await fetch(`${origin}/index.html`);
    if (res.ok) shell = await res.text();
  } catch {
    shell = "";
  }

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

  const tags = `
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
`;

  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    // Never let a shell be cached across deployments, or it could end up
    // pointing at JavaScript files that no longer exist.
    "Cache-Control": "public, max-age=0, must-revalidate",
  };

  if (shell) {
    // Strip the site wide tags first, so a crawler cannot pick up the generic
    // ones in place of this certificate's.
    let out = shell
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
      .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
      .replace(/<meta\s+name="description"[^>]*>/gi, "")
      .replace(/<link\s+rel="canonical"[^>]*>/gi, "");

    out = out.match(/<\/head>/i)
      ? out.replace(/<\/head>/i, `${tags}</head>`)
      : tags + out;

    return new Response(out, { status: 200, headers });
  }

  // Could not reach the app shell. Serve a plain page carrying the tags, with
  // a link rather than an automatic redirect so there is no chance of a loop.
  const fallback = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${tags}
</head>
<body>
<p><a href="${esc(pageUrl)}">View this certificate</a></p>
</body>
</html>`;
  return new Response(fallback, { status: 200, headers });
}
