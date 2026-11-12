'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const trace = require('../src/services/individual-click-trace.cjs');

test('validates individual click trace filters', () => {
  assert.equal(trace.parseFilters(new URLSearchParams('platform=chaturbate&limit=50')).value.limit, 50);
  assert.match(trace.parseFilters(new URLSearchParams('platform=bad')).error, /Platform/);
  assert.match(trace.parseFilters(new URLSearchParams('limit=101')).error, /Limit/);
  assert.match(trace.parseFilters(new URLSearchParams('from=2026-02-30')).error, /valid calendar dates/);
  assert.match(trace.parseFilters(new URLSearchParams('from=2026-11-12&to=2026-11-11')).error, /on or before/);
});

test('builds a parameterized read-only query with bounded results', () => {
  const query = trace.buildQuery({ from: '2026-11-01', to: '2026-11-12', platform: 'bongacams', limit: 25 });
  assert.match(query.text, /LEFT JOIN traffic_visits/);
  assert.match(query.text, /ORDER BY c\.clicked_at DESC/);
  assert.match(query.text, /LIMIT \$4/);
  assert.deepEqual(query.params, ['2026-11-01', '2026-11-12', 'bongacams', 25]);
  assert.doesNotMatch(query.text, /DELETE|UPDATE|INSERT|TRUNCATE/i);
});

test('maps a click to a room and preserves unknown source evidence', () => {
  const row = trace.mapRow({
    id: '17', clicked_at: '2026-11-12T10:00:00.000Z', click_id: 'ncf_test',
    country: 'US', platform: 'chaturbate', category: 'male',
    source: 'unknown', source_evidence: 'unknown', content: 'room-sample:homepage',
    visit_id: null, is_bot: false, bot_reason: null, visit_traffic_class: null
  });
  assert.equal(row.room, 'sample');
  assert.equal(row.trafficClass, 'unclassified');
  assert.equal(row.source, 'unknown');
  assert.equal(row.visitId, null);
});
