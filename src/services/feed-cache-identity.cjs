"use strict";

const crypto = require("node:crypto");
const { isIso3166Alpha2 } = require("./iso-country-codes.cjs");

function buildFeedCacheKey({ country, clientIp } = {}) {
  const candidateCountry = String(country || "").trim().toUpperCase();
  const normalizedCountry = /^[A-Z]{2}$/.test(candidateCountry) && isIso3166Alpha2(candidateCountry) ? candidateCountry : "UNKNOWN";
  const normalizedIp = String(clientIp || "").trim();
  if (!normalizedIp) throw new TypeError("A client IP is required to build a feed cache key.");
  const digest = crypto.createHash("sha256").update(normalizedIp).digest("hex").slice(0, 48);
  // Both providers receive visitor-IP context. Never share or persist a country-only snapshot.
  return "ip:" + normalizedCountry + ":" + digest;
}

module.exports = { buildFeedCacheKey };
