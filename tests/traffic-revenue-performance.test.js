'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const performance = require('../src/services/traffic-revenue-performance.cjs');

test('groups the visit and revenue funnel by source, medium, campaign and content', () => {
  const built = performance.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.deepEqual(built.params.clicks, ['2026-11-01', '2026-11-07']);
  assert.deepEqual(built.params.visits, ['2026-11-01', '2026-11-07']);
  assert.deepEqual(built.params.conversions, ['2026-11-01', '2026-11-07']);
  assert.match(built.text, /FROM affiliate_clicks ac/);
  assert.match(built.text, /FROM traffic_visits tv/);
  assert.match(built.text, /traffic_engagement_events e/);
  assert.match(built.text, /visits_with_affiliate_click/);
  assert.match(built.text, /clicks_with_visit_id/);
  assert.match(built.text, /clicks_without_visit_id/);
  assert.match(built.text, /FROM cb_conversions cc/);
  assert.match(built.text, /cc\.matched_click IS TRUE/);
  assert.match(built.text, /jsonb_object_agg\(currency, reported_payout\)/);
  assert.match(built.text, /reported_payouts_by_currency/);
  assert.match(built.text, /FULL OUTER JOIN visit_groups/);
  assert.match(built.text, /GROUP BY 1,2,3,4,5,6/);
  assert.match(built.text, /GROUP BY 1,2,3,4,5,6,7/);
  assert.match(built.text, /ac\.content/);
  assert.match(built.text, /REGEXP_REPLACE\\(LOWER\\(ac\\.content\\)/);
  assert.match(built.text, /REGEXP_REPLACE\\(LOWER\\(content\\)/);
  assert.match(built.text, /tv\.content/);
  assert.match(built.text, /ac\.medium/);
  assert.match(built.text, /tv\.medium/);
  assert.match(built.text, /USING \(country, platform, source, medium, campaign, content\)/);
  assert.match(built.text, /LIMIT 2000/);
});

test('uses independent parameterized UTC date windows for clicks, visits and conversions', () => {
  const built = performance.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.match(built.text, /ac\.clicked_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /tv\.first_seen_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /cc\.received_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.doesNotMatch(built.text, /2026-11/);
});

test('rejects invalid and reversed date ranges', () => {
  assert.match(performance.buildQuery({ from: '2026-02-31' }).error, /calendar dates/);
  assert.match(performance.buildQuery({ from: '2026-11-08', to: '2026-11-07' }).error, /on or before/);
});

test('supports all-time report without date predicates', () => {
  const built = performance.buildQuery({});
  assert.deepEqual(built.params, { clicks: [], visits: [], conversions: [] });
  assert.doesNotMatch(built.text, /clicked_at >=|first_seen_at >=|received_at >=/);
});

test('excludes only identified internal test and audit traffic from click and visit totals', () => {
  const built = performance.buildQuery({});
  assert.match(built.text, /LOWER\(COALESCE\(ac\.source, ''\)\) <> 'test'/);
  assert.match(built.text, /LOWER\(COALESCE\(ac\.campaign, ''\)\) NOT IN \('test_female_01', 'revshare_audit_01'\)/);
  assert.match(built.text, /LOWER\(COALESCE\(tv\.source, ''\)\) <> 'test'/);
  assert.ok(built.text.includes('COALESCE(ac.is_owner_traffic, FALSE) IS FALSE'));
  assert.ok(built.text.includes('COALESCE(tv.is_owner_traffic, FALSE) IS FALSE'));
  assert.ok(built.text.includes('COALESCE(acv.is_owner_traffic, FALSE) IS FALSE'));
});

test('route exposes content and normalized source channel in revenue reporting', () => {
  const route = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  const start = route.indexOf('if (incoming.pathname === "/api/traffic-revenue-performance")');
  const end = route.indexOf('if (incoming.pathname === "/api/conversion-revenue")', start);
  const endpoint = route.slice(start, end);
  assert.match(endpoint, /sourceChannel: classifySourceChannel/);
  assert.match(endpoint, /medium: row\.medium/);
  assert.match(endpoint, /content: row\.content/);
  assert.match(endpoint, /matchedConversions: Number/);
  assert.match(endpoint, /reportedPayoutsByCurrency/);
});

test('promo affiliate redirects preserve the supplied UTM content group label', () => {
  const promo = fs.readFileSync(path.join(__dirname, '../public/promo.js'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(promo, /content: attr\.content \|\| \(campaignPlacement \|\| placement\)/);
  assert.match(promo, /utm_content/);
  assert.match(server, /url\.searchParams\.get\("utm_content"\) \|\| url\.searchParams\.get\("content"\)/);
  assert.match(server, /const content = cleanLabel\(\["room-" \+ username, suppliedContent\]/);
});

test('Telegram campaign page creates unique UTM links and calls the authenticated revenue report', () => {
  const page = fs.readFileSync(path.join(__dirname, '../public/telegram-campaigns.html'), 'utf8');
  assert.match(page, /utm_source/);
  assert.match(page, /utm_medium/);
  assert.match(page, /utm_campaign/);
  assert.match(page, /utm_content/);
  assert.match(page, /social_telegram/);
  assert.match(page, /\/api\/traffic-revenue-performance/);
});
