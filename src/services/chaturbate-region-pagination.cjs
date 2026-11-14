"use strict";

function resolveChaturbateRegionMaxPages(apiRegion, options = {}) {
  const globalLimit = Math.max(1, Math.min(20, Number(options.globalMaxPages) || 10));
  const regionalLimit = Math.max(1, Math.min(10, globalLimit, Number(options.regionalMaxPages) || 6));
  if (apiRegion !== "southamerica") return regionalLimit;

  const defaultSouthAmericaLimit = Math.min(8, globalLimit);
  const configuredValue = options.southAmericaMaxPages;
  if (configuredValue === undefined || configuredValue === null || String(configuredValue).trim() === "") {
    return defaultSouthAmericaLimit;
  }
  const parsed = Number(configuredValue);
  if (!Number.isFinite(parsed)) return defaultSouthAmericaLimit;
  return Math.max(1, Math.min(10, globalLimit, Math.floor(parsed)));
}

module.exports = { resolveChaturbateRegionMaxPages };
