"use strict";

const { normalizeCountryCode } = require("./country-directory.cjs");
const { getRoomRejectionReason } = require("./room-quality.cjs");
const { normalizeBongaCountry } = require("./bonga-country-normalizer.cjs");

function rawCountryValue(row, provider) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return { present: false, value: "" };
  const fields = provider === "bongacams"
    ? ["homecountry", "country", "country_code"]
    : ["country"];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
    const value = row[field];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return { present: true, value: text.slice(0, 80) };
    }
  }
  return { present: fields.some(field => Object.prototype.hasOwnProperty.call(row, field)), value: "" };
}

function safePagination(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    pagesFetched: Number.isInteger(input.pagesFetched) && input.pagesFetched >= 0 ? input.pagesFetched : null,
    receivedCount: Number.isInteger(input.receivedCount) && input.receivedCount >= 0 ? input.receivedCount : null,
    uniqueCount: Number.isInteger(input.uniqueCount) && input.uniqueCount >= 0 ? input.uniqueCount : null,
    duplicateCount: Number.isInteger(input.duplicateCount) && input.duplicateCount >= 0 ? input.duplicateCount : null,
    truncated: input.truncated === true,
    stopReason: ["short_page", "max_pages", "empty_page", "unknown"].includes(input.stopReason) ? input.stopReason : "unknown"
  };
}

function summarizeFeedIngestion({ provider, rawRows = [], entries = [], pagination = null } = {}) {
  const name = String(provider || "").toLowerCase();
  if (!["chaturbate", "bongacams"].includes(name)) throw new TypeError("Unsupported feed provider");
  const raw = Array.isArray(rawRows) ? rawRows : [];
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const countryCounts = new Map();
  let missingCountry = 0;
  let unrecognizedCountry = 0;
  for (const row of raw) {
    const rawCountry = rawCountryValue(row, name);
    if (!rawCountry.value) {
      if (rawCountry.present) unrecognizedCountry += 1;
      else missingCountry += 1;
      continue;
    }
    const code = name === "bongacams" ? normalizeBongaCountry(row) : normalizeCountryCode(rawCountry.value);
    if (!code) {
      unrecognizedCountry += 1;
      continue;
    }
    countryCounts.set(code, (countryCounts.get(code) || 0) + 1);
  }

  const rejectionReasons = {};
  let normalizedCount = 0;
  let acceptedCount = 0;
  let duplicateCount = 0;
  const seen = new Set();
  for (const entry of normalizedEntries) {
    const wrapped = entry && Object.prototype.hasOwnProperty.call(entry, "normalized");
    const room = wrapped ? entry.normalized : entry;
    const rawText = wrapped ? entry.rawText || "" : "";
    if (room) normalizedCount += 1;
    const reason = getRoomRejectionReason(room, rawText);
    if (reason) {
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
      continue;
    }
    if (seen.has(room.id)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(room.id);
    acceptedCount += 1;
  }

  return {
    provider: name,
    rawRoomCount: raw.length,
    normalizedRoomCount: normalizedCount,
    acceptedUniqueRoomCount: acceptedCount,
    rejectedRoomCount: Object.values(rejectionReasons).reduce((sum, count) => sum + count, 0),
    duplicateRoomCount: duplicateCount,
    missingCountryCount: missingCountry,
    unrecognizedCountryCount: unrecognizedCountry,
    countryCounts: [...countryCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([country, roomCount]) => ({ country, roomCount })),
    rejectionReasons,
    pagination: safePagination(pagination)
  };
}

module.exports = { summarizeFeedIngestion, rawCountryValue, safePagination };
