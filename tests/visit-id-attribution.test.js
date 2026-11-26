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

test("keeps the cookie authoritative but flags a conflicting valid query ID", () => {
  assert.deepEqual(resolveVisitIdentity({
    cookieVisitId: existingId,
    queryVisitId: secondId,
    createVisitId: () => { throw new Error("must not generate"); }
  }), { visitId: existingId, origin: "cookie", identityConflict: true });
});

test("does not flag matching cookie and query visit IDs as a conflict", () => {
  assert.deepEqual(resolveVisitIdentity({
    cookieVisitId: existingId,
    queryVisitId: existingId,
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


test("campaign changes preserve the browsing visit ID and refresh landing attribution", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const helper = fs.readFileSync(path.join(__dirname, "../public/visit-tracking.js"), "utf8");
  const visitId = existingId;
  const session = new Map([
    ["ncf_visit_id", visitId],
    ["ncf_visit_campaign_key", "old|email|launch|a"],
    ["ncf_landing_path", "/"]
  ]);
  const cookies = new Map([["ncf_visit_id", visitId]]);
  const document = {
    documentElement: {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    getElementById() { return null; }
  };
  Object.defineProperty(document, "cookie", {
    get() { return [...cookies.entries()].map(([key, value]) => key + "=" + value).join("; "); },
    set(value) {
      const pair = String(value).split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  });
  const root = {
    document,
    location: {
      href: "https://nightcamfinds.com/country/us/?utm_source=newsletter&utm_medium=email&utm_campaign=spring",
      search: "?utm_source=newsletter&utm_medium=email&utm_campaign=spring",
      origin: "https://nightcamfinds.com",
      protocol: "https:",
      pathname: "/country/us/"
    },
    sessionStorage: {
      getItem(key) { return session.has(key) ? session.get(key) : null; },
      setItem(key, value) { session.set(key, String(value)); }
    },
    localStorage: { getItem() { return "denied"; } },
    crypto: {
      getRandomValues(bytes) {
        for (let i = 0; i < bytes.length; i++) bytes[i] = i + 1;
        return bytes;
      }
    }
  };
  vm.runInNewContext(helper, { window: root, URL, URLSearchParams, Uint8Array });
  assert.equal(root.NCFVisitTracking.getVisitId(), visitId);
  assert.equal(session.get("ncf_visit_id"), visitId);
  assert.equal(session.get("ncf_landing_path"), "/country/us/");
  assert.equal(cookies.get("ncf_visit_id"), visitId);
});
