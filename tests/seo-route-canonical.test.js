const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalSeoRedirectPath } = require("../src/services/seo-route-canonical.cjs");

test("live route variants canonicalize to the homepage", () => {
  assert.equal(canonicalSeoRedirectPath("/live"), "/");
  assert.equal(canonicalSeoRedirectPath("/live/"), "/");
});

test("broadcast has one non-trailing-slash canonical URL", () => {
  assert.equal(canonicalSeoRedirectPath("/broadcast/"), "/broadcast");
  assert.equal(canonicalSeoRedirectPath("/broadcast"), null);
});

test("category and country routes keep their established trailing-slash canonicals", () => {
  for (const route of ["/female", "/male", "/trans", "/couples", "/hd", "/new", "/popular", "/countries"]) {
    assert.equal(canonicalSeoRedirectPath(route), route + "/");
  }
  assert.equal(canonicalSeoRedirectPath("/country/us"), "/country/us/");
  assert.equal(canonicalSeoRedirectPath("/country/US"), "/country/US/");
  assert.equal(canonicalSeoRedirectPath("/country/us/"), null);
});

test("unrelated paths are not redirected", () => {
  for (const route of ["/", "/broadcast.html", "/country/usa/", "/api/rooms", "/sitemap.xml"]) {
    assert.equal(canonicalSeoRedirectPath(route), null);
  }
});

test("XML sitemap source excludes redirecting live route and keeps broadcast canonical destination", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const sitemapMatch = server.match(/function sitemap\(origin, eligibleCountrySlugs = \[\]\) \{ const paths = \[(.*?)\];/);
  assert.ok(sitemapMatch, "sitemap path list should be present");
  assert.doesNotMatch(sitemapMatch[1], /["']\/live\/?["']/);
  assert.match(sitemapMatch[1], /["']\/broadcast["']/);

  const broadcastHtml = fs.readFileSync(path.join(__dirname, "..", "public", "broadcast.html"), "utf8");
  assert.match(broadcastHtml, /<link rel="canonical" href="https:\/\/nightcamfinds\.com\/broadcast">/);
  assert.doesNotMatch(broadcastHtml, /<link rel="canonical" href="https:\/\/nightcamfinds\.com\/broadcast\/">/);
  assert.equal(canonicalSeoRedirectPath("/broadcast/"), "/broadcast");
});
