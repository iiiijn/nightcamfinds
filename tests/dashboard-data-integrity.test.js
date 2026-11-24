'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildQuery } = require('../src/services/conversion-revenue.cjs');

const routeSource = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');

test('headline Chaturbate totals use matched callback integrity and currency-separated payouts', () => {
  assert.match(routeSource, /invalidCallbackPredicate\("cc"\)/);
  assert.match(routeSource, /conversionWhere = conv\.where \? conv\.where \+ " AND NOT " \+ testCallbackExclusion/);
  assert.match(routeSource, /UPPER\(COALESCE\(NULLIF\(cc\.currency,''\),'UNSPECIFIED'\)\) AS currency/);
  assert.match(routeSource, /earningsByCurrency/);
  assert.match(routeSource, /if \(currency === "USD"\) cbEarnings = earnings/);
  assert.match(routeSource, /revshare_webmaster-commission/);
  assert.ok(routeSource.includes('"FROM cb_conversions cc",'));
});
test('conversion detail report identifies placeholder callbacks without assigning a false match', () => {
  const query = buildQuery({ from: '2026-11-01', to: '2026-11-09' });
  assert.equal(query.error, undefined);
  assert.ok(query.text.includes("payload.value ~ '^[{][A-Za-z][A-Za-z0-9_]*[}]$'"));
  assert.ok(query.text.includes('AS is_test'));
  assert.ok(query.text.includes('ORDER BY is_test ASC'));
});

test('dashboard country summary contains affiliate click geography only', () => {
  assert.match(routeSource, /FROM affiliate_clicks \$\{businessClickWhere\}[\s\S]*?countries\[country\]/);
  assert.match(routeSource, /const combinedCountries = \{ \.\.\.countries \};/);
  const countryStart = routeSource.indexOf('  const combinedCountries = { ...countries };');
  const countryEnd = routeSource.indexOf('  return {', countryStart);
  assert.ok(countryStart >= 0 && countryEnd > countryStart);
  const countrySummary = routeSource.slice(countryStart, countryEnd);
  assert.ok(!countrySummary.includes('bonga.byCountry'));
  assert.ok(!countrySummary.includes('bonga.registrations'));
});

test('main dashboard separates eligible events, actual payouts and member spend', () => {
  const dashboard = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  assert.match(dashboard, /function summarizeDashboardConversions/);
  assert.match(dashboard, /reportedSpend/);
  assert.match(dashboard, /matchedPayouts/);
  assert.match(dashboard, /pendingPayouts/);
  assert.match(dashboard, /matchedMemberSpend/);
  assert.match(dashboard, /Unsupported · excluded from totals/);
});
