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

  assert.match(loader, /dashboardLoadedTabs\.clear\(\)/);
  assert.match(loader, /await loadDashboardTab\(activeDashboardTab,true\)/);
  const tabLoaderStart = dashboard.indexOf('async function loadDashboardTab(tab,force=false)');
  const tabLoaderEnd = dashboard.indexOf('function setDashboardTab(tab)', tabLoaderStart);
  assert.ok(tabLoaderStart >= 0 && tabLoaderEnd > tabLoaderStart, 'tab loader should exist');
  const tabLoader = dashboard.slice(tabLoaderStart, tabLoaderEnd);
  for (const group of [
    /overview:\[loadRoomCoverage,load,loadRouteSettings,loadCountryCategoryAnalytics\]/,
    /traffic:\[loadDailyCountryAnalytics,loadTrafficQualityAnalytics,loadClickOrigins\]/,
    /investigation:\[loadRecentRoomClicks\]/,
    /revenue:\[loadCampaignPerformance,loadTrafficRevenuePerformance,loadConversionRevenue,loadConversionFunnel\]/,
    /health:\[loadProviderAttributionHealth\]/
  ]) {
    assert.match(tabLoader, group, 'each dashboard section should have its own loader group');
  }
});

test('both restored sessions and successful login initialize the complete dashboard', () => {
  assert.match(dashboard, /async function check\(\)[\s\S]*?showDashboard\(j\.username\);await loadDashboardData\(\)/);
  assert.match(dashboard, /async function login\(e\)[\s\S]*?showDashboard\(j\.username\);await loadDashboardData\(\)/);
});
