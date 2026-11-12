'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
const script = dashboard.slice(dashboard.indexOf('<script>'), dashboard.indexOf('</script>'));

test('dashboard removes duplicated source, country, device and mislabeled placement summaries', () => {
  assert.doesNotMatch(dashboard, /<h2>Traffic sources<\/h2>/);
  assert.doesNotMatch(dashboard, /<h2>Countries<\/h2>/);
  assert.doesNotMatch(dashboard, /<h2>Devices<\/h2>/);
  assert.doesNotMatch(dashboard, /<h2>Source × promo placement<\/h2>/);
  assert.match(dashboard, /<h2>Promo placement performance<\/h2>/);
  assert.match(dashboard, /<h2>Click origins report<\/h2>/);
  assert.match(dashboard, /<h2>Daily clicks by country<\/h2>/);
});

test('dashboard platform comparison no longer repeats overall totals in a footer', () => {
  assert.match(dashboard, /<h2>Platform performance<\/h2>/);
  assert.doesNotMatch(dashboard, /id="totalClicksRow"|id="totalEarningsRow"|id="totalEpcRow"/);
  assert.match(dashboard, /id="totalClicks"/);
  assert.match(dashboard, /id="totalEarnings"/);
});

test('dashboard labels registrations and purchases as events rather than unique-user conversion rate', () => {
  assert.match(dashboard, /Reported events \/ click/);
  assert.match(dashboard, /not unique people/);
  assert.match(script, /\$\('conversion'\)\.textContent=pct\(regs\+pur,total\)/);
});

test('dashboard keeps provider diagnostics separate from traffic-channel tag signals', () => {
  assert.match(dashboard, /<h2>Provider attribution health<\/h2>/);
  assert.match(dashboard, /<h2>Traffic channel signals<\/h2>/);
  assert.doesNotMatch(dashboard, /id="cbHealth"|id="bcHealth"/);
  assert.match(script, /setHealth\('xHealth'/);
  assert.match(script, /setHealth\('tgHealth'/);
  assert.match(script, /setHealth\('adsHealth'/);
});

test('dashboard loads report groups on tab selection and caches GET responses briefly', () => {
  assert.match(script, /async function loadDashboardTab\(tab,force=false\)/);
  assert.match(script, /overview:\[loadRoomCoverage,load,loadRouteSettings,loadCountryCategoryAnalytics\]/);
  assert.match(script, /traffic:\[loadDailyCountryAnalytics,loadTrafficQualityAnalytics,loadClickOrigins\]/);
  assert.match(script, /investigation:\[loadRecentRoomClicks,loadIndividualClickTrace\]/);
  assert.match(script, /revenue:\[loadCampaignPerformance,loadTrafficRevenuePerformance,loadConversionRevenue,loadConversionFunnel\]/);
  assert.match(script, /health:\[loadProviderAttributionHealth\]/);
  assert.match(script, /dashboardLoadedTabs\.has\(key\)/);
  assert.match(script, /dashboardApiCache=new Map\(\)/);
  assert.match(script, /now\+15000/);
  assert.match(script, /if\(response\.ok\)dashboardApiCache\.clear\(\)/);
  assert.match(script, /function refreshDashboardReport\(loader\)/);
  assert.doesNotMatch(script, /Promise\.all\(\[loadRoomCoverage\(\),load\(\),loadRouteSettings\(\),loadDailyCountryAnalytics\(\),loadCountryCategoryAnalytics\(\),loadTrafficQualityAnalytics\(\),loadClickOrigins\(\),loadRecentRoomClicks\(\),loadCampaignPerformance\(\),loadTrafficRevenuePerformance\(\),loadConversionRevenue\(\),loadProviderAttributionHealth\(\),loadConversionFunnel\(\)\]\)/);
});
