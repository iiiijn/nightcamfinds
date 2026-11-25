"use strict";

const STALE_AFTER_MS = 5 * 60 * 1000;

function toIsoOrNull(value) {
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function buildFeedHealthSnapshot(state = {}, now = Date.now()) {
  const lastAttemptAt = toIsoOrNull(state.lastAttemptAt);
  const lastCompletedAt = toIsoOrNull(state.lastCompletedAt);
  const lastSuccessfulAt = toIsoOrNull(state.lastSuccessfulAt);
  const completedMs = lastCompletedAt ? Date.parse(lastCompletedAt) : null;
  const ageMs = completedMs == null ? null : Math.max(0, now - completedMs);
  const stale = ageMs == null || ageMs > STALE_AFTER_MS;
  const providerHealth = {
    chaturbate: ["available", "unavailable"].includes(state.providerHealth && state.providerHealth.chaturbate)
      ? state.providerHealth.chaturbate : "unknown",
    bongacams: ["available", "unavailable", "disabled"].includes(state.providerHealth && state.providerHealth.bongacams)
      ? state.providerHealth.bongacams : "unknown"
  };
  const regions = (Array.isArray(state.regions) ? state.regions : []).map((region) => ({
    apiRegion: String(region && region.apiRegion || "unknown").slice(0, 40),
    truncated: Boolean(region && region.truncated),
    stopReason: String(region && region.stopReason || "unknown").slice(0, 40),
    pagesFetched: Number.isFinite(region && region.pagesFetched) ? Math.max(0, region.pagesFetched) : 0,
    receivedCount: Number.isFinite(region && region.receivedCount) ? Math.max(0, region.receivedCount) : 0
  }));
  const bongaInput = state.bonga || {};
  const bonga = {
    configuredVersion: bongaInput.configuredVersion === "2" ? "2" : "1",
    activeVersion: ["1", "2"].includes(bongaInput.activeVersion) ? bongaInput.activeVersion : null,
    fallbackUsed: Boolean(bongaInput.fallbackUsed)
  };
  const providerUnavailable = providerHealth.chaturbate === "unavailable" ||
    (providerHealth.bongacams !== "disabled" && providerHealth.bongacams === "unavailable");
  const incompleteRegion = regions.some((region) => region.truncated);
  const unknownProvider = providerHealth.chaturbate === "unknown" || providerHealth.bongacams === "unknown";
  const status = stale || providerUnavailable || incompleteRegion || unknownProvider || bonga.fallbackUsed
    ? "degraded" : "ok";
  return {
    status,
    lastAttemptAt,
    lastCompletedAt,
    lastSuccessfulAt,
    ageSeconds: ageMs == null ? null : Math.floor(ageMs / 1000),
    stale,
    providerHealth,
    regions,
    bonga
  };
}

module.exports = { STALE_AFTER_MS, buildFeedHealthSnapshot };
