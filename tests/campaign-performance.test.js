'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const campaignPerformance = require('../src/services/campaign-performance.cjs');

test('groups campaign performance by country, platform, source and campaign', () => {
  const built = campaignPerformance.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.ok(!built.error);
  assert.deepEqual(built.params, ['2026-11-01', '2026-11-07']);
  assert.match(built.text, /GROUP BY 1,2,3,4/);
  assert.match(built.text, /COUNT\(\*\)::int AS clicks/);
  assert.match(built.text, /LIMIT 2000/);
});

test('rejects invalid campaign report filters using shared validation', () => {
  const built = campaignPerformance.buildQuery({ from: '2026-02-31' });
  assert.match(built.error, /calendar dates/);
});

test('uses parameterized date filters and does not interpolate values into SQL', () => {
  const built = campaignPerformance.buildQuery({ from: '2026-11-01', to: '2026-11-07', source: "x' OR 1=1 --" });
  assert.deepEqual(built.params, ['2026-11-01', '2026-11-07', "x' or 1=1 --"]);
  assert.doesNotMatch(built.text, /x' OR 1=1/);
});
