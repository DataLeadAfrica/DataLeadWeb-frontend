// Keeps api/_site-routes.js honest against src/pages/routes.ts.
//
// The sitemap needs the site's addresses, and an edge function cannot
// import TypeScript, so they are written out twice. Two lists of the
// same thing drift apart, and nobody notices, because a missing page in
// a sitemap does not break anything: it just quietly never gets crawled.
//
// This reads routes.ts, works out which routes are public, and fails if
// the JavaScript list disagrees. Add a page and forget the sitemap, and
// this test is what tells you.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PUBLIC_ROUTES, NOT_IN_SITEMAP } from "../api/_site-routes.js";

function readRoutesTs() {
  const src = readFileSync(new URL("../src/pages/routes.ts", import.meta.url), "utf8");
  const out = {};
  // key: "value", across one or more lines.
  const re = /(\w+)\s*:\s*\n?\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) out[m[1]] = m[2];
  return out;
}

test("every route in routes.ts is either in the sitemap or deliberately left out", () => {
  const routes = readRoutesTs();
  assert.ok(Object.keys(routes).length > 50, "routes.ts was read");

  const missing = [];
  for (const [key, path] of Object.entries(routes)) {
    if (NOT_IN_SITEMAP[key]) continue;
    if (!PUBLIC_ROUTES.includes(path)) missing.push(`${key} (${path})`);
  }

  assert.deepEqual(
    missing,
    [],
    "These are in routes.ts but in neither list. Add each to PUBLIC_ROUTES in " +
      "api/_site-routes.js, or to NOT_IN_SITEMAP with the reason:\n  " +
      missing.join("\n  "),
  );
});

test("nothing in the sitemap list has gone from routes.ts", () => {
  const paths = new Set(Object.values(readRoutesTs()));
  const stale = PUBLIC_ROUTES.filter((p) => !paths.has(p));
  assert.deepEqual(stale, [], `no longer in routes.ts: ${stale.join(", ")}`);
});

test("nothing with a parameter in it reached the sitemap list", () => {
  const withParams = PUBLIC_ROUTES.filter((p) => p.includes(":"));
  assert.deepEqual(withParams, []);
});

test("every reason for leaving a route out names a real route", () => {
  const routes = readRoutesTs();
  const unknown = Object.keys(NOT_IN_SITEMAP).filter((k) => !routes[k]);
  assert.deepEqual(unknown, [], `not in routes.ts any more: ${unknown.join(", ")}`);
});
