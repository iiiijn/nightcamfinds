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
  assert.match(migration, /CHECK \(source_evidence IN \('url_parameter', 'browser_referrer', 'stored_attribution', 'unknown', 'legacy'\)\)/);
});

test('migration plan includes source evidence for production and staging', () => {
  const plan = require('../scripts/migration-plan');
  assert.ok(plan.getMigrationPlan('main').some(x => x.version === '009_click_source_evidence'));
  assert.ok(plan.getMigrationPlan('preview').some(x => x.version === '009_click_source_evidence'));
});

test('directory, promo and country links carry their source evidence method to affiliate redirects', () => {
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const promo = fs.readFileSync(path.join(__dirname, '../public/promo.js'), 'utf8');
  const country = fs.readFileSync(path.join(__dirname, '../country-pages.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, '../src/services/room-page-renderer.cjs'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(app, /evidence: trafficSourceEvidence/);
  assert.match(promo, /evidence: attr\.sourceEvidence/);
  assert.match(country, /evidence: attribution\.sourceEvidence/);
  assert.match(renderer, /source: "unknown"/);
  assert.match(renderer, /evidence: "unknown"/);
  assert.match(server, /normalizeSourceEvidence\(url\.searchParams\.get\("evidence"\)\)/);
  assert.match(server, /sourceEvidence, campaign, medium/);
});

test('dashboard click reports display and filter by source evidence without claiming verification', () => {
  const dashboard = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  const route = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  assert.match(dashboard, /id="originsEvidence"/);
  assert.match(dashboard, /Source evidence/);
  assert.match(dashboard, /originsEvidence').addEventListener\('change',loadClickOrigins/);
  assert.match(dashboard, /x\.sourceEvidence/);
  assert.match(route, /sourceEvidence: row\.source_evidence/);
  assert.match(route, /URL parameters are self-reported/);
});
