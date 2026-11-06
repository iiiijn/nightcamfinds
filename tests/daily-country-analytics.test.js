'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const analytics = require('../src/services/daily-country-analytics.cjs');

test('Tier 1 analytics list contains all 18 configured country markets', () => {
  assert.equal(analytics.TIER1_COUNTRIES.length, 18);
  assert.equal(new Set(analytics.TIER1_COUNTRIES).size, 18);
  assert.ok(analytics.TIER1_COUNTRIES.includes('JP'));
  assert.ok(analytics.TIER1_COUNTRIES.includes('SG'));
});

test('daily filters accept valid date, country and Tier 1 filters', () => {
  const parsed = analytics.parseFilters(new URLSearchParams('from=2026-11-01&to=2026-11-06&country=IE&tier1=true'));
  assert.deepEqual(parsed, { value: { from: '2026-11-01', to: '2026-11-06', country: 'IE', tier1: true } });
});

test('daily filters reject invalid calendar dates and reversed ranges', () => {
  assert.match(analytics.parseFilters(new URLSearchParams('from=bad')).error, /calendar dates/);
  assert.match(analytics.parseFilters(new URLSearchParams('from=2026-02-31')).error, /calendar dates/);
  assert.match(analytics.parseFilters(new URLSearchParams('from=2026-11-06&to=2026-11-01')).error, /on or before/);
});

test('country filter rejects malformed values', () => {
  assert.match(analytics.parseFilters(new URLSearchParams('country=USA')).error, /two-letter/);
});

test('daily query uses parameterized filters and UTC day boundaries', () => {
  const built = analytics.buildQuery({ from: '2026-11-01', to: '2026-11-06', country: 'IE', tier1: true });
  assert.deepEqual(built.params, ['2026-11-01', '2026-11-06', analytics.TIER1_COUNTRIES, 'IE']);
  assert.match(built.text, /AT TIME ZONE 'UTC'/);
  assert.match(built.text, /engaged_at IS NOT NULL/);
  assert.match(built.text, /LIMIT 20000/);
  const fallback = analytics.buildQuery({ from: '', to: '', country: 'ALL', tier1: false }, { includeEngagement: false });
  assert.match(fallback.text, /NULL::int AS engaged_clicks/);
  assert.doesNotMatch(fallback.text, /engaged_at/);
  assert.doesNotMatch(built.text, /2026-11-01|IE/);
});
