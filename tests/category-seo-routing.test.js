const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const patch = fs.readFileSync("scripts/patch-spa-seo-routes.js", "utf8");
const server = fs.readFileSync("server.js", "utf8");

test("category directory requests are not rewritten to the homepage", () => {
  const match = patch.match(/const NCF_SEO_PATHS_V14 = new Set\\(\\[([\\s\\S]*?)\\]\\);/);
  assert.ok(match, "SEO route allowlist exists");
  for (const route of ["/live/", "/female/", "/male/", "/trans/", "/couples/", "/hd/", "/new/", "/popular/", "/countries/"]) {
    assert.ok(!match[1].includes(JSON.stringify(route)), `${route} must reach server.js unchanged`);
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
  assert.ok(patch.includes('"/broadcast"'));
  assert.ok(patch.includes('"/"'));
});
