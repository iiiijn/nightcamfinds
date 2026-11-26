"use strict";

const crypto = require("crypto");

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function parseCookies(header) {
  const cookies = {};
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const rawValue = part.slice(index + 1).trim();
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      // Ignore malformed cookie values instead of failing the whole request.
    }
  }
  return cookies;
}

function createSessionToken({ username, secret, now = Date.now(), nonce = crypto.randomBytes(18).toString("hex") }) {
  if (!secret) throw new Error("Dashboard session secret is not configured");
  const payload = `${username}.${now}.${nonce}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function isValidSession(cookieHeader, { secret, username, now = Date.now() }) {
  if (!secret) return false;
  const token = parseCookies(cookieHeader).ncf_session;
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [tokenUsername, issuedAt, nonce, signature] = parts;
  const issued = Number(issuedAt);
  if (!nonce || !Number.isFinite(issued)) return false;
  const payload = `${tokenUsername}.${issuedAt}.${nonce}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return safeEqual(signature, expected) &&
    tokenUsername === username &&
    now - issued <= SESSION_TTL_MS &&
    now >= issued - CLOCK_SKEW_MS;
}

function cookieHeader(value, maxAgeSeconds = SESSION_TTL_MS / 1000) {
  const age = Math.max(0, Math.floor(Number(maxAgeSeconds) || 0));
  return `ncf_session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}

module.exports = {
  SESSION_TTL_MS,
  parseCookies,
  createSessionToken,
  isValidSession,
  cookieHeader
};
