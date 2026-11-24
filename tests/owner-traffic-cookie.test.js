'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const owner = require('../src/services/owner-traffic-cookie.cjs');
test('owner cookie is signed, purpose-bound, expiring and tamper resistant', () => {
  const now = Date.UTC(2026, 10, 16, 12, 0, 0);
  const token = owner.createOwnerCookie('test-secret', now);
  assert.equal(owner.verifyOwnerCookie(token, 'test-secret', now), true);
  assert.equal(owner.verifyOwnerCookie(token, 'wrong-secret', now), false);
  assert.equal(owner.verifyOwnerCookie(token + 'x', 'test-secret', now), false);
  assert.equal(owner.verifyOwnerCookie(token, 'test-secret', now + (13 * 60 * 60 * 1000)), false);
  assert.equal(owner.verifyOwnerCookie('not-a-token', 'test-secret', now), false);
});
test('owner cookie header is HttpOnly, strict same-site and clearable', () => {
  const active = owner.cookieHeader('signed.token', true);
  assert.match(active, /HttpOnly/);
  assert.match(active, /SameSite=Strict/);
  assert.match(active, /Secure/);
  assert.match(owner.cookieHeader('', true, true), /Max-Age=0/);
});
