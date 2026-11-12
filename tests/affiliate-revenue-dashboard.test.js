'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const page = fs.readFileSync(path.join(__dirname, '../public/revenue.html'), 'utf8');
const helper = fs.readFileSync(path.join(__dirname, '../public/revenue-summary.js'), 'utf8');
const attribution = fs.readFileSync(path.join(__dirname, '../src/services/traffic-revenue-performance.cjs'), 'utf8');

test('revenue dashboard uses authenticated, date-filtered reporting endpoints', () => {
  assert.match(page, /\/api\/auth\/login/);
  assert.match(page, /\/api\/dashboard-stats\?/);
  assert.match(page, /\/api\/conversion-revenue\?/);
  assert.match(page, /\/api\/traffic-revenue-performance\?/);
  assert.match(page, /\/api\/bongacash-reconciliation\?/);
  assert.match(page, /credentials:'same-origin'/);
});

test('revenue dashboard labels manual BongaCash reconciliation separately', () => {
  assert.match(page, /BongaCash manual USD/);
  assert.match(page, /not click-attributed/);
  assert.match(page, /Different currencies are never added together/);
});

test('revenue calculations exclude test events and unsupported conversion types', () => {
  assert.match(helper, /row\.isTest/);
  assert.match(helper, /CREDITED_EVENT_TYPES\.has/);
  assert.match(attribution, /LOWER\(cc\.conversion_type\) IN/);
  assert.match(attribution, /cc\.matched_click IS TRUE/);
});

test('dashboard business statistics exclude known internal test and audit clicks', () => {
  const route = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  const start = route.indexOf('async function dashboardStats(incoming) {');
  const end = route.indexOf('\n}\n', start);
  const stats = route.slice(start, end);
  assert.match(stats, /businessClickWhere/);
  assert.match(stats, /source, ''\)\) <> 'test'/);
  assert.match(stats, /test_female_01', 'revshare_audit_01/);
  assert.match(stats, /invalidCallbackPredicate\("cc"\)/);
  assert.match(stats, /earningsByCurrency/);
  assert.match(stats, /revshare_webmaster-commission/);
  assert.match(stats, /const where = x\.where \? x\.where \+ " AND " \+ internalTrafficExclusion/);
});
