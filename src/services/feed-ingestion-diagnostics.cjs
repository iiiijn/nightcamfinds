"use strict";

const { normalizeCountryCode, resolveChaturbateCountry } = require("./country-directory.cjs");
const { getRoomRejectionReason } = require("./room-quality.cjs");
const { normalizeBongaCountry } = require("./bonga-country-normalizer.cjs");

function rawCountryValue(row, provider) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return { present: false, value: "" };
  const fields = provider === "bongacams"
    ? ["homecountry", "country", "country_code", "hometown"]
    : ["country"];
  let firstValue = "";
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
    const value = row[field];
    if (typeof value !== "string" && typeof value !== "number") continue;
    const text = String(value).trim();
    if (!text) continue;
    if (!firstValue) firstValue = text.slice(0, 80);
  }
  return { present: Boolean(firstValue), value: firstValue };
}

const CHATURBATE_METADATA_FIELDS = Object.freeze(["country", "location", "region", "region_name", "state", "province"]);

function summarizeMetadataFieldPresence(rows, fields = CHATURBATE_METADATA_FIELDS) {
  const source = Array.isArray(rows) ? rows : [];
  const allowed = fields.filter((field) => CHATURBATE_METADATA_FIELDS.includes(field));
  const counts = Object.fromEntries(allowed.map((field) => [field, 0]));
  for (const row of source) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    for (const field of allowed) {
      const value = row[field];
      const present = typeof value === "string" ? value.trim().length > 0
        : typeof value === "number" ? Number.isFinite(value)
        : Array.isArray(value) ? value.length > 0
        : Boolean(value && typeof value === "object");
      if (present) counts[field] += 1;
    }
  }
  return { inspectedRoomCount: source.length, fieldPresenceCounts: counts };
}

function classifyChaturbateLocation(value) {
  if (value === null || value === undefined || value === "") return "missing";
  if (typeof value !== "string") return "other_nonempty";
  const text = value.trim();
  if (!text) return "missing";
  if (normalizeCountryCode(text)) return "exact_country";
  const parts = text.split(",").map((part) => part.trim());
  if (parts.length === 2 && parts[0] && parts[1]) {
    return normalizeCountryCode(parts[1]) ? "city_country" : "comma_unrecognized";
  }
  if (text.includes(",")) return "other_nonempty";
  return "other_nonempty";
}

function summarizeChaturbateLocationShapes(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const counts = {
    missing: 0,
    exact_country: 0,
    city_country: 0,
    comma_unrecognized: 0,
    other_nonempty: 0
  };
  for (const row of source) {
    const value = row && typeof row === "object" && !Array.isArray(row) ? row.location : null;
    counts[classifyChaturbateLocation(value)] += 1;
  }
  return { inspectedRoomCount: source.length, locationShapeCounts: counts };
}

function safePagination(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    pagesFetched: Number.isInteger(input.pagesFetched) && input.pagesFetched >= 0 ? input.pagesFetched : null,
    receivedCount: Number.isInteger(input.receivedCount) && input.receivedCount >= 0 ? input.receivedCount : null,
    uniqueCount: Number.isInteger(input.uniqueCount) && input.uniqueCount >= 0 ? input.uniqueCount : null,
    duplicateCount: Number.isInteger(input.duplicateCount) && input.duplicateCount >= 0 ? input.duplicateCount : null,
    pageSize: Number.isInteger(input.pageSize) && input.pageSize > 0 ? input.pageSize : null,
    maxPages: Number.isInteger(input.maxPages) && input.maxPages > 0 ? input.maxPages : null,
    truncated: input.truncated === true,
    stopReason: ["short_page", "max_pages", "empty_page", "repeated_page", "unknown"].includes(input.stopReason) ? input.stopReason : "unknown",
    pageMetrics: Array.isArray(input.pageMetrics) ? input.pageMetrics.slice(0, 20).map((metric) => ({
      offset: Number.isInteger(metric && metric.offset) && metric.offset >= 0 ? metric.offset : null,
      responseTimeMs: Number.isInteger(metric && metric.responseTimeMs) && metric.responseTimeMs >= 0 ? metric.responseTimeMs : null,
      receivedCount: Number.isInteger(metric && metric.receivedCount) && metric.receivedCount >= 0 ? metric.receivedCount : null,
      uniqueCount: Number.isInteger(metric && metric.uniqueCount) && metric.uniqueCount >= 0 ? metric.uniqueCount : null,
      duplicateCount: Number.isInteger(metric && metric.duplicateCount) && metric.duplicateCount >= 0 ? metric.duplicateCount : null
    })) : []
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
    const code = name === "bongacams"
      ? normalizeBongaCountry(row)
      : resolveChaturbateCountry(rawCountry.value, row && row.location);
    if (!code) {
      const location = row && row.location;
      const locationPresent = typeof location === "string"
        ? location.trim().length > 0
        : location !== null && location !== undefined && location !== "";
      if (rawCountry.present || (name === "chaturbate" && locationPresent)) unrecognizedCountry += 1;
      else missingCountry += 1;
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
    ...(name === "chaturbate" ? { metadata: { ...summarizeMetadataFieldPresence(raw), locationShapes: summarizeChaturbateLocationShapes(raw) } } : {}),
    pagination: safePagination(pagination)
  };
}

module.exports = { summarizeFeedIngestion, rawCountryValue, safePagination, summarizeMetadataFieldPresence, summarizeChaturbateLocationShapes, classifyChaturbateLocation, CHATURBATE_METADATA_FIELDS };
