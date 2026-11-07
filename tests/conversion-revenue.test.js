'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const conversionRevenue = require('../src/services/conversion-revenue.cjs');

test('builds a currency-separated conversion report with click-match counts', () => {
  const built = conversionRevenue.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.equal(built.error, undefined);
  assert.deepEqual(built.params, ['2026-11-01', '2026-11-07']);
  assert.match(built.text, /GROUP BY 1,2,3,4,5,6,7,8,9/);
  assert.match(built.text, /matched_conversions/);
  assert.match(built.text, /is_test/);
  assert.match(built.text, /raw_payload/);
  assert.match(built.text, /has_click_id/);
  assert.match(built.text, /has_currency/);
  assert.match(built.text, /payload.value ~ '\^\\\\\{/);
  assert.match(built.text, /unmatched_conversions/);
  assert.match(built.text, /COALESCE\(NULLIF\(UPPER\(cc\.currency\), ''\), 'UNSPECIFIED'\)/);
  assert.match(built.text, /SUM\(cc\.payout\)/);
  assert.match(built.text, /LIMIT 2000/);
});

test('rejects invalid calendar dates and reversed date ranges', () => {
  assert.match(conversionRevenue.buildQuery({ from: '2026-02-31' }).error, /calendar dates/);
  assert.match(conversionRevenue.buildQuery({ from: '2026-11-08', to: '2026-11-07' }).error, /on or before/);
});

test('uses parameterized UTC date filters', () => {
  const built = conversionRevenue.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.doesNotMatch(built.text, /2026-11/);
  assert.match(built.text, /received_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /received_at < \(\(\$2::date \+ INTERVAL '1 day'\) AT TIME ZONE 'UTC'\)/);
});

test('does not combine different currencies into a single aggregate group', () => {
  const built = conversionRevenue.buildQuery({});
  assert.match(built.text, /GROUP BY 1,2,3,4,5,6,7,8,9/);
  assert.match(built.text, /UNSPECIFIED/);
});
