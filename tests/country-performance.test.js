const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeCountryPerformance } = require("../src/country-performance.cjs");

test("uses the originating click country when a conversion click ID matches", () => {
  const rows = summarizeCountryPerformance(
    [{ country: "US", platform: "chaturbate", clicks: 20 }],
    [{ platform: "chaturbate", conversion_type: "revshare_signup-referral", user_id: "u1", matched_click: true, click_country: "US", reported_country: "DE" }]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].country, "US");
  assert.equal(rows[0].signups, 1);
  assert.equal(rows[0].attributionQuality, "click_attributed");
});

test("keeps unmatched conversions under partner-reported country and labels them", () => {
  const rows = summarizeCountryPerformance(
    [{ country: "US", platform: "chaturbate", clicks: 10 }],
    [{ platform: "chaturbate", conversion_type: "revshare_signup-referral", matched_click: false, reported_country: "DE" }]
  );
  const unmatched = rows.find(row => row.country === "DE");
  assert.ok(unmatched);
  assert.equal(unmatched.clicks, 0);
  assert.equal(unmatched.attributionQuality, "partner_reported_unmatched");
});

test("does not aggregate revenue or EPC across mixed or missing currencies", () => {
  const mixed = summarizeCountryPerformance(
    [{ country: "GB", platform: "bongacams", clicks: 10 }],
    [
      { platform: "bongacams", conversion_type: "purchase", payout: 5, currency: "USD", matched_click: true, click_country: "GB" },
      { platform: "bongacams", conversion_type: "purchase", payout: 4, currency: "EUR", matched_click: true, click_country: "GB" }
    ]
  )[0];
  assert.equal(mixed.revenue, null);
  assert.equal(mixed.revenueCurrency, "MIXED");
  assert.equal(mixed.epc, null);

  const missing = summarizeCountryPerformance(
    [{ country: "US", platform: "chaturbate", clicks: 10 }],
    [{ platform: "chaturbate", conversion_type: "revshare_purchase", payout: 2, currency: null, matched_click: true, click_country: "US" }]
  )[0];
  assert.equal(missing.revenue, null);
  assert.equal(missing.revenueCurrency, "UNKNOWN");
  assert.equal(missing.epc, null);
});

test("calculates EPC only when all reported revenue events share a known currency", () => {
  const row = summarizeCountryPerformance(
    [{ country: "CA", platform: "chaturbate", clicks: 10 }],
    [{ platform: "chaturbate", conversion_type: "revshare_purchase", payout: 5, currency: "USD", user_id: "payer1", matched_click: true, click_country: "CA" }]
  )[0];
  assert.equal(row.revenue, 5);
  assert.equal(row.revenueCurrency, "USD");
  assert.equal(row.epc, 0.5);
  assert.equal(row.payers, 1);
});

test("counts distinct payers, not purchase events", () => {
  const row = summarizeCountryPerformance([], [
    { platform: "bongacams", conversion_type: "purchase", payout: 1, currency: "USD", user_id: "payer1", matched_click: true, click_country: "AU" },
    { platform: "bongacams", conversion_type: "purchase", payout: 2, currency: "USD", user_id: "payer1", matched_click: true, click_country: "AU" },
    { platform: "bongacams", conversion_type: "purchase", payout: 3, currency: "USD", user_id: "payer2", matched_click: true, click_country: "AU" }
  ])[0];
  assert.equal(row.payers, 2);
});
