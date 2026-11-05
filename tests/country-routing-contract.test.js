"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const patch = fs.readFileSync(path.join(__dirname, "..", "scripts", "patch-spa-seo-routes.js"), "utf8");
const countryPatch = require("../scripts/patch-country-directory.js");
const patchedServer = countryPatch.patchServerSource(server);

test("country URLs reach the dedicated server-rendered country page handler", () => {
  const route = patchedServer.indexOf("const countryRoute = pathname.match");
  const fallback = patchedServer.indexOf('const file=pathname==="/"||pathname.endsWith("/")?"/index.html":pathname;');
  assert.ok(route >= 0, "dedicated country route should exist");
  assert.ok(fallback > route, "country route must run before homepage/static fallback");
  assert.ok(patchedServer.slice(route, fallback).includes("getCountryPage(countryRoute[1], pageOrigin(req), roomMarkup, isIndexableCountryRooms(countryRooms))"));
  assert.ok(!patchedServer.includes("const countryMatch = pathname.match("), "unreachable duplicate country handler must be removed");
});

test("SEO request rewriting does not turn country URLs into the homepage URL", () => {
  assert.ok(patch.includes("if (NCF_SEO_PATHS_V14.has(pathname)) {"));
  assert.ok(!patch.includes('NCF_SEO_PATHS_V14.has(pathname) || /^\\/country'));
});
