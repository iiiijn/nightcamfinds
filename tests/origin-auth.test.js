"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ORIGIN_HEADER, originRequestAllowed } = require("../src/services/origin-auth.cjs");
const { patchSource, MARKER } = require("../scripts/patch-origin-auth.js");

test("origin verification remains staged until the Cloudflare secret is configured", () => {
  assert.equal(originRequestAllowed({ pathname: "/", headers: {}, secret: "" }), true);
});

test("origin verification accepts the exact Cloudflare header secret", () => {
  assert.equal(originRequestAllowed({
    pathname: "/",
    headers: { [ORIGIN_HEADER]: "a-long-random-secret" },
    secret: "a-long-random-secret"
  }), true);
});

test("origin verification rejects missing, incorrect, and length-mismatched headers", () => {
  const secret = "a-long-random-secret";
  assert.equal(originRequestAllowed({ pathname: "/", headers: {}, secret }), false);
  assert.equal(originRequestAllowed({ pathname: "/", headers: { [ORIGIN_HEADER]: "wrong" }, secret }), false);
  assert.equal(originRequestAllowed({ pathname: "/", headers: { [ORIGIN_HEADER]: secret + "x" }, secret }), false);
});

test("Chaturbate callbacks retain their independent shared-secret authentication path", () => {
  const secret = "a-long-random-secret";
  for (const pathname of ["/api/chaturbate/postback", "/cb/postback"]) {
    assert.equal(originRequestAllowed({ pathname, headers: {}, secret }), true);
  }
});

test("patch adds the guard once and fails closed when the route entry point changes", () => {
  const source = [
    'const http = require("http");',
    'http.createServer = function routeDashboard(handler) {',
    '  return originalCreateServer.call(http, async (req, res) => {',
    '    const incoming = new URL(req.url, "http://localhost");',
    '    return handler(req, res);',
    '  });',
    '};'
  ].join("\n");
  const patched = patchSource(source);
  assert.match(patched, new RegExp(MARKER));
  assert.match(patched, /originRequestAllowed\(\{ headers: req\.headers, pathname: incoming\.pathname \}\)/);
  assert.equal(patchSource(patched), patched);
  assert.throws(() => patchSource('const http = require("http");\n// entry point moved'), /could not find the route request entry point/);
});
