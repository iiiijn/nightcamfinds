'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
const dashboardBusiness = fs.readFileSync(path.join(__dirname, '../public/dashboard-business.js'), 'utf8');

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
    /traffic:\[loadDailyCountryAnalytics,loadTrafficQualityAnalytics,loadTrafficSinceCutoff,loadOwnerTrafficMode,loadClickOrigins(?:,loadRepeatedClickIntelligence)?\]/,
    /investigation:\[loadRecentRoomClicks,loadIndividualClickTrace\]/,
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


test('final restored dashboard keeps repeated-click intelligence visible and loaded in Traffic Intelligence', () => {
  assert.match(dashboardBusiness, /'Repeated-click intelligence':'traffic'/, 'restored panel mapping should include repeated-click intelligence');
  assert.match(dashboardBusiness, /traffic:\[loadDailyCountryAnalytics,loadTrafficQualityAnalytics,loadTrafficSinceCutoff,loadOwnerTrafficMode,loadClickOrigins,loadRepeatedClickIntelligence\]/, 'final traffic loader should request the repeated-click report');
  assert.match(dashboard, /async function loadRepeatedClickIntelligence\(\)/, 'report loader should be defined in dashboard HTML');
});
