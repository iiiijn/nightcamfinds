"use strict";

const { isIso3166Alpha2 } = require("./iso-country-codes.cjs");

function resolveBongaV1Limit(value) {
  const parsed = Number.parseInt(String(value == null ? "" : value), 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(100, Math.max(10, parsed));
}

function summarizeBongaV1Feed({ rows = [], normalized = [], rooms = [], requestedLimit = 10, checkedAt = null, error = false } = {}) {
  const rawRows = Array.isArray(rows) ? rows : [];
  const normalizedRows = Array.isArray(normalized) ? normalized : [];
  const acceptedRows = Array.isArray(rooms) ? rooms : [];
  let missingCountryCount = 0;
  let unrecognizedCountryCount = 0;
  for (const row of rawRows) {
    const raw = String(row && (row.homecountry || row.country || row.country_code) || "").trim();
    if (!raw) missingCountryCount += 1;
    else if (!isIso3166Alpha2(raw.toUpperCase())) unrecognizedCountryCount += 1;
  }
  return {
    provider: "bongacams", status: error ? "unavailable" : "active_v1", apiVersion: "1",
    pagination: "not_verified_single_response", requestedLimit: resolveBongaV1Limit(requestedLimit),
    rawRoomCount: rawRows.length, normalizedRoomCount: normalizedRows.length,
    acceptedRoomCount: acceptedRows.length,
    rejectedOrDuplicateCount: Math.max(0, normalizedRows.length - acceptedRows.length),
    missingCountryCount, unrecognizedCountryCount, checkedAt
  };
}

module.exports = { resolveBongaV1Limit, summarizeBongaV1Feed };
