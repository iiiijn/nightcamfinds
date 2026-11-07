'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyUserAgent, mergeTrafficClass, normalizeVisitId, normalizeEvent, createEngagementRateLimiter, newVisitId, nairobiWeekBounds } = require('../src/services/traffic-quality.cjs');

test('classifies known crawlers separately from suspected automation', () => {
  assert.equal(classifyUserAgent('Googlebot/2.1'), 'known_bot');
  assert.equal(classifyUserAgent('curl/8.1'), 'suspected_bot');
  assert.equal(classifyUserAgent('Mozilla/5.0 Chrome/120 Safari/537.36'), 'unverified');
  assert.equal(classifyUserAgent(''), 'unverified');
});

test('traffic classification keeps the strongest evidence and never downgrades a visit', () => {
  assert.equal(mergeTrafficClass('unverified', 'suspected_bot'), 'suspected_bot');
  assert.equal(mergeTrafficClass('suspected_bot', 'known_bot'), 'known_bot');
  assert.equal(mergeTrafficClass('known_bot', 'unverified'), 'known_bot');
  assert.equal(mergeTrafficClass('suspected_bot', 'unverified'), 'suspected_bot');
  assert.equal(mergeTrafficClass('unverified', 'unverified'), 'unverified');
});

test('engagement endpoint uses the persisted effective classification before counting engagement', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const route = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  const start = route.indexOf('if (incoming.pathname === "/api/engage")');
  const end = route.indexOf('if (incoming.pathname === "/api/traffic-quality-analytics")', start);
  const endpoint = route.slice(start, end);
  assert.match(endpoint, /RETURNING traffic_class/);
  assert.match(endpoint, /const effectiveTrafficClass = visit\.rows\[0\]\?\.traffic_class \|\| trafficClass/);
  assert.match(endpoint, /\[event\.visitId,event\.eventType,event\.pagePath,effectiveTrafficClass\]/);
  assert.match(endpoint, /eligibleForEngagementMetrics: effectiveTrafficClass === "unverified"/);
});

test('affiliate redirect writes preserve the strongest visit classification', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const start = server.indexOf('INSERT INTO traffic_visits');
  const end = server.indexOf(');', start);
  const upsert = server.slice(start, end);
  assert.match(upsert, /traffic_class = CASE WHEN traffic_visits\.traffic_class/);
  assert.match(upsert, /EXCLUDED\.traffic_class = 'known_bot'/);
  assert.match(upsert, /EXCLUDED\.traffic_class = 'suspected_bot'/);
});

test('creates and validates privacy-preserving random visit identifiers', () => {
  const id = newVisitId();
  assert.match(id, /^[a-f0-9]{32}$/);
  assert.equal(normalizeVisitId(id), id);
  assert.equal(normalizeVisitId('visitor-123'), null);
});

test('accepts only supported engagement events and safe local paths', () => {
  const visitId = 'a'.repeat(32);
  assert.deepEqual(normalizeEvent({ visitId, eventType: 'active_10s', pagePath: '/female/' }), {
    value: { visitId, eventType: 'active_10s', pagePath: '/female/' }
  });
  assert.equal(normalizeEvent({ visitId, eventType: 'page_view', pagePath: '/' }).error, 'Unsupported engagement event.');
  assert.equal(normalizeEvent({ visitId, eventType: 'scroll_50', pagePath: '//evil.test' }).error, 'Invalid page path.');
  assert.equal(normalizeEvent({ visitId: 'bad', eventType: 'scroll_50', pagePath: '/' }).error, 'Invalid visit identifier.');
});

test('uses Monday-to-Monday UTC boundaries for Nairobi calendar weeks', () => {
  const bounds = nairobiWeekBounds(new Date('2026-11-04T12:00:00.000Z')); // Wednesday, 15:00 EAT
  assert.equal(bounds.from, '2026-11-01T21:00:00.000Z'); // Monday 00:00 EAT
  assert.equal(bounds.toExclusive, '2026-11-08T21:00:00.000Z');
});

test('handles Nairobi week boundary exactly at Monday local midnight', () => {
  const bounds = nairobiWeekBounds(new Date('2026-11-02T21:00:00.000Z'));
  assert.equal(bounds.from, '2026-11-01T21:00:00.000Z');
  assert.equal(bounds.toExclusive, '2026-11-08T21:00:00.000Z');
});

test('traffic quality analytics separates bot, unverified and unclassified affiliate redirects', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const route = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  const dashboard = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  assert.match(route, /LEFT JOIN traffic_visits v ON v\.visit_id=c\.visit_id/);
  assert.match(route, /ELSE 'unclassified'/);
  assert.match(route, /knownBotAffiliateClicks/);
  assert.match(route, /suspectedBotAffiliateClicks/);
  assert.match(route, /unverifiedAffiliateClicks/);
  assert.match(route, /unclassifiedAffiliateClicks/);
  assert.match(route, /clicksWithoutVisitId/);
  assert.match(route, /clicksWithMissingVisitRecord/);
  assert.match(route, /missing_visit_id/);
  assert.match(route, /missing_visit_record/);
  assert.match(route, /legacy records from before visit tracking was introduced/);
  assert.match(dashboard, /Legacy clicks without visit IDs/);
  assert.match(dashboard, /Clicks with missing visit records/);
  assert.match(dashboard, /All tracked affiliate redirects/);
  assert.match(dashboard, /Known-bot affiliate redirects/);
  assert.match(dashboard, /Unclassified affiliate redirects/);
  assert.match(dashboard, /main platform and country click totals remain raw redirect counts/);
});


test('affiliate click database writes are atomic across primary, visit and platform ledgers', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const start = server.indexOf('async function countClick(');
  const end = server.indexOf('async function statsFromDb()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const writer = server.slice(start, end);
  assert.match(writer, /await pgPool\.connect\(\)/);
  assert.match(writer, /await client\.query\(["']BEGIN["']\)/);
  assert.match(writer, /await client\.query\(["']COMMIT["']\)/);
  assert.match(writer, /await client\.query\(["']ROLLBACK["']\)/);
  assert.match(writer, /finally\s*\{\s*if\s*\(client\)\s*client\.release\(\)/);
  assert.match(writer, /INSERT INTO affiliate_clicks/);
  assert.match(writer, /INSERT INTO traffic_visits/);
  assert.match(writer, /INSERT INTO cb_clicks/);
  assert.match(writer, /INSERT INTO bonga_clicks/);
  assert.ok(writer.indexOf('await client.query("COMMIT")') > writer.indexOf('INSERT INTO bonga_clicks'));
});

test('limits engagement submissions per anonymous visit without storing IP addresses', () => {
  const allow = createEngagementRateLimiter({ perMinute: 2, perHour: 3 });
  const id = 'b'.repeat(32);
  assert.equal(allow(id, 1000), true);
  assert.equal(allow(id, 2000), true);
  assert.equal(allow(id, 3000), false);
  assert.equal(allow(id, 61000), true);
  assert.equal(allow('invalid', 62000), false);
});

test('banner affiliate links retain the visit ID and original landing path', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const promo = fs.readFileSync(path.join(__dirname, '../public/promo.js'), 'utf8');
  assert.match(promo, /vid: currentVisitId/);
  assert.match(promo, /lp: originalLandingPath\.slice\(0, 255\)/);
  assert.match(promo, /chaturbate-banner/);
});

test('engagement endpoint rate-limits and BongaCash remains manual-only', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const route = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  assert.match(route, /allowEngagement\(event\.visitId\)/);
  assert.match(route, /Engagement event rate limit reached/);
  assert.match(route, /BongaCash postbacks are not supported/);
  assert.doesNotMatch(route, /bongacashPostbackConfigured|bongaPostbackConfigured/);
});


test('main directory attributes external referrers and persists campaign context', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  assert.match(app, /new URL\(document\.referrer\)/);
  assert.match(app, /referrerHost !== currentHost/);
  assert.match(app, /hasReferralAttribution = Boolean\(referralSource\) && !incomingAttribution\.source\.trim\(\)/);
  assert.match(app, /source: incomingAttribution\.source \|\| \(hasReferralAttribution \? referralSource : "direct"\)/);
  assert.match(app, /localStorage\.setItem\("ncf_attribution", JSON\.stringify\(savedAttribution\)\)/);
  assert.match(app, /vid: visitId/);
});

test('promotional landing pages persist referral source and preserve explicit UTM precedence', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const promo = fs.readFileSync(path.join(__dirname, '../public/promo.js'), 'utf8');
  assert.match(promo, /const explicitSource = url\.get\('utm_source'\) \|\| url\.get\('source'\) \|\| ''/);
  assert.match(promo, /const source = explicitSource \|\| savedSource \|\| referral \|\| 'direct'/);
  assert.match(promo, /if \(referralOnly \|\| explicitSource \|\| explicitMedium \|\| explicitCampaign \|\| explicitContent\)/);
  assert.match(promo, /localStorage\.setItem\('ncf_attribution', JSON\.stringify\(attribution\)\)/);
  assert.match(promo, /vid: currentVisitId/);
  assert.match(promo, /lp: originalLandingPath\.slice\(0, 255\)/);
});

test('affiliate redirect handler accepts source attribution and validates visit IDs before storing them', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(server, /url\.searchParams\.get\("utm_source"\) \|\| url\.searchParams\.get\("source"\)/);
  assert.match(server, /match\(\/\^\[a-f0-9\]\{32\}\$\/i\)\?\.\[0\]/);
  assert.match(server, /countClick\(\{ src, country, category, source, campaign, medium, content, device, clickId, platform, visitId, landingPath/);
});
