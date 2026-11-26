"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const session = require("../src/services/dashboard-session.cjs");

const secret = "test-session-secret-with-sufficient-entropy";
const username = "admin";
const now = 1_800_000_000_000;

function cookieFor(token) {
  return `other=value; ncf_session=${encodeURIComponent(token)}`;
}

test("creates a session token accepted by the shared validator", () => {
  const token = session.createSessionToken({ username, secret, now, nonce: "test-nonce" });
  assert.equal(session.isValidSession(cookieFor(token), { secret, username, now }), true);
});

test("rejects missing, malformed, tampered, and wrong-user sessions", () => {
  const token = session.createSessionToken({ username, secret, now, nonce: "test-nonce" });
  assert.equal(session.isValidSession("", { secret, username, now }), false);
  assert.equal(session.isValidSession("ncf_session=bad.token", { secret, username, now }), false);
  assert.equal(session.isValidSession(cookieFor(token + "x"), { secret, username, now }), false);
  assert.equal(session.isValidSession(cookieFor(token), { secret, username: "another-admin", now }), false);
});

test("enforces the twelve-hour expiry and limited clock skew", () => {
  const token = session.createSessionToken({ username, secret, now, nonce: "test-nonce" });
  assert.equal(session.isValidSession(cookieFor(token), { secret, username, now: now + session.SESSION_TTL_MS }), true);
  assert.equal(session.isValidSession(cookieFor(token), { secret, username, now: now + session.SESSION_TTL_MS + 1 }), false);
  assert.equal(session.isValidSession(cookieFor(token), { secret, username, now: now - 60_001 }), false);
});

test("ignores malformed cookie encoding without throwing", () => {
  assert.doesNotThrow(() => session.parseCookies("ncf_session=%E0%A4%A; theme=dark"));
  assert.equal(session.isValidSession("ncf_session=%E0%A4%A", { secret, username, now }), false);
});

test("emits a host-only secure HttpOnly session cookie", () => {
  const header = session.cookieHeader("token.value", 60);
  assert.match(header, /^ncf_session=token.value;/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=Strict/);
  assert.doesNotMatch(header, /Domain=/i);
});
