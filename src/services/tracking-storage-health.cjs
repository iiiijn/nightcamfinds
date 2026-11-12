'use strict';

const state = {
  schemaFallbacks: 0,
  localFallbackClicks: 0,
  postgresWriteFailures: 0,
  lastFailureAt: null,
  lastFailureCode: null,
  lastFailureStage: null
};

function recordFailure(stage, error, codeOverride) {
  state.lastFailureAt = new Date().toISOString();
  state.lastFailureCode = codeOverride || (error && error.code ? String(error.code) : error ? 'unknown' : null);
  state.lastFailureStage = stage;
}

function recordSchemaFallback(error) {
  state.schemaFallbacks += 1;
  state.postgresWriteFailures += 1;
  recordFailure('legacy_schema_fallback', error);
}

function recordLocalFallback(error, reason) {
  state.localFallbackClicks += 1;
  if (error) {
    state.postgresWriteFailures += 1;
    recordFailure('local_json_fallback', error);
  } else if (reason) {
    recordFailure('database_not_configured', null, reason);
  }
}

function snapshot() {
  return { ...state };
}

function resetForTests() {
  state.schemaFallbacks = 0;
  state.localFallbackClicks = 0;
  state.postgresWriteFailures = 0;
  state.lastFailureAt = null;
  state.lastFailureCode = null;
  state.lastFailureStage = null;
}

module.exports = { recordSchemaFallback, recordLocalFallback, snapshot, resetForTests };
