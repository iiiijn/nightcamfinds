'use strict';

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validVisitId,
  resolveVisitIdentity,
  buildVisitCookieHeaders
} = require("../src/services/visit-id-attribution.cjs");

const existingId = "0123456789abcdef0123456789abcdef";
const secondId = "abcdef0123456789abcdef0123456789";

test("validates 32-character hexadecimal visit IDs", () => {
  assert.equal(validVisitId(existingId), true);
  assert.equal(validVisitId("not-a-visit-id"), false);
  assert.equal(validVisitId("0123"), false);
});

test("prefers the first-party cookie over a query visit ID", () => {
  assert.deepEqual(resolveVisitIdentity({
    cookieVisitId: existingId,
    queryVisitId: secondId,
    createVisitId: () => { throw new Error("must not generate"); }
  }), { visitId: existingId, origin: "cookie" });
});

test("uses a valid query visit ID when the cookie is unavailable", () => {
  assert.deepEqual(resolveVisitIdentity({
    cookieVisitId: "",
    queryVisitId: secondId,
    createVisitId: () => { throw new Error("must not generate"); }
  }), { visitId: secondId, origin: "query" });
});

test("creates a marked fallback ID when query and cookie are absent or invalid", () => {
  assert.deepEqual(resolveVisitIdentity({
    cookieVisitId: "invalid",
    queryVisitId: "",
    createVisitId: () => secondId
  }), { visitId: secondId, origin: "redirect_fallback" });
});

test("persists fallback IDs and landing paths with safe cookie attributes", () => {
  const cookies = buildVisitCookieHeaders({
    existingVisitCookie: "",
    existingLandingCookie: "",
    visitId: existingId,
    landingPath: "/female/",
    secure: true
  });
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /^ncf_visit_id=[a-f0-9]{32}; Path=\/; SameSite=Lax; Secure$/);
  assert.match(cookies[1], /^ncf_landing_path=%2Ffemale%2F; Path=\/; SameSite=Lax; Secure$/);
});

test("does not overwrite established cookies or persist unsafe landing paths", () => {
  const cookies = buildVisitCookieHeaders({
    existingVisitCookie: existingId,
    existingLandingCookie: "/",
    visitId: secondId,
    landingPath: "//evil.example/path"
  });
  assert.deepEqual(cookies, []);
});
