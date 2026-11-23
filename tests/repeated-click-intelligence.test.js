'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const intelligence = require('../src/services/repeated-click-intelligence.cjs');

test('accepts valid optional date filters and rejects invalid or reversed ranges', () => {
  assert.deepEqual(intelligence.parseFilters(new URLSearchParams('from=2026-11-14&to=2026-11-16')), { value: { from: '2026-11-14', to: '2026-11-16' } });
  assert.match(intelligence.parseFilters(new URLSearchParams('from=14-11-2026')).error, /start date/i);
  assert.match(intelligence.parseFilters(new URLSearchParams('from=2026-11-17&to=2026-11-16')).error, /on or before/i);
});

test('builds parameterized, owner-excluding burst analysis without changing source rows', () => {
  const query = intelligence.buildQuery({ from: '2026-11-14', to: '2026-11-16' });
  assert.match(query.text, /date_trunc\('minute'/);
  assert.match(query.text, /date_trunc\('hour'/);
  assert.match(query.text, /COALESCE\(is_owner_traffic,FALSE\) IS FALSE/);
  assert.match(query.text, /visit_id IS NOT NULL/);
  assert.deepEqual(query.params, ['2026-11-14T00:00:00.000Z', '2026-11-16T23:59:59.999Z', 8, 40]);
  assert.doesNotMatch(query.text, /INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE/i);
});

test('classifies burst and repeated visits separately and summarizes without calling them bots', () => {
  const result = intelligence.summarize([
    { visit_id: 'a', country: 'RO', platform: 'chaturbate', total_clicks: 217, peak_clicks_per_minute: 217, peak_clicks_per_hour: 217, anomaly_class: 'high_burst' },
    { visit_id: 'b', country: 'NL', platform: 'bongacams', total_clicks: 50, peak_clicks_per_minute: 2, peak_clicks_per_hour: 50, anomaly_class: 'repeated' }
  ]);
  assert.equal(result.affectedVisits, 2);
  assert.equal(result.flaggedClicks, 267);
  assert.equal(result.highBurstVisits, 1);
  assert.equal(result.repeatedVisits, 1);
  assert.deepEqual(result.byCountry, { RO: 217, NL: 50 });
  assert.equal(result.rows[0].classification, 'high_burst');
  assert.equal(result.rows[0].visitId, 'a');
});
