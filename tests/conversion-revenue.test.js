'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const conversionRevenue = require('../src/services/conversion-revenue.cjs');

test('groups payouts by currency and separates macro-placeholder callbacks', () => {
  const built = conversionRevenue.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.deepEqual(built.params, ['2026-11-01', '2026-11-07']);
  assert.match(built.text, /GROUP BY 1,2,3,4,5,6,7/);
  assert.match(built.text, /jsonb_each_text/);
  assert.match(built.text, /AS is_test/);
  assert.match(built.text, /AS match_status/);
  assert.match(built.text, /missing_click_id/);
  assert.match(built.text, /click_id_not_found/);
  assert.match(built.text, /cc\.matched_click IS TRUE/);
  assert.match(built.text, /GROUP BY 1,2,3,4,5,6,7,8/);
  assert.match(built.text, /matched_conversions/);
  assert.match(built.text, /unmatched_conversions/);
  assert.match(built.text, /SUM\(cc\.payout\)/);
  assert.match(built.text, /LIMIT 2000/);
});
test('rejects invalid dates and reversed date ranges', () => {
  assert.match(conversionRevenue.buildQuery({ from: '2026-02-31' }).error, /calendar dates/);
  assert.match(conversionRevenue.buildQuery({ from: '2026-11-08', to: '2026-11-07' }).error, /on or before/);
});
test('uses parameterized UTC date filters', () => {
  const built = conversionRevenue.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.doesNotMatch(built.text, /2026-11/);
  assert.match(built.text, /received_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /received_at < \(\(\$2::date \+ INTERVAL '1 day'\) AT TIME ZONE 'UTC'\)/);
});


test('detects macro placeholders in typed callback columns, not only raw payload', () => {
  const built = conversionRevenue.buildQuery({});
  assert.ok(built.text.includes("COALESCE(cc.conversion_type, '') ~"));
  assert.ok(built.text.includes("COALESCE(cc.currency, '') ~"));
  assert.ok(built.text.includes("COALESCE(cc.click_id, '') ~"));
  assert.match(built.text, /THEN 'invalid_callback'/);
  assert.match(built.text, /AS is_test/);
});

test('keeps invalid macro callbacks out of matched and unmatched eligible conversion totals', () => {
  const source = require('../public/revenue-summary.js');
  const result = source.summarizeConversions([
    { conversions: 1, isTest: true, matchStatus: 'invalid_callback', conversionType: 'unknown', currency: 'UNSPECIFIED' },
    { conversions: 2, isTest: false, matchStatus: 'matched', matchedConversions: 2, unmatchedConversions: 0, conversionType: 'revshare_purchase', currency: 'USD', reportedPayout: '4.50' }
  ]);
  assert.equal(result.invalidCallbacks, 1);
  assert.equal(result.testEvents, 1);
  assert.equal(result.matchedConversions, 2);
  assert.equal(result.unmatchedConversions, 0);
  assert.equal(result.attributedPayoutsByCurrency.USD, 4.5);
});
