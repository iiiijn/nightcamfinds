'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const analytics = require('../src/services/daily-country-analytics.cjs');

test('Tier 1 analytics list contains all 18 configured country markets', () => {
  assert.equal(analytics.TIER1_COUNTRIES.length, 18);
  assert.equal(new Set(analytics.TIER1_COUNTRIES).size, 18);
  assert.ok(analytics.TIER1_COUNTRIES.includes('NO'));
  assert.ok(analytics.TIER1_COUNTRIES.includes('CH'));
  assert.ok(analytics.TIER1_COUNTRIES.includes('IS'));
  assert.ok(analytics.TIER1_COUNTRIES.includes('LU'));
  assert.ok(!analytics.TIER1_COUNTRIES.includes('JP'));
  assert.ok(!analytics.TIER1_COUNTRIES.includes('SG'));
});

test('daily filters accept valid date, country and Tier 1 filters', () => {
  const parsed = analytics.parseFilters(new URLSearchParams('from=2026-11-01&to=2026-11-06&country=IE&tier1=true'));
  assert.deepEqual(parsed, { value: { from: '2026-11-01', to: '2026-11-06', country: 'IE', tier1: true } });
});

test('daily filters reject invalid calendar dates and reversed ranges', () => {
  assert.match(analytics.parseFilters(new URLSearchParams('from=bad')).error, /calendar dates/);
  assert.match(analytics.parseFilters(new URLSearchParams('from=2026-02-31')).error, /calendar dates/);
  assert.match(analytics.parseFilters(new URLSearchParams('from=2026-11-06&to=2026-11-01')).error, /on or before/);
});

test('country filter rejects malformed values', () => {
  assert.match(analytics.parseFilters(new URLSearchParams('country=USA')).error, /two-letter/);
});

test('daily query uses parameterized filters and UTC day boundaries', () => {
  const built = analytics.buildQuery({ from: '2026-11-01', to: '2026-11-06', country: 'IE', tier1: true });
  assert.deepEqual(built.params, ['2026-11-01', '2026-11-06', analytics.TIER1_COUNTRIES, 'IE']);
  assert.match(built.text, /AT TIME ZONE 'UTC'/);
  assert.match(built.text, /engaged_at IS NOT NULL/);
  assert.match(built.text, /LIMIT 20000/);
  const fallback = analytics.buildQuery({ from: '', to: '', country: 'ALL', tier1: false }, { includeEngagement: false });
  assert.match(fallback.text, /NULL::int AS engaged_clicks/);
  assert.doesNotMatch(fallback.text, /engaged_at/);
  assert.doesNotMatch(built.text, /2026-11-01|IE/);
});

test('dashboard login loads daily country analytics through shared initialization after successful sign-in', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  const loaderStart = html.indexOf('async function loadDashboardData()');
  const checkStart = html.indexOf('async function check()', loaderStart);
  const loginStart = html.indexOf('async function login(e)');
  const loginEnd = html.indexOf('async function logout()', loginStart);
  assert.ok(loaderStart >= 0 && checkStart > loaderStart);
  assert.ok(loginStart >= 0 && loginEnd > loginStart);
  const tabLoaderStart = html.indexOf('async function loadDashboardTab(tab,force=false)');
  const tabLoaderEnd = html.indexOf('function setDashboardTab(tab)', tabLoaderStart);
  assert.ok(tabLoaderStart >= 0 && tabLoaderEnd > tabLoaderStart);
  assert.match(html.slice(tabLoaderStart, tabLoaderEnd), /traffic:\[loadDailyCountryAnalytics,loadTrafficQualityAnalytics,loadClickOrigins\]/);
  assert.match(html.slice(loginStart, loginEnd), /showDashboard\(j\.username\);await loadDashboardData\(\)/);
});
