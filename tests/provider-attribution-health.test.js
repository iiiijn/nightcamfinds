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
  assert.match(q.callbacks.text, /AS invalid_callback/);
  assert.ok(q.callbacks.text.includes("COALESCE(cc.conversion_type, '')"));
  assert.ok(q.callbacks.text.includes("COALESCE(cc.currency, '')"));
  assert.ok(q.callbacks.text.includes('NOT (EXISTS'));
  assert.match(q.clicks.text, /FROM affiliate_clicks/);
  assert.doesNotMatch(q.clicks.text, /2026-11/);
});

test('builds a read-only, date-filtered two-way orphan ledger audit', () => {
  const q = health.buildQueries({ from: '2026-11-01', to: '2026-11-07' });
  assert.deepEqual(q.orphans.params, ['2026-11-01', '2026-11-07']);
  assert.match(q.orphans.text, /FROM cb_clicks cb/);
  assert.match(q.orphans.text, /FROM bonga_clicks bc/);
  assert.match(q.orphans.text, /NOT EXISTS/);
  assert.match(q.orphans.text, /affiliate_clicks ac/);
  assert.match(q.orphans.text, /cb\.clicked_at/);
  assert.match(q.orphans.text, /bc\.clicked_at/);
  assert.doesNotMatch(q.orphans.text, /\b(?:INSERT|UPDATE|DELETE)\b/i);
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


test('reports click ID generation and local provider-ledger coverage separately', () => {
  const q = health.buildQueries({ from: '2026-11-01' });
  assert.match(q.clicks.text, /click_ids_generated/);
  assert.match(q.clicks.text, /clicks_without_click_id/);
  assert.match(q.clicks.text, /local_ledger_entries/);
  assert.match(q.clicks.text, /LEFT JOIN cb_clicks cb/);
  assert.match(q.clicks.text, /LEFT JOIN bonga_clicks bc/);
  assert.ok(q.clicks.text.includes('ac.clicked_at >='));
  assert.deepEqual(q.clicks.params, ['2026-11-01']);
});

const fs = require('node:fs');
const path = require('node:path');
const routeSource = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const dashboardSource = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');

test('exposes missing BongaCams local-ledger entries and coverage in provider health', () => {
  assert.match(routeSource, /clickIdsMissingFromLedger = Math\.max\(0, entry\.clickIdsGenerated - entry\.localLedgerEntries\)/);
  assert.match(routeSource, /ledgerCoveragePercent/);
  assert.match(dashboardSource, /missing local entries:/);
  assert.match(dashboardSource, /ledgerCoveragePercent/);
});

test('BongaCams primary click and platform ledger writes share one transaction', () => {
  const start = serverSource.indexOf('async function countClick(');
  const end = serverSource.indexOf('async function statsFromDb()', start);
  assert.ok(start >= 0 && end > start, 'click writer is present');
  const writer = serverSource.slice(start, end);
  const begin = writer.indexOf('await client.query("BEGIN")');
  const primary = writer.indexOf('INSERT INTO affiliate_clicks');
  const ledger = writer.indexOf('INSERT INTO bonga_clicks');
  const commit = writer.indexOf('await client.query("COMMIT")');
  const rollback = writer.indexOf('await client.query("ROLLBACK")');
  assert.ok(begin >= 0 && primary > begin && ledger > primary && commit > ledger);
  assert.ok(rollback > begin, 'failed writes roll back the transaction');
  assert.match(writer, /ON CONFLICT \(click_id\) DO NOTHING/);
});

test('provider health endpoint includes two-way orphan counts without changing click totals', () => {
  assert.match(routeSource, /queries\.orphans\.text, queries\.orphans\.params/);
  assert.match(routeSource, /orphanedLedgerEntries \+= Number\(row\.orphaned_ledger_entries \|\| 0\)/);
  assert.match(routeSource, /invalidCallbacks: Number\(c\.invalid_callback \|\| 0\)/);
  assert.match(dashboardSource, /Invalid callbacks: '\+n\(c\.invalidCallbacks\)/);
  assert.match(dashboardSource, /orphaned ledger rows:/);
});
