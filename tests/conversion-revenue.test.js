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
