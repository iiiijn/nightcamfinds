"use strict";

const { normalizeCountryCode } = require("./country-directory.cjs");

const PROVIDER_FIELDS = Object.freeze({
  chaturbate: ["country", "location"],
  bongacams: ["homecountry", "country", "country_code", "hometown"]
});

function candidateParts(value) {
  if (typeof value !== "string" && typeof value !== "number") return [];
  const text = String(value).trim();
  if (!text) return [];
  // Candidate extraction is intentionally limited to complete delimited components.
  // Free-form text is never stored or emitted.
  if (!/[;,|/]/.test(text)) return [text];
  const separators = [",", ";", "|", "/"].filter((separator) => text.includes(separator));
  if (separators.length !== 1) return [];
  return text.split(separators[0]).map((part) => part.trim()).filter(Boolean);
}

function summarizeCountryCandidates(provider, rows = []) {
  const name = String(provider || "").toLowerCase();
  const fields = PROVIDER_FIELDS[name];
  if (!fields) throw new TypeError("Unsupported feed provider");
  const source = Array.isArray(rows) ? rows : [];
  const counts = new Map();
  const fieldCounts = Object.fromEntries(fields.map((field) => [field, 0]));
  let rowsWithCandidate = 0;

  for (const row of source) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const rowCandidates = new Set();
    for (const field of fields) {
      const value = row[field];
      for (const part of candidateParts(value)) {
        const code = normalizeCountryCode(part);
        if (code) {
          rowCandidates.add(code);
          fieldCounts[field] += 1;
        }
      }
    }
    if (rowCandidates.size) rowsWithCandidate += 1;
    for (const code of rowCandidates) counts.set(code, (counts.get(code) || 0) + 1);
  }

  return {
    inspectedRoomCount: source.length,
    rowsWithVerifiedCandidateCount: rowsWithCandidate,
    candidateCountryCounts: [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([country, roomCount]) => ({ country, roomCount })),
    verifiedCandidateFieldCounts: fieldCounts
  };
}

module.exports = { summarizeCountryCandidates, candidateParts };
