import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateEpc,
  isEligibleForRoutingEvidence,
  normalizeCountryCode,
  normalizePlatform,
  resolveCountryPlatform,
  summarizeCountryPlatformMetrics
} from "../src/services/country-routing.js";

test("normalizes supported country codes and rejects unknown codes", () => {
  assert.equal(normalizeCountryCode(" us "), "US");
  assert.equal(normalizeCountryCode("GB"), "GB");
  assert.equal(normalizeCountryCode("KE"), "UNKNOWN");
  assert.equal(normalizeCountryCode(null), "UNKNOWN");
});

test("only supported partner platforms are accepted", () => {
  assert.equal(normalizePlatform("Chaturbate"), "chaturbate");
  assert.equal(normalizePlatform("BongaCams"), "bongacams");
  assert.equal(normalizePlatform("unknown"), null);
});

test("unapproved hypotheses never control live routing and preserve an alternative", () => {
  const result = resolveCountryPlatform({
    country: "DE",
    setting: { preferredPlatform: "bongacams", status: "hypothesis", hypothesis: "Unverified assumption" }
  });
  assert.equal(result.preferredPlatform, "chaturbate");
  assert.equal(result.alternativePlatform, "bongacams");
  assert.equal(result.source, "fallback_unapproved_setting");
  assert.equal(result.hypothesis, "Unverified assumption");
});

test("approved country setting selects preferred platform and retains alternative", () => {
  const result = resolveCountryPlatform({
    country: "GB",
    setting: {
      preferredPlatform: "bongacams",
      status: "approved",
      approvedAt: "2026-10-29T12:00:00Z",
      hypothesis: "Owner-approved initial hypothesis"
    }
  });
  assert.equal(result.preferredPlatform, "bongacams");
  assert.equal(result.alternativePlatform, "chaturbate");
  assert.equal(result.source, "approved_country_setting");
});

test("unknown countries use a safe fallback even when a setting is supplied", () => {
  const result = resolveCountryPlatform({
    country: "KE",
    setting: { preferredPlatform: "bongacams", status: "approved", approvedAt: "2026-10-29" },
    fallback: "bongacams"
  });
  assert.equal(result.country, "UNKNOWN");
  assert.equal(result.preferredPlatform, "bongacams");
  assert.equal(result.alternativePlatform, "chaturbate");
  assert.equal(result.source, "fallback_unknown_country");
});

test("evidence threshold requires enough clicks, engaged clicks, and verified signups", () => {
  assert.equal(isEligibleForRoutingEvidence({ clicks: 100, engagedClicks: 20, verifiedSignups: 5 }), true);
  assert.equal(isEligibleForRoutingEvidence({ clicks: 100, engagedClicks: 20, verifiedSignups: 4 }), false);
  assert.equal(isEligibleForRoutingEvidence({ clicks: 99, engagedClicks: 20, verifiedSignups: 5 }), false);
});

test("EPC is revenue per eligible click and undefined for no clicks or invalid values", () => {
  assert.equal(calculateEpc({ revenue: 12, eligibleClicks: 4 }), 3);
  assert.equal(calculateEpc({ revenue: 12, eligibleClicks: 0 }), null);
  assert.equal(calculateEpc({ revenue: "not-a-number", eligibleClicks: 4 }), null);
});

test("country-platform summary aggregates metrics and computes EPC without inventing missing values", () => {
  const result = summarizeCountryPlatformMetrics([
    { country: "US", platform: "chaturbate", clicks: 50, engagedClicks: 10, verifiedSignups: 2, verifiedPayers: 1, revenue: 8 },
    { country: "us", platform: "CHaturbate", clicks: 50, engagedClicks: 10, verifiedSignups: 3, verifiedPayers: 1, revenue: 12 },
    { country: "DE", platform: "bongacams", clicks: 0, engagedClicks: null, verifiedSignups: 0, verifiedPayers: 0, revenue: null },
    { country: "KE", platform: "bongacams", clicks: 99, revenue: 99 },
    { country: "GB", platform: "unsupported", clicks: 99, revenue: 99 }
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    country: "DE", platform: "bongacams", clicks: 0, engagedClicks: 0,
    verifiedSignups: 0, verifiedPayers: 0, revenue: 0, epc: null, evidenceEligible: false
  });
  assert.deepEqual(result[1], {
    country: "US", platform: "chaturbate", clicks: 100, engagedClicks: 20,
    verifiedSignups: 5, verifiedPayers: 2, revenue: 20, epc: 0.2, evidenceEligible: true
  });
});

test("country-platform summary treats invalid and negative metrics as zero", () => {
  const [result] = summarizeCountryPlatformMetrics([
    { country: "GB", platform: "chaturbate", clicks: -3, engagedClicks: "invalid", revenue: -5 }
  ]);
  assert.equal(result.clicks, 0);
  assert.equal(result.engagedClicks, 0);
  assert.equal(result.revenue, 0);
  assert.equal(result.epc, null);
  assert.equal(result.evidenceEligible, false);
});
