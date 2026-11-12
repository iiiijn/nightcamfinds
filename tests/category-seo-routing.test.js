const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const patch = fs.readFileSync("scripts/patch-spa-seo-routes.js", "utf8");
const server = fs.readFileSync("server.js", "utf8");

test("category directory requests are not rewritten to the homepage", () => {
  const start = patch.indexOf("const NCF_SEO_PATHS_V14 = new Set([");
  const end = start >= 0 ? patch.indexOf("]);", start) : -1;
  assert.ok(start >= 0 && end > start, "SEO route allowlist exists");
  const allowlist = patch.slice(start, end);
  for (const route of ["/live/", "/female/", "/male/", "/trans/", "/couples/", "/hd/", "/new/", "/popular/", "/countries/"]) {
    assert.ok(!allowlist.includes(JSON.stringify(route)), `${route} must reach server.js unchanged`);
  }
});

test("category routes retain server-rendered content and canonical URLs", () => {
  for (const route of ["female", "male", "trans", "couples", "hd", "new", "popular", "countries"]) {
    assert.ok(server.includes(`${route}:[`), `server.js has distinct ${route} page copy`);
  }
  assert.ok(server.includes('replaceAll("__CANONICAL__", `${pageOrigin(req)}${pathname}`)'));
  assert.ok(server.includes("html = renderHeroCopy(html, copy)"));
  assert.ok(server.includes('const roomMarkup = renderRoomCards(list,{category,pagePath:pathname,home})'));
});

test("slash redirects and broadcast SPA metadata remain supported", () => {
  assert.ok(patch.includes("ncfRedirectSeoNoSlashV14"));
  assert.ok(patch.includes('pathname === "/broadcast" ? "/broadcast.html"'));
  assert.ok(patch.includes('"/broadcast": {'));
  assert.ok(patch.includes('"/"'));
  const allowlistStart = patch.indexOf("const NCF_SEO_PATHS_V14 = new Set([");
  const allowlistEnd = patch.indexOf("]);", allowlistStart);
  assert.ok(patch.slice(allowlistStart, allowlistEnd).includes('"/broadcast"'));
});
