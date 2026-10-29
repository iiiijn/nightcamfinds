"use strict";

const COUNTRIES = Object.freeze(["US", "GB", "CA", "AU", "DE", "FR", "NL"]);
const PLATFORMS = Object.freeze(["chaturbate", "bongacams"]);
const DEFAULT_SETTINGS = Object.freeze(Object.fromEntries(
  COUNTRIES.map(country => [country, Object.freeze({
    preferredPlatform: null,
    status: "unassigned",
    hypothesis: "",
    approvedAt: null,
    updatedAt: null
  })])
));

function normalizeCountry(value) {
  const country = String(value || "").trim().toUpperCase();
  return COUNTRIES.includes(country) ? country : null;
}

function normalizePlatform(value) {
  const platform = String(value || "").trim().toLowerCase();
  return PLATFORMS.includes(platform) ? platform : null;
}

function resolveCountryPreference(country, settings = {}) {
  const code = normalizeCountry(country);
  const setting = code ? settings[code] : null;
  if (!setting || setting.status !== "approved") {
    return { country: code || "UNKNOWN", preferredPlatform: null, alternativePlatform: null, source: "fallback" };
  }
  const preferredPlatform = normalizePlatform(setting.preferredPlatform);
  if (!preferredPlatform) {
    return { country: code, preferredPlatform: null, alternativePlatform: null, source: "fallback" };
  }
  const alternativePlatform = PLATFORMS.find(platform => platform !== preferredPlatform);
  return { country: code, preferredPlatform, alternativePlatform, source: "approved_country_setting" };
}

function normalizeAttribution(input = {}) {
  const pick = (value, max, fallback = "") => String(value ?? fallback)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
  const position = Number.parseInt(input.cardPosition, 10);
  return {
    country: normalizeCountry(input.country) || "UNKNOWN",
    pageType: pick(input.pageType, 40, "unknown").toLowerCase(),
    category: pick(input.category, 40, "unknown").toLowerCase(),
    platform: normalizePlatform(input.platform) || "unknown",
    cardPosition: Number.isInteger(position) && position > 0 && position <= 1000 ? position : null,
    device: ["mobile", "tablet", "desktop"].includes(input.device) ? input.device : "unknown",
    referrer: pick(input.referrer, 500),
    utmSource: pick(input.utmSource, 100),
    utmMedium: pick(input.utmMedium, 100),
    utmCampaign: pick(input.utmCampaign, 150),
    utmContent: pick(input.utmContent, 150),
    subId: pick(input.subId, 128)
  };
}

function summarizePerformance(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const country = normalizeCountry(row.country) || "UNKNOWN";
    const platform = normalizePlatform(row.platform) || "unknown";
    const key = country + ":" + platform;
    const current = grouped.get(key) || {
      country, platform, clicks: 0, engagedClicks: null, signups: 0,
      payers: 0, revenue: 0, epc: null, dataQuality: "partial"
    };
    current.clicks += Math.max(0, Number(row.clicks) || 0);
    current.signups += Math.max(0, Number(row.signups) || 0);
    current.payers += Math.max(0, Number(row.payers) || 0);
    current.revenue += Math.max(0, Number(row.revenue) || 0);
    if (Number.isFinite(Number(row.engagedClicks)) && row.engagedClicks !== null && row.engagedClicks !== "") {
      current.engagedClicks = (current.engagedClicks ?? 0) + Math.max(0, Number(row.engagedClicks));
    }
    grouped.set(key, current);
  }
  return [...grouped.values()].map(item => ({
    ...item,
    revenue: Number(item.revenue.toFixed(4)),
    epc: item.clicks > 0 ? Number((item.revenue / item.clicks).toFixed(6)) : null,
    dataQuality: item.engagedClicks === null ? "partial_engagement_data" : "reported"
  })).sort((a, b) => a.country.localeCompare(b.country) || a.platform.localeCompare(b.platform));
}

module.exports = {
  COUNTRIES,
  PLATFORMS,
  DEFAULT_SETTINGS,
  normalizeCountry,
  normalizePlatform,
  resolveCountryPreference,
  normalizeAttribution,
  summarizePerformance
};
