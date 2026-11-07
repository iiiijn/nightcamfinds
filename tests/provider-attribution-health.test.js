'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const health = require('../src/services/provider-attribution-health.cjs');

test('builds separate parameterized UTC windows for callbacks and clicks', () => {
  const q = health.buildQueries({ from: '2026-11-01', to: '2026-11-07' });
  assert.deepEqual(q.callbacks.params, ['2026-11-01', '2026-11-07']);
  assert.deepEqual(q.clicks.params, ['2026-11-01', '2026-11-07']);
  assert.match(q.callbacks.text, /FROM cb_conversions cc/);
  assert.match(q.callbacks.text, /missing_click_id/);
  assert.match(q.callbacks.text, /click_id_not_found/);
  assert.match(q.callbacks.text, /AS test/);
  assert.match(q.clicks.text, /FROM affiliate_clicks/);
  assert.doesNotMatch(q.clicks.text, /2026-11/);
});

test('rejects invalid and reversed dates', () => {
  assert.match(health.buildQueries({ from: '2026-02-31' }).error, /calendar dates/);
  assert.match(health.buildQueries({ from: '2026-11-08', to: '2026-11-07' }).error, /on or before/);
});

test('supports all-time reports without date predicates', () => {
  const q = health.buildQueries({});
  assert.deepEqual(q.callbacks.params, []);
  assert.deepEqual(q.clicks.params, []);
  assert.doesNotMatch(q.callbacks.text, /\nWHERE /);
  assert.doesNotMatch(q.clicks.text, /\nWHERE /);
});
