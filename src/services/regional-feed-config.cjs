"use strict";

function resolveRegionalMaxPages(configuredValue, globalMaxPages = 10) {
  const globalLimit = Math.max(1, Math.min(20, Number(globalMaxPages) || 10));
  const defaultLimit = Math.min(6, globalLimit);
  if (configuredValue === undefined || configuredValue === null || String(configuredValue).trim() === "") {
    return defaultLimit;
  }
  const parsed = Number(configuredValue);
  if (!Number.isFinite(parsed)) return defaultLimit;
  return Math.max(1, Math.min(10, globalLimit, Math.floor(parsed)));
}

module.exports = { resolveRegionalMaxPages };
