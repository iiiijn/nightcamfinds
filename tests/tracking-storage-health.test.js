'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const health = require('../src/services/tracking-storage-health.cjs');

test('records schema fallback and generic PostgreSQL write failures separately', () => {
  health.resetForTests();
  const schemaError = Object.assign(new Error('missing column'), { code: '42703' });
  health.recordSchemaFallback(schemaError);
  health.recordLocalFallback(Object.assign(new Error('connection lost'), { code: 'ECONNRESET' }));
  const state = health.snapshot();
  assert.equal(state.schemaFallbacks, 1);
  assert.equal(state.localFallbackClicks, 1);
  assert.equal(state.postgresWriteFailures, 2);
  assert.equal(state.lastFailureCode, 'ECONNRESET');
  assert.equal(state.lastFailureStage, 'local_json_fallback');
  assert.ok(state.lastFailureAt);
});

test('records database-not-configured fallback without misreporting a PostgreSQL write failure', () => {
  health.resetForTests();
  health.recordLocalFallback(null, 'database_not_configured');
  const state = health.snapshot();
  assert.equal(state.schemaFallbacks, 0);
  assert.equal(state.localFallbackClicks, 1);
  assert.equal(state.postgresWriteFailures, 0);
  assert.equal(state.lastFailureCode, 'database_not_configured');
  assert.equal(state.lastFailureStage, 'database_not_configured');
});

test('snapshot returns a copy that cannot mutate the counters', () => {
  health.resetForTests();
  health.recordLocalFallback(new Error('failure'));
  const snapshot = health.snapshot();
  snapshot.localFallbackClicks = 999;
  assert.equal(health.snapshot().localFallbackClicks, 1);
  health.resetForTests();
});
