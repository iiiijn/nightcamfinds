'use strict';
const crypto = require('node:crypto');
const COOKIE_NAME = 'ncf_owner_traffic';
const DEFAULT_TTL_SECONDS = 43200;
function sign(secret, expiresAt) { return crypto.createHmac('sha256', String(secret)).update('nightcamfinds.owner-traffic.v1.' + String(expiresAt)).digest('base64url'); }
function createOwnerCookie(secret, now = Date.now()) { if (!secret) throw new TypeError('Session secret required'); const expiresAt = Math.floor(now / 1000) + DEFAULT_TTL_SECONDS; return expiresAt + '.' + sign(secret, expiresAt); }
function verifyOwnerCookie(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2 || parts[0].length !== 10 || !Array.from(parts[0]).every(ch => ch >= '0' && ch <= '9')) return false;
  const expiry = Number(parts[0]), current = Math.floor(now / 1000);
  if (!Number.isSafeInteger(expiry) || expiry <= current || expiry > current + DEFAULT_TTL_SECONDS + 60) return false;
  const expected = Buffer.from(sign(secret, expiry)), supplied = Buffer.from(parts[1]);
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}
function cookieHeader(token, secure = true, clear = false) { return COOKIE_NAME + '=' + (clear ? '' : encodeURIComponent(token)) + '; Path=/; HttpOnly; SameSite=Strict' + (secure ? '; Secure' : '') + (clear ? '; Max-Age=0' : '; Max-Age=' + DEFAULT_TTL_SECONDS); }
module.exports = { COOKIE_NAME, DEFAULT_TTL_SECONDS, createOwnerCookie, verifyOwnerCookie, cookieHeader };
