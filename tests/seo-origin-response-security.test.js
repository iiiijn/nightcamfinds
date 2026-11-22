const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const server = fs.readFileSync("server.js", "utf8");
const route = fs.readFileSync("route.js", "utf8");
const patch = fs.readFileSync("scripts/patch-spa-seo-routes.js", "utf8");

test("canonical origin ignores Host and forwarded host/proto headers", () => {
  assert.match(server, /function pageOrigin\(_req\)\s*\{\s*return "https:\/\/nightcamfinds\.com";\s*\}/);
  assert.doesNotMatch(server, /function pageOrigin\([^)]*\)\s*\{[^}]*req\.headers\.(?:host|"x-forwarded-host"|"x-forwarded-proto")/s);
  assert.match(server, /const origin = "https:\/\/nightcamfinds\.com";/);
});

test("SEO route middleware does not buffer or replace response write/end", () => {
  assert.doesNotMatch(route, /ncfApplySeoRouteMetadata/);
  assert.doesNotMatch(route, /seoBuffered(?:Write|End)/);
  assert.doesNotMatch(patch, /res\.write\s*=|res\.end\s*=/);
});

test("slash redirects are limited to GET and HEAD requests", () => {
  assert.match(patch, /if \(req\.method !== "GET" && req\.method !== "HEAD"\) return false;/);
});
