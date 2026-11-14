"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("provider-feed diagnostics require an administrator session at the HTTP boundary", () => {
  const source = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
  const guard = 'if (incoming.pathname === "/api/rooms" && incoming.searchParams.get("diagnostics") === "1" && !validDashboardSession(req))';
  const guardIndex = source.indexOf(guard);
  const delegatedHandlerIndex = source.indexOf("return handler(req, res);");

  assert.notEqual(guardIndex, -1, "diagnostics guard must exist in the outer HTTP middleware");
  assert.ok(guardIndex < delegatedHandlerIndex, "diagnostics guard must run before the public server handler");
  assert.match(source.slice(guardIndex, guardIndex + 400), /sendJson\(res, 401, \{ error: "Unauthorized" \}\)/);
  assert.match(source, /function validDashboardSession\(req\)/);
});

test("ordinary public room summaries remain outside the diagnostics-only authentication guard", () => {
  const source = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
  const guardStart = source.indexOf('if (incoming.pathname === "/api/rooms" && incoming.searchParams.get("diagnostics") === "1"');
  assert.notEqual(guardStart, -1);
  const guard = source.slice(guardStart, source.indexOf("\n    }", guardStart) + 6);
  assert.match(guard, /searchParams\.get\("diagnostics"\) === "1"/);
  assert.doesNotMatch(guard, /summary/);
});
