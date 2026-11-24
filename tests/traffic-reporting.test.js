'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SOURCE_CHANNELS, classifySourceChannel, normalizeSourceLabel, normalizeSpikeThreshold, classifyClickEvidence } = require('../src/services/traffic-reporting.cjs');

test('normalizes recognized source labels into distinct reporting channels', () => {
  assert.deepEqual(SOURCE_CHANNELS, [
    'organic_search', 'social_x', 'social_telegram', 'social_reddit',
    'social_facebook', 'social_instagram', 'social_other',
    'direct', 'email', 'partner', 'other', 'test'
  ]);
  assert.equal(classifySourceChannel('google'), 'organic_search');
  assert.equal(classifySourceChannel('organic_search'), 'organic_search');
  assert.equal(classifySourceChannel('newsletter'), 'email');
  assert.equal(classifySourceChannel('partner'), 'partner');
  assert.equal(classifySourceChannel('test_campaign'), 'test');
  assert.equal(classifySourceChannel('reddit'), 'social_reddit');
  assert.equal(classifySourceChannel('reddit.com'), 'social_reddit');
  assert.equal(classifySourceChannel('x'), 'social_x');
  assert.equal(classifySourceChannel('twitter.com'), 'social_x');
  assert.equal(classifySourceChannel('telegram'), 'social_telegram');
  assert.equal(classifySourceChannel('t.me'), 'social_telegram');
  assert.equal(classifySourceChannel('telegram.me'), 'social_telegram');
  assert.equal(classifySourceChannel('facebook.com'), 'social_facebook');
  assert.equal(classifySourceChannel('instagram'), 'social_instagram');
  assert.equal(classifySourceChannel('unknown'), 'direct');
  assert.equal(classifySourceChannel('direct', 'legacy'), 'other');
});

test('normalizes host-shaped source labels without retaining URL paths', () => {
  assert.equal(normalizeSourceLabel('https://www.t.me/channel-name/'), 't.me');
  assert.equal(normalizeSourceLabel('X'), 'x');
});

test('validates click spike thresholds and uses a safe default', () => {
  assert.equal(normalizeSpikeThreshold('120'), 120);
  assert.equal(normalizeSpikeThreshold('9'), 60);
  assert.equal(normalizeSpikeThreshold('10001'), 60);
  assert.equal(normalizeSpikeThreshold('not-a-number'), 60);
});

test('classifies click evidence without treating unverified traffic as human', () => {
  assert.equal(classifyClickEvidence({ isBot: true }), 'known_bot');
  assert.equal(classifyClickEvidence({ botReason: 'known_bot_user_agent' }), 'known_bot');
  assert.equal(classifyClickEvidence({ botReason: 'suspected_automation_user_agent' }), 'suspected_bot');
  assert.equal(classifyClickEvidence({ visitClass: 'suspected_bot' }), 'suspected_bot');
  assert.equal(classifyClickEvidence({ visitClass: 'unverified' }), 'unverified');
  assert.equal(classifyClickEvidence({}), 'unclassified');
});

test('since-cutoff traffic endpoint is session protected, bounded by 10 November, and avoids PII', () => {
  const fs = require('node:fs');
  const route = fs.readFileSync(require.resolve('../route.js'), 'utf8');
  const start = route.indexOf('if (incoming.pathname === "/api/traffic-quality-since-cutoff")');
  const end = route.indexOf('if (incoming.pathname === "/api/provider-attribution-health")', start);
  assert.ok(start >= 0 && end > start);
  const endpoint = route.slice(start, end);
  assert.match(endpoint, /validDashboardSession\(req\)/);
  assert.match(endpoint, /2026-11-10T00:00:00\.000Z/);
  assert.match(endpoint, /NCF_CLICK_SPIKE_THRESHOLD/);
  assert.match(endpoint, /affiliate_click_spike/);
  assert.match(endpoint, /revshare_audit_01/);
  assert.ok(endpoint.includes('COALESCE(c.is_owner_traffic,FALSE) IS FALSE'));
  assert.match(endpoint, /source_evidence/);
  assert.doesNotMatch(endpoint, /ip_address|user_agent|email|full_name|raw_referrer/i);
});

test('dashboard exposes and loads the since-cutoff report in the traffic tab', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(require.resolve('../public/dashboard.html'), 'utf8');
  for (const id of ['sinceCutoffRefresh','sinceCutoffStatus','sinceTotal','sinceKnownBots','sinceSuspectedBots','sinceNotFlagged','sinceBotShare','sinceWithVisit','sinceWithoutVisit','sincePeak','sinceSpikeAlert','sinceSourceChannels']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /loadTrafficSinceCutoff/);
  assert.ok(html.includes('ownerTrafficToggle'));
  assert.ok(html.includes('traceOwnerMode'));
  assert.match(html, /traffic:\[loadDailyCountryAnalytics,loadTrafficQualityAnalytics,loadTrafficSinceCutoff,loadOwnerTrafficMode,loadClickOrigins(?:,loadRepeatedClickIntelligence)?\]/);
});
