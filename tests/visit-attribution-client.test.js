'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const helper = fs.readFileSync(path.join(__dirname, '../public/visit-tracking.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const country = fs.readFileSync(path.join(__dirname, '../country-pages.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

test('visit identifier helper falls back to a same-origin session cookie when sessionStorage is unavailable', () => {
  assert.match(helper, /sessionStorage\.getItem\('ncf_visit_id'\)/);
  assert.match(helper, /readCookie\('ncf_visit_id'\)/);
  assert.match(helper, /writeCookie\('ncf_visit_id', id\)/);
  assert.match(helper, /Path=\/; SameSite=Lax/);
  assert.match(helper, /; Secure/);
  assert.match(helper, /getRandomValues/);
  assert.match(helper, /\[a-f0-9\]\{32\}/);
});

test('main directory loads shared tracking helper before its application script', () => {
  assert.ok(index.indexOf('/visit-tracking.js') < index.indexOf('/app.js'));
  assert.match(app, /NCFVisitTracking\.getVisitId\(\)/);
  assert.match(app, /NCFVisitTracking\.getLandingPath\(location\.pathname\)/);
  assert.match(app, /vid: visitId/);
});

test('country pages load shared tracking helper before applying visit IDs to affiliate links', () => {
  assert.ok(country.indexOf('<script src="/visit-tracking.js"></script>') < country.indexOf('const countrySlug'));
  assert.match(country, /NCFVisitTracking\.getVisitId\(\)/);
  assert.match(country, /NCFVisitTracking\.getLandingPath\(location\.pathname\)/);
  assert.match(country, /vid: visitId/);
});

test('redirect handler validates and persists the visit ID supplied by directory links', () => {
  assert.match(server, /url\.searchParams\.get\("vid"\)/);
  assert.match(server, /visitId, landingPath/);
});

test('privacy notice discloses the temporary analytics session cookie', () => {
  assert.match(server, /temporary first-party session cookie containing a random visit identifier/);
});


test('shared affiliate-link decorator carries stored X campaign attribution with visit identity', () => {
  assert.match(helper, /function readAttribution\(\)/);
  assert.match(helper, /localStorage\.getItem\('ncf_attribution'\)/);
  assert.match(helper, /savedAt.*30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(helper, /target\.searchParams\.set\('vid', visitId\)/);
  assert.match(helper, /target\.searchParams\.set\('lp', getLandingPath\(root\.location\.pathname\)\)/);
  assert.match(helper, /target\.searchParams\.set\(key, attribution\[key\]\)/);
  assert.match(helper, /!target\.searchParams\.has\(key\) && !target\.searchParams\.has\('utm_' \+ key\)/);
});

test('stored campaign attribution is bounded and cannot replace explicit affiliate-link tags', () => {
  assert.match(helper, /source: String\(saved\.source \|\| ''\)\.slice\(0, 30\)/);
  assert.match(helper, /campaign: String\(saved\.campaign \|\| ''\)\.slice\(0, 40\)/);
  assert.match(helper, /if \(attribution\[key\] && !target\.searchParams\.has\(key\) && !target\.searchParams\.has\('utm_' \+ key\)\)/);
});


test('country and promotional landing pages record page views immediately', () => {
  const promo = fs.readFileSync(path.join(__dirname, '../public/promo.js'), 'utf8');
  assert.match(country, /eventType: "page_view"/);
  assert.match(country, /const sendEngagement = \(eventType\)/);
  assert.match(promo, /recordEngagement\('page_view'\)/);
  assert.match(promo, /function recordEngagement\(eventType/);
});


test('a different tagged campaign entry gets a fresh visit ID and landing path', () => {
  assert.match(helper, /function incomingCampaignKey\(\)/);
  assert.match(helper, /ncf_visit_campaign_key/);
  assert.match(helper, /const newCampaignEntry = Boolean\(campaignKey && campaignKey !== previousCampaignKey\)/);
  assert.match(helper, /if \(newCampaignEntry\) \{[\s\S]*cachedVisitId = '';[\s\S]*cachedLandingPath = ''/);
  assert.match(helper, /root\.sessionStorage\.setItem\('ncf_landing_path', root\.location\.pathname \|\| '\/'\)/);
});

test('same tagged campaign preserves its visit ID across internal navigation and refreshes', () => {
  assert.match(helper, /if \(validVisitId\(cachedVisitId\) && !newCampaignEntry\) return cachedVisitId/);
  assert.match(helper, /if \(!newCampaignEntry\) \{[\s\S]*sessionStorage\.getItem\('ncf_visit_id'\)/);
});


test('GA4 is consent-gated, uses the approved property, and avoids advertising signals', () => {
  assert.match(helper, /G-W0HBR8LBKQ/);
  assert.match(helper, /ncf_ga4_analytics_consent/);
  assert.match(helper, /if \(!hasAnalyticsConsent\(\) \|\| root\.__NCF_GA4_INITIALIZED__\) return/);
  assert.match(helper, /allow_google_signals: false/);
  assert.match(helper, /allow_ad_personalization_signals: false/);
  assert.match(helper, /page_location: root\.location\.origin \+ root\.location\.pathname/);
  assert.match(helper, /Reject optional analytics/);
});

test('affiliate clicks emit a GA4 event without transmitting room IDs or visit IDs', () => {
  assert.match(helper, /sendGa4Event\('affiliate_link_click'/);
  assert.match(helper, /affiliate_platform: platform/);
  assert.match(helper, /landing_page_path: getLandingPath/);
  assert.doesNotMatch(helper, /click_id:|visit_id:|room_username:/);
});

test('public broadcaster and earning pages load the shared analytics preferences helper', () => {
  assert.match(broadcast, /\/visit-tracking\.js/);
  assert.match(earn, /\/visit-tracking\.js/);
});
