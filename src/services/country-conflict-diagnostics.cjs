"use strict";

const { normalizeCountryCode, resolveChaturbateCountry } = require("./country-directory.cjs");

function resolveBongaHometown(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const exact = normalizeCountryCode(value);
  if (exact) return exact;
  const parts = value.trim().split(",");
  if (parts.length !== 2 || parts.some((part) => !part.trim())) return "";
  return normalizeCountryCode(parts[1].trim());
}

function summarizeCountryConflicts(provider, rows = []) {
  const name = String(provider || "").toLowerCase();
  if (!["chaturbate", "bongacams"].includes(name)) throw new TypeError("Unsupported feed provider");
  const source = Array.isArray(rows) ? rows : [];
  let explicitRecognizedCount = 0;
  let locationRecognizedCount = 0;
  let matchingCount = 0;
  let conflictingCount = 0;
  let locationOnlyRecoverableCount = 0;
  let neitherRecognizedCount = 0;
  let multipleExplicitConflictCount = 0;
  const conflictPairs = new Map();

  for (const row of source) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      neitherRecognizedCount += 1;
      continue;
    }

    let explicit = "";
    let explicitCodes = [];
    let location = "";

    if (name === "chaturbate") {
      explicit = normalizeCountryCode(row.country);
      explicitCodes = explicit ? [explicit] : [];
      location = resolveChaturbateCountry("", row.location);
    } else {
      explicitCodes = ["homecountry", "country", "country_code"]
        .map((field) => normalizeCountryCode(row[field]))
        .filter(Boolean);
      explicit = explicitCodes[0] || "";
      location = resolveBongaHometown(row.hometown);
      if (new Set(explicitCodes).size > 1) multipleExplicitConflictCount += 1;
    }

    if (explicit) explicitRecognizedCount += 1;
    if (location) locationRecognizedCount += 1;

    if (explicit && location) {
      if (explicit === location) {
        matchingCount += 1;
      } else {
        conflictingCount += 1;
        const key = [explicit, location].sort().join(":");
        conflictPairs.set(key, (conflictPairs.get(key) || 0) + 1);
      }
    } else if (!explicit && location) {
      locationOnlyRecoverableCount += 1;
    } else if (!explicit && !location) {
      neitherRecognizedCount += 1;
    }
  }

  return {
    provider: name,
    inspectedRoomCount: source.length,
    explicitRecognizedCount,
    locationRecognizedCount,
    matchingCountryCount: matchingCount,
    conflictingCountryCount: conflictingCount,
    locationOnlyRecoverableCount,
    neitherRecognizedCount,
    multipleExplicitFieldConflictCount: multipleExplicitConflictCount,
    conflictCountryPairCounts: [...conflictPairs.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([pair, roomCount]) => ({ countries: pair.split(":"), roomCount }))
  };
}

module.exports = { summarizeCountryConflicts };
