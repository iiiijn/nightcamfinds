"use strict";

const { normalizeCountryCode, resolveChaturbateCountry } = require("./country-directory.cjs");
const { getRoomRejectionReason } = require("./room-quality.cjs");
const { normalizeBongaCountry } = require("./bonga-country-normalizer.cjs");
const { summarizeCountryCandidates } = require("./country-candidate-diagnostics.cjs");
const { summarizeCountryConflicts } = require("./country-conflict-diagnostics.cjs");

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

  const separators = [",", ";", "|", "/"].filter((separator) => text.includes(separator));
  if (separators.length > 1) return "mixed_delimiter";
  if (separators.length === 0) return "other_nonempty";

  const separator = separators[0];
  const parts = text.split(separator).map((part) => part.trim());
  if (parts.length < 2 || parts.some((part) => !part)) return "delimited_empty_component";
  if (!normalizeCountryCode(parts[parts.length - 1])) {
    return separator === "," ? "comma_unrecognized"
      : separator === ";" ? "semicolon_unrecognized"
      : separator === "|" ? "pipe_unrecognized" : "slash_unrecognized";
  }
  if (separator === ",") return parts.length === 2 ? "city_country" : "location_country";
  return separator === ";" ? "semicolon_country"
    : separator === "|" ? "pipe_country" : "slash_country";
}

function summarizeChaturbateLocationShapes(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const counts = {
    missing: 0,
    exact_country: 0,
    city_country: 0,
    location_country: 0,
    comma_unrecognized: 0,
    semicolon_country: 0,
    pipe_country: 0,
    slash_country: 0,
    semicolon_unrecognized: 0,
    pipe_unrecognized: 0,
    slash_unrecognized: 0,
    mixed_delimiter: 0,
    delimited_empty_component: 0,
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


function classifySafeValueShape(value) {
  if (value === null || value === undefined || value === "") return "missing";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "number") return Number.isFinite(value) ? "number" : "other";
  if (typeof value === "boolean") return "boolean";
  if (typeof value !== "string") return "other";
  const text = value.trim();
  if (!text) return "missing";
  if (/^[A-Za-z]{2}$/.test(text)) return "two_letter_code";
  if (/[;|]/.test(text)) return text.includes(";") && text.includes("|") ? "mixed_delimiters"
    : text.includes(";") ? "semicolon_delimited" : "pipe_delimited";
  if (text.includes(",")) return "comma_delimited";
  if (text.includes("/")) return "slash_delimited";
  if (/[()\[\]{}]/.test(text)) return "bracketed_text";
  if (/\d/.test(text)) return "contains_digits";
  if (/[\u0400-\u052F]/.test(text)) return "cyrillic_text";
  if (/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(text)) return "cjk_text";
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) return "arabic_text";
  if (/[\u0590-\u05FF]/.test(text)) return "hebrew_text";
  if (/[\u0370-\u03FF]/.test(text)) return "greek_text";
  if (/[\u0900-\u097F]/.test(text)) return "devanagari_text";
  if (/[^\u0000-\u024F]/.test(text)) return "other_non_latin_text";
  if (/^[\p{L}\s.'’-]+$/u.test(text)) {
    return /\s/.test(text) ? "multiword_text" : "single_word_text";
  }
  return "other_text";
}

function summarizeSafeFieldValueShapes(rows, fields) {
  const source = Array.isArray(rows) ? rows : [];
  const allowed = Array.isArray(fields) ? fields : [];
  const summaries = {};
  for (const field of allowed) {
    const counts = {};
    for (const row of source) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
      const shape = classifySafeValueShape(row[field]);
      counts[shape] = (counts[shape] || 0) + 1;
    }
    summaries[field] = counts;
  }
  return { inspectedRoomCount: source.length, fieldValueShapeCounts: summaries };
}

function resolveExplicitCountry(row, provider) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return "";
  if (provider === "chaturbate") return normalizeCountryCode(row.country);
  for (const field of ["homecountry", "country", "country_code"]) {
    const code = normalizeCountryCode(row[field]);
    if (code) return code;
  }
  return "";
}

function resolveLocationCountry(row, provider) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return "";
  if (provider === "chaturbate") return resolveChaturbateCountry("", row.location);
  const hometown = typeof row.hometown === "string" ? row.hometown.trim() : "";
  if (!hometown) return "";
  const exact = normalizeCountryCode(hometown);
  if (exact) return exact;
  const parts = hometown.split(",").map((part) => part.trim());
  return parts.length === 2 && parts.every(Boolean) ? normalizeCountryCode(parts[1]) : "";
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

  const countryCandidates = summarizeCountryCandidates(name, raw);
  const countryConflicts = summarizeCountryConflicts(name, raw);

  return {
    provider: name,
    rawRoomCount: raw.length,
    normalizedRoomCount: normalizedCount,
    acceptedUniqueRoomCount: acceptedCount,
    rejectedRoomCount: Object.values(rejectionReasons).reduce((sum, count) => sum + count, 0),
    duplicateRoomCount: duplicateCount,
    missingCountryCount: missingCountry,
    unrecognizedCountryCount: unrecognizedCountry,
    acceptedCountryRecovery,\n    countryCounts: [...countryCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([country, roomCount]) => ({ country, roomCount })),
    rejectionReasons,
    ...(name === "chaturbate" ? { metadata: { ...summarizeMetadataFieldPresence(raw), locationShapes: summarizeChaturbateLocationShapes(raw), safeValueShapes: summarizeSafeFieldValueShapes(raw, ["country", "location"]), countryCandidates, countryConflicts } } : { metadata: { safeValueShapes: summarizeSafeFieldValueShapes(raw, ["homecountry", "country", "country_code", "hometown"]), countryCandidates, countryConflicts } }),
    pagination: safePagination(pagination)
  };
}

module.exports = { summarizeFeedIngestion, rawCountryValue, safePagination, summarizeMetadataFieldPresence, summarizeChaturbateLocationShapes, classifyChaturbateLocation, CHATURBATE_METADATA_FIELDS, classifySafeValueShape, summarizeSafeFieldValueShapes, resolveExplicitCountry, resolveLocationCountry };
