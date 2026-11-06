'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const origins = require('../src/services/click-origins.cjs');

test('accepts valid origin report filters', () => {
  assert.deepEqual(origins.parseFilters(new URLSearchParams('from=2026-11-01&to=2026-11-07&country=US&platform=chaturbate&category=male&source=x')), {
    value: { from: '2026-11-01', to: '2026-11-07', country: 'US', platform: 'chaturbate', category: 'male', source: 'x' }
  });
});

test('rejects invalid dates, platform, category, country and source filters', () => {
  assert.match(origins.parseFilters(new URLSearchParams('from=2026-02-31')).error, /calendar dates/);
  assert.match(origins.parseFilters(new URLSearchParams('country=USA')).error, /two-letter/);
  assert.match(origins.parseFilters(new URLSearchParams('platform=other')).error, /Platform/);
  assert.match(origins.parseFilters(new URLSearchParams('category=unknown')).error, /Category/);
  assert.match(origins.parseFilters(new URLSearchParams('source=x%20OR%201=1')).error, /Source/);
});

test('builds a parameterized aggregation across country, platform, category and attribution dimensions', () => {
  const built = origins.buildQuery({ from: '2026-11-01', to: '2026-11-07', country: 'US', platform: 'chaturbate', category: 'male', source: 'x' });
  assert.deepEqual(built.params, ['2026-11-01', '2026-11-07', 'US', 'chaturbate', 'male', 'x']);
  assert.match(built.text, /GROUP BY 1,2,3,4,5,6,7,8,9,10,11/);
  assert.match(built.text, /landing_path/);
  assert.match(built.text, /placement/);
  assert.doesNotMatch(built.text, /2026-11-01|chaturbate|x/);
  assert.match(built.text, /LIMIT 2000/);
});

test('uses no raw IP, exact location, names or email fields', () => {
  const built = origins.buildQuery({ from: '', to: '', country: 'ALL', platform: 'ALL', category: 'ALL', source: 'ALL' });
  assert.doesNotMatch(built.text, /ip_address|user_agent|email|full_name|latitude|longitude/i);
});
