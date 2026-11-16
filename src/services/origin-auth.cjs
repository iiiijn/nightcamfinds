"use strict";

const crypto = require("node:crypto");

const ORIGIN_HEADER = "x-ncf-origin-verify";
const PROVIDER_CALLBACK_PATHS = new Set([
  "/api/chaturbate/postback",
  "/cb/postback"
]);

function originRequestAllowed({ headers = {}, pathname = "", secret = process.env.CF_ORIGIN_VERIFY_SECRET || "" } = {}) {
  const expected = String(secret || "");
  if (!expected) return true; // Deliberately staged: enable only after the Cloudflare rule is deployed.
  if (PROVIDER_CALLBACK_PATHS.has(String(pathname))) return true; // These endpoints enforce their own provider shared secret.
  const supplied = String(headers[ORIGIN_HEADER] || "");
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return expectedBytes.length === suppliedBytes.length &&
    crypto.timingSafeEqual(expectedBytes, suppliedBytes);
}

module.exports = { ORIGIN_HEADER, PROVIDER_CALLBACK_PATHS, originRequestAllowed };
