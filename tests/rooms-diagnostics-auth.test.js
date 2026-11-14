"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { guardProviderFeedDiagnostics } = require("../src/services/provider-diagnostics-access.cjs");

function makeResponse() {
  return {
    status: null,
    body: null,
    headers: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; }
  };
}

function makeRequest(url, isValidSession) {
  const res = makeResponse();
  let responseCount = 0;
  const blocked = guardProviderFeedDiagnostics({
    pathname: new URL(url, "http://localhost").pathname,
    searchParams: new URL(url, "http://localhost").searchParams,
    req: { headers: { cookie: "" } },
    res,
    isValidSession,
    sendJson(response, status, data) {
      responseCount += 1;
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(data));
    }
  });
  return { blocked, res, responseCount };
}

test("unauthenticated provider-feed diagnostics return HTTP 401 JSON", () => {
  const result = makeRequest("/api/rooms?summary=1&diagnostics=1", () => false);
  assert.equal(result.blocked, true);
  assert.equal(result.responseCount, 1);
  assert.equal(result.res.status, 401);
  assert.deepEqual(JSON.parse(result.res.body), { error: "Unauthorized" });
});

test("a valid administrator session is allowed to request provider-feed diagnostics", () => {
  const result = makeRequest("/api/rooms?summary=1&diagnostics=1", () => true);
  assert.equal(result.blocked, false);
  assert.equal(result.responseCount, 0);
  assert.equal(result.res.status, null);
});

test("ordinary public room summaries remain accessible without an administrator session", () => {
  const result = makeRequest("/api/rooms?summary=1", () => false);
  assert.equal(result.blocked, false);
  assert.equal(result.responseCount, 0);
  assert.equal(result.res.status, null);
});

test("malformed session-cookie validation fails closed with HTTP 401", () => {
  const result = makeRequest("/api/rooms?summary=1&diagnostics=1", () => {
    throw new URIError("Malformed cookie encoding");
  });
  assert.equal(result.blocked, true);
  assert.equal(result.res.status, 401);
  assert.deepEqual(JSON.parse(result.res.body), { error: "Unauthorized" });
});

test("the outer HTTP middleware invokes the tested guard before the public server handler", () => {
  const source = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
  const guardIndex = source.indexOf("if (guardProviderFeedDiagnostics({");
  const delegatedHandlerIndex = source.indexOf("return handler(req, res);");

  assert.notEqual(guardIndex, -1, "route.js must call the shared diagnostics guard");
  assert.ok(guardIndex < delegatedHandlerIndex, "diagnostics guard must run before the public server handler");
  assert.match(source, /isValidSession:\s*validDashboardSession/);
  assert.match(source, /sendJson\s*$/m);
});
