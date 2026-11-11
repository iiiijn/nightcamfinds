'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SOURCE_EVIDENCE, normalizeSourceEvidence } = require('../src/services/source-evidence.cjs');
const fs = require('node:fs');
const path = require('node:path');

test('source evidence accepts only the documented capture methods', () => {
  assert.deepEqual(SOURCE_EVIDENCE, ['url_parameter', 'browser_referrer', 'stored_attribution', 'unknown']);
  for (const value of SOURCE_EVIDENCE) assert.equal(normalizeSourceEvidence(value), value);
  assert.equal(normalizeSourceEvidence('legacy'), 'unknown');
  assert.equal(normalizeSourceEvidence('forged_method'), 'unknown');
  assert.equal(normalizeSourceEvidence(''), 'unknown');
});

test('source evidence migration preserves historical attribution as legacy', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../sql/009_click_source_evidence.sql'), 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS source_evidence VARCHAR\(32\) NOT NULL DEFAULT 'legacy'/i);
  assert.match(migration, /ALTER COLUMN source SET DEFAULT 'unknown'/i);
  assert.match(migration, /'url_parameter'.*'browser_referrer'.*'stored_attribution'.*'unknown'.*'legacy'/s);
});

test('migration plan includes source evidence for production and staging', () => {
  const plan = require('../scripts/migration-plan');
  assert.ok(plan.getMigrationPlan('main').some(x => x.version === '009_click_source_evidence'));
  assert.ok(plan.getMigrationPlan('preview').some(x => x.version === '009_click_source_evidence'));
});
