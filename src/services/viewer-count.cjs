"use strict";

function parseViewerCount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function normalizeViewerCount(value) {
  return parseViewerCount(value) ?? 0;
}

function firstValidViewerCount(...values) {
  for (const value of values) {
    const parsed = parseViewerCount(value);
    if (parsed !== null) return parsed;
  }
  return 0;
}

module.exports = { normalizeViewerCount, firstValidViewerCount };
