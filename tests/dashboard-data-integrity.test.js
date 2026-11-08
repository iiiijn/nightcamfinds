'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildQuery } = require('../src/services/conversion-revenue.cjs');

const routeSource = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');

test('headline Chaturbate totals exclude macro-placeholder callbacks and non-USD payouts', () => {
  assert.match(routeSource, /NOT EXISTS \(SELECT 1 FROM jsonb_each_text\(COALESCE\(cb_conversions\.raw_payload, '\{\}'::jsonb\)\)/);
  assert.ok(routeSource.includes("p.value ~ '^[{][A-Za-z][A-Za-z0-9_]*[}]$'"));
  assert.match(routeSource, /UPPER\(COALESCE\(currency,''\)\)='USD'/);
  assert.match(routeSource, /const conversionWhere = conv\.where \? conv\.where \+ " AND " \+ testCallbackExclusion : "WHERE " \+ testCallbackExclusion/);
  assert.ok(routeSource.includes('"FROM cb_conversions",\n      conversionWhere'));
});

test('conversion detail report identifies placeholder callbacks without assigning a false match', () => {
  const query = buildQuery({ from: '2026-11-01', to: '2026-11-09' });
  assert.equal(query.error, undefined);
  assert.ok(query.text.includes("payload.value ~ '^[{][A-Za-z][A-Za-z0-9_]*[}]$'"));
  assert.ok(query.text.includes('AS is_test'));
  assert.ok(query.text.includes('ORDER BY is_test ASC'));
});

test('dashboard country summary contains affiliate click geography only', () => {
  assert.match(routeSource, /FROM affiliate_clicks \$\{cb\.where\}[\s\S]*?countries\[country\]/);
  assert.match(routeSource, /const combinedCountries = \{ \.\.\.countries \};/);
  const countryStart = routeSource.indexOf('  const combinedCountries = { ...countries };');
  const countryEnd = routeSource.indexOf('  return {', countryStart);
  assert.ok(countryStart >= 0 && countryEnd > countryStart);
  const countrySummary = routeSource.slice(countryStart, countryEnd);
  assert.ok(!countrySummary.includes('bonga.byCountry'));
  assert.ok(!countrySummary.includes('bonga.registrations'));
});
