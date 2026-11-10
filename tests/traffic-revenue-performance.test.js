'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const performance = require('../src/services/traffic-revenue-performance.cjs');

test('builds a country and campaign funnel with currency-separated matched payouts', () => {
  const built = performance.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.deepEqual(built.params.clicks, ['2026-11-01', '2026-11-07']);
  assert.deepEqual(built.params.visits, ['2026-11-01', '2026-11-07']);
  assert.deepEqual(built.params.conversions, ['2026-11-01', '2026-11-07']);
  assert.match(built.text, /FROM affiliate_clicks ac/);
  assert.match(built.text, /FROM traffic_visits tv/);
  assert.match(built.text, /traffic_engagement_events e/);
  assert.match(built.text, /visits_with_affiliate_click/);
  assert.match(built.text, /FROM cb_conversions cc/);
  assert.match(built.text, /cc\.matched_click IS TRUE/);
  assert.match(built.text, /LOWER\(cc\.conversion_type\) IN/);
  assert.match(built.text, /jsonb_object_agg\(currency, reported_payout\)/);
  assert.match(built.text, /reported_payouts_by_currency/);
  assert.match(built.text, /FULL OUTER JOIN visit_groups/);
  assert.match(built.text, /LIMIT 2000/);
  assert.match(built.text, /NOT EXISTS/);
});

test('uses independent parameterized UTC date windows for clicks, visits and conversions', () => {
  const built = performance.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.match(built.text, /ac\.clicked_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /tv\.first_seen_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /cc\.received_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.doesNotMatch(built.text, /2026-11/);
});

test('rejects invalid and reversed date ranges', () => {
  assert.match(performance.buildQuery({ from: '2026-02-31' }).error, /calendar dates/);
  assert.match(performance.buildQuery({ from: '2026-11-08', to: '2026-11-07' }).error, /on or before/);
});

test('supports all-time report without date predicates', () => {
  const built = performance.buildQuery({});
  assert.deepEqual(built.params, { clicks: [], visits: [], conversions: [] });
  assert.doesNotMatch(built.text, /clicked_at >=|first_seen_at >=|received_at >=/);
});

test('excludes only identified internal test and audit traffic from click and visit totals', () => {
  const built = performance.buildQuery({});
  assert.match(built.text, /LOWER\(COALESCE\(ac\.source, ''\)\) <> 'test'/);
  assert.match(built.text, /LOWER\(COALESCE\(ac\.campaign, ''\)\) NOT IN \('test_female_01', 'revshare_audit_01'\)/);
  assert.match(built.text, /LOWER\(COALESCE\(tv\.source, ''\)\) <> 'test'/);
  assert.match(built.text, /LOWER\(COALESCE\(tv\.campaign, ''\)\) NOT IN \('test_female_01', 'revshare_audit_01'\)/);
});
