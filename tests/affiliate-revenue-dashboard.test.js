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
  assert.match(helper, /if \(row\.isTest\)/);
  assert.match(helper, /CREDITED_EVENT_TYPES\.has/);
  assert.match(attribution, /LOWER\(cc\.conversion_type\) IN/);
  assert.match(attribution, /cc\.matched_click IS TRUE/);
});
