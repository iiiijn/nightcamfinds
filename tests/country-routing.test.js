const test = require("node:test");
const assert = require("node:assert/strict");
const {
  COUNTRIES,
  resolveCountryPreference,
  normalizeAttribution,
  summarizePerformance
} = require("../src/country-routing.cjs");

test("country routing falls back until a preference is explicitly approved", () => {
  const unapproved = resolveCountryPreference("US", {
    US: { preferredPlatform: "chaturbate", status: "hypothesis" }
  });
  assert.equal(unapproved.preferredPlatform, null);
  assert.equal(unapproved.source, "fallback");

  const approved = resolveCountryPreference("US", {
    US: { preferredPlatform: "chaturbate", status: "approved" }
  });
  assert.equal(approved.preferredPlatform, "chaturbate");
  assert.equal(approved.alternativePlatform, "bongacams");
});

test("unknown countries and invalid platforms use safe fallback", () => {
  assert.equal(resolveCountryPreference("ZZ", {}).country, "UNKNOWN");
  assert.equal(resolveCountryPreference("DE", {
    DE: { preferredPlatform: "unknown", status: "approved" }
  }).preferredPlatform, null);
});

test("country list is limited to supported tier-one markets", () => {
  assert.deepEqual(COUNTRIES, ["US", "GB", "CA", "AU", "DE", "FR", "NL"]);
});

test("attribution values are normalized, bounded and safe", () => {
  const result = normalizeAttribution({
    country: "gb",
    pageType: "Country\u0000Page",
    category: "Female",
    platform: "Chaturbate",
    cardPosition: "4",
    device: "mobile",
    referrer: "https://example.test/a?x=1",
    utmCampaign: "spring".repeat(40),
    subId: "sub-123"
  });
  assert.equal(result.country, "GB");
  assert.equal(result.pageType, "countrypage");
  assert.equal(result.platform, "chaturbate");
  assert.equal(result.cardPosition, 4);
  assert.equal(result.device, "mobile");
  assert.equal(result.utmCampaign.length, 150);
  assert.equal(normalizeAttribution({ cardPosition: "0" }).cardPosition, null);
});

test("performance summary keeps unavailable engaged-click data unknown and calculates EPC", () => {
  const result = summarizePerformance([
    { country: "US", platform: "chaturbate", clicks: 10, signups: 2, payers: 1, revenue: 5 },
    { country: "us", platform: "chaturbate", clicks: 5, signups: 1, payers: 0, revenue: 1 }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].clicks, 15);
  assert.equal(result[0].signups, 3);
  assert.equal(result[0].payers, 1);
  assert.equal(result[0].revenue, 6);
  assert.equal(result[0].epc, 0.4);
  assert.equal(result[0].engagedClicks, null);
  assert.equal(result[0].dataQuality, "partial_engagement_data");
});

test("performance summary never produces EPC when there are no clicks", () => {
  const result = summarizePerformance([
    { country: "FR", platform: "bongacams", clicks: 0, revenue: 12 }
  ]);
  assert.equal(result[0].epc, null);
});
