"use strict";

const DEFAULT_TIMEOUT_MS = 15000;

function buildSmokeChecks(baseUrl) {
  const base = new URL(baseUrl);
  if (!["http:", "https:"].includes(base.protocol)) throw new TypeError("Smoke-test base URL must use HTTP or HTTPS.");
  if (base.username || base.password || base.search || base.hash) throw new TypeError("Smoke-test base URL must not contain credentials, query, or fragment.");
  base.pathname = base.pathname.replace(/\/+$/, "") + "/";
  const url = (path) => new URL(path.replace(/^\/+/, ""), base).toString();
  return [
    { name: "homepage", path: "/", expectedStatus: 200, kind: "html" },
    ...["live", "female", "male", "trans", "couples", "hd", "new", "popular", "countries"].map((path) => ({ name: path + " category page", path: "/" + path + "/", expectedStatus: 200, kind: "html" })),
    { name: "health endpoint", path: "/api/health", expectedStatus: 200, kind: "health" },
    { name: "Chaturbate room summary", path: "/api/rooms?summary=1", expectedStatus: 200, kind: "room-summary" },
    { name: "BongaCams room feed", path: "/api/bonga-rooms", expectedStatus: 200, kind: "bonga-feed" },
    { name: "dashboard shell", path: "/dashboard", expectedStatus: 200, kind: "html" },
    { name: "dashboard stats reject anonymous access", path: "/api/dashboard-stats", expectedStatus: 401, kind: "unauthorized" },
    { name: "Chaturbate callback rejects unauthenticated probe", path: "/api/chaturbate/postback", expectedStatus: [403, 503], kind: "callback-rejected" },
    { name: "legacy Chaturbate callback rejects unauthenticated probe", path: "/cb/postback", expectedStatus: [403, 503], kind: "callback-rejected" },
    { name: "BongaCash callback remains explicitly unsupported", path: "/api/bongacash/postback", expectedStatus: 410, kind: "gone" }
  ].map((check) => ({ ...check, url: url(check.path) }));
}

function validateSmokeResponse(check, response, body) {
  const accepted = Array.isArray(check.expectedStatus) ? check.expectedStatus : [check.expectedStatus];
  if (!accepted.includes(response.status)) return { ok: false, reason: "unexpected_http_status", expected: accepted, actual: response.status };
  if (response.status >= 300 && response.status < 400) return { ok: false, reason: "unexpected_redirect", location: response.headers?.get?.("location") || null };
  let payload = null;
  if (check.kind === "html") {
    if (!/text\/html/i.test(response.headers?.get?.("content-type") || "") || !/<html[\s>]/i.test(body)) return { ok: false, reason: "invalid_html_response" };
  } else if (check.kind !== "callback-rejected" && check.kind !== "gone") {
    try { payload = JSON.parse(body); } catch { return { ok: false, reason: "invalid_json_response" }; }
  }
  if (check.kind === "health" && payload?.ok !== true) return { ok: false, reason: "health_not_ok" };
  if (check.kind === "room-summary" && (!Number.isFinite(payload?.liveCount) || !Array.isArray(payload?.platforms))) return { ok: false, reason: "invalid_room_summary_shape" };
  if (check.kind === "bonga-feed" && (!Array.isArray(payload?.rooms) || payload?.platform !== "bongacams")) return { ok: false, reason: "invalid_bongacams_feed_shape" };
  if (check.kind === "unauthorized" && payload?.error !== "Unauthorized") return { ok: false, reason: "dashboard_auth_not_enforced" };
  if (check.kind === "callback-rejected" && !/authentication|configured|unauthorized/i.test(body)) return { ok: false, reason: "callback_rejection_not_explicit" };
  if (check.kind === "gone" && !/not supported|manual affiliate-report/i.test(body)) return { ok: false, reason: "unexpected_bongacash_callback_response" };
  return { ok: true, status: response.status };
}

async function runSmokeChecks({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  const checks = buildSmokeChecks(baseUrl);
  const results = [];
  for (const check of checks) {
    try {
      const response = await fetchImpl(check.url, {
        method: "GET", redirect: "manual",
        headers: { accept: check.kind === "html" ? "text/html" : "application/json", "user-agent": "NightCamFinds-ReadOnly-SmokeTest/1.0" },
        signal: AbortSignal.timeout(timeoutMs)
      });
      const validation = validateSmokeResponse(check, response, await response.text());
      results.push({ name: check.name, path: check.path, ...validation });
    } catch (error) {
      results.push({ name: check.name, path: check.path, ok: false, reason: "request_failed", error: String(error?.message || error) });
    }
  }
  return { ok: results.every((result) => result.ok), total: results.length, passed: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length, results };
}

module.exports = { buildSmokeChecks, validateSmokeResponse, runSmokeChecks };
