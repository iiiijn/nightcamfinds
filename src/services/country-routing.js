const SUPPORTED_PLATFORMS = new Set(["chaturbate", "bongacams"]);
const COUNTRY_CODES = new Set(["US", "GB", "CA", "AU", "DE", "FR", "NL"]);

export function normalizeCountryCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  return COUNTRY_CODES.has(code) ? code : "UNKNOWN";
}

export function normalizePlatform(value) {
  const platform = String(value ?? "").trim().toLowerCase();
  return SUPPORTED_PLATFORMS.has(platform) ? platform : null;
}

/**
 * Resolve a country preference without allowing an unapproved hypothesis to
 * affect live routing. Both platforms should remain available in the UI.
 */
export function resolveCountryPlatform({ country, setting, fallback = "chaturbate" } = {}) {
  const countryCode = normalizeCountryCode(country);
  const safeFallback = normalizePlatform(fallback) || "chaturbate";
  const preferred = normalizePlatform(setting?.preferredPlatform);
  const approved = setting?.status === "approved" && Boolean(setting?.approvedAt);

  if (countryCode !== "UNKNOWN" && approved && preferred) {
    return {
      country: countryCode,
      preferredPlatform: preferred,
      alternativePlatform: preferred === "chaturbate" ? "bongacams" : "chaturbate",
      source: "approved_country_setting",
      hypothesis: setting?.hypothesis || null
    };
  }

  return {
    country: countryCode,
    preferredPlatform: safeFallback,
    alternativePlatform: safeFallback === "chaturbate" ? "bongacams" : "chaturbate",
    source: countryCode === "UNKNOWN" ? "fallback_unknown_country" : "fallback_unapproved_setting",
    hypothesis: setting?.hypothesis || null
  };
}

export function isEligibleForRoutingEvidence(metrics, minimums = {}) {
  const minClicks = Number.isInteger(minimums.clicks) ? minimums.clicks : 100;
  const minEngagedClicks = Number.isInteger(minimums.engagedClicks) ? minimums.engagedClicks : 20;
  const minVerifiedSignups = Number.isInteger(minimums.verifiedSignups) ? minimums.verifiedSignups : 5;
  const clicks = Number(metrics?.clicks || 0);
  const engagedClicks = Number(metrics?.engagedClicks || 0);
  const verifiedSignups = Number(metrics?.verifiedSignups || 0);

  return Number.isFinite(clicks) && Number.isFinite(engagedClicks) &&
    Number.isFinite(verifiedSignups) &&
    clicks >= minClicks &&
    engagedClicks >= minEngagedClicks &&
    verifiedSignups >= minVerifiedSignups;
}

export function calculateEpc({ revenue, eligibleClicks } = {}) {
  const amount = Number(revenue);
  const clicks = Number(eligibleClicks);
  if (!Number.isFinite(amount) || !Number.isFinite(clicks) || clicks <= 0) return null;
  return amount / clicks;
}
