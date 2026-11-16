"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSmokeChecks, validateSmokeResponse, runSmokeChecks } = require("../src/services/production-smoke.cjs");

function response(status, body, contentType = "application/json") {
  return { status, headers: { get(name) { return name.toLowerCase() === "content-type" ? contentType : null; } }, async text() { return body; } };
}

function validate(check, status, body, contentType = "application/json") {
  return validateSmokeResponse(check, response(status, body, contentType), body);
}

test("smoke checks use only read-only GET routes and exclude tracked affiliate redirects", () => {
  const checks = buildSmokeChecks("https://nightcamfinds.com");
  assert.ok(checks.every((check) => check.url.startsWith("https://nightcamfinds.com/")));
  assert.ok(checks.every((check) => check.path === "/" || !/^\/(go|bgo)\//.test(check.path)));
  assert.ok(checks.every((check) => !check.path.includes("diagnostics=1")));
  assert.ok(checks.every((check) => !check.path.startsWith("/api/stats")));
});

test("smoke check URL validation rejects unsafe or ambiguous origins", () => {
  assert.throws(() => buildSmokeChecks("javascript:alert(1)"), /HTTP or HTTPS/);
  assert.throws(() => buildSmokeChecks("https://user:pass@example.com"), /credentials/);
  assert.throws(() => buildSmokeChecks("https://example.com/?secret=value"), /query/);
});

test("health and provider feed contracts validate their response shapes", () => {
  assert.deepEqual(validate({ expectedStatus: 200, kind: "health" }, 200, '{"ok":true}'), { ok: true, status: 200 });
  assert.deepEqual(validate({ expectedStatus: 200, kind: "room-summary" }, 200, '{"liveCount":12,"platforms":["chaturbate"]}'), { ok: true, status: 200 });
  assert.deepEqual(validate({ expectedStatus: 200, kind: "bonga-feed" }, 200, '{"rooms":[],"platform":"bongacams"}'), { ok: true, status: 200 });
});

test("smoke check fails on malformed feeds, unhealthy status, and unexpected redirects", () => {
  assert.equal(validate({ expectedStatus: 200, kind: "health" }, 200, '{"ok":false}').ok, false);
  assert.equal(validate({ expectedStatus: 200, kind: "bonga-feed" }, 200, '{"rooms":[]}').ok, false);
  assert.equal(validate({ expectedStatus: 200, kind: "html" }, 302, "", "text/html").reason, "unexpected_http_status");
});

test("dashboard and provider callback checks require safe unauthenticated rejection", () => {
  assert.equal(validate({ expectedStatus: 401, kind: "unauthorized" }, 401, '{"error":"Unauthorized"}').ok, true);
  assert.equal(validate({ expectedStatus: [403, 503], kind: "callback-rejected" }, 403, '{"error":"Invalid postback authentication."}').ok, true);
  assert.equal(validate({ expectedStatus: 410, kind: "gone" }, 410, '{"error":"BongaCash postbacks are not supported. Use manual affiliate-report reconciliation."}').ok, true);
  assert.equal(validate({ expectedStatus: 401, kind: "unauthorized" }, 200, '{"ok":true}').ok, false);
});

test("runner performs sequential GET requests without following redirects", async () => {
  const seen = [];
  const result = await runSmokeChecks({
    baseUrl: "https://nightcamfinds.com",
    fetchImpl: async (url, options) => {
      seen.push({ url, options });
      const check = buildSmokeChecks("https://nightcamfinds.com").find((item) => item.url === url);
      if (check.kind === "html") return response(200, "<html><body>NightCamFinds</body></html>", "text/html; charset=utf-8");
      if (check.kind === "health") return response(200, '{"ok":true}');
      if (check.kind === "room-summary") return response(200, '{"liveCount":5,"platforms":["chaturbate","bongacams"]}');
      if (check.kind === "bonga-feed") return response(200, '{"rooms":[],"platform":"bongacams"}');
      if (check.kind === "unauthorized") return response(401, '{"error":"Unauthorized"}');
      if (check.kind === "callback-rejected") return response(503, '{"error":"Postback authentication is not configured."}');
      return response(410, '{"error":"BongaCash postbacks are not supported. Use manual affiliate-report reconciliation."}');
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.passed, result.total);
  assert.equal(seen.length, result.total);
  assert.ok(seen.every(({ options }) => options.method === "GET" && options.redirect === "manual"));
});

test("runner reports individual failures without stopping later checks", async () => {
  let count = 0;
  const checks = buildSmokeChecks("https://nightcamfinds.com");
  const result = await runSmokeChecks({
    baseUrl: "https://nightcamfinds.com",
    fetchImpl: async () => {
      count += 1;
      if (count === 1) throw new Error("simulated network failure");
      return response(200, "<html></html>", "text/html");
    }
  });
  assert.equal(result.results.length, checks.length);
  assert.ok(result.failed >= 1);
  assert.equal(result.results[0].reason, "request_failed");
  assert.equal(count, checks.length);
  assert.ok(result.results.slice(1).every((item) => item.reason !== "request_failed"));
});
