'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');

test('dashboard uses one shared loader for restored sessions and fresh sign-ins', () => {
  const start = dashboard.indexOf('async function loadDashboardData()');
  const end = dashboard.indexOf('async function check()', start);
  assert.ok(start >= 0 && end > start, 'shared dashboard loader should exist before auth checks');
  const loader = dashboard.slice(start, end);

  for (const report of [
    'load()', 'loadRouteSettings()', 'loadDailyCountryAnalytics()',
    'loadCountryCategoryAnalytics()', 'loadTrafficQualityAnalytics()',
    'loadClickOrigins()', 'loadRecentRoomClicks()', 'loadCampaignPerformance()',
    'loadTrafficRevenuePerformance()', 'loadConversionRevenue()',
    'loadProviderAttributionHealth()', 'loadConversionFunnel()'
  ]) {
    assert.ok(loader.includes(report), 'shared loader should initialize ' + report);
  }
});

test('both restored sessions and successful login initialize the complete dashboard', () => {
  assert.match(dashboard, /async function check\(\)[\s\S]*?showDashboard\(j\.username\);await loadDashboardData\(\)/);
  assert.match(dashboard, /async function login\(e\)[\s\S]*?showDashboard\(j\.username\);await loadDashboardData\(\)/);
});
