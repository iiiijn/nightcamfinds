'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const performance = require('../src/services/telegram-campaign-performance.cjs');

test('aggregates Telegram campaign clicks, visits and matched revenue by content label', () => {
  const built = performance.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.deepEqual(built.params, ['2026-11-01', '2026-11-07']);
  assert.match(built.text, /affiliate_clicks ac/);
  assert.match(built.text, /traffic_visits tv/);
  assert.match(built.text, /cb_conversions cc/);
  assert.match(built.text, /utm/i.test('utm') ? /content/ : /content/);
  assert.match(built.text, /LOWER\(COALESCE\(ac\.source, ''\)\) IN \('telegram','tg','t\.me','telegram\.me','telegram\.org'\)/);
  assert.match(built.text, /LOWER\(COALESCE\(tv\.source, ''\)\) IN/);
  assert.match(built.text, /REGEXP_REPLACE\(LOWER\(ac\.content\), '\^room-/);
  assert.match(built.text, /chaturbate_clicks/);
  assert.match(built.text, /bongacams_clicks/);
  assert.match(built.text, /known_bot_clicks/);
  assert.match(built.text, /suspected_bot_clicks/);
  assert.match(built.text, /unclassified_clicks/);
  assert.match(built.text, /matched_conversions/);
  assert.match(built.text, /reported_payouts_by_currency/);
  assert.match(built.text, /FULL OUTER JOIN visit_groups/);
  assert.match(built.text, /GROUP BY 1,2,3,4,5/);
  assert.match(built.text, /LIMIT 2000/);
});

test('keeps visits grouped at campaign-content level instead of assigning them to a provider platform', () => {
  const built = performance.buildQuery({});
  const visitBlock = built.text.slice(built.text.indexOf('visit_groups AS'), built.text.indexOf('matched_by_currency AS'));
  assert.match(visitBlock, /COUNT\(\*\)::int AS visits/);
  assert.doesNotMatch(visitBlock, /tv\.platform/);
  assert.match(visitBlock, /visits_with_affiliate_click/);
});

test('uses parameterized UTC windows for clicks, visits, linked clicks and conversions', () => {
  const built = performance.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.match(built.text, /ac\.clicked_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /tv\.first_seen_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /acv\.clicked_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /cc\.received_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.doesNotMatch(built.text, /2026-11/);
});

test('rejects invalid and reversed date ranges', () => {
  assert.match(performance.buildQuery({ from: '2026-02-31' }).error, /calendar dates/);
  assert.match(performance.buildQuery({ from: '2026-11-08', to: '2026-11-07' }).error, /on or before/);
});

test('excludes owner and identified test traffic from Telegram campaign metrics', () => {
  const built = performance.buildQuery({});
  assert.match(built.text, /COALESCE\(ac\.is_owner_traffic, FALSE\) IS FALSE/);
  assert.match(built.text, /COALESCE\(tv\.is_owner_traffic, FALSE\) IS FALSE/);
  assert.match(built.text, /test_female_01/);
  assert.match(built.text, /revshare_audit_01/);
});

test('authenticated route exposes Telegram-only content, platform split and payout fields', () => {
  const route = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  const start = route.indexOf('if (incoming.pathname === "/api/telegram-campaign-performance")');
  const end = route.indexOf('if (incoming.pathname === "/api/conversion-revenue")', start);
  const endpoint = route.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(endpoint, /validDashboardSession\(req\)/);
  assert.match(endpoint, /classifySourceChannel\(row\.source, "url_parameter"\) === "social_telegram"/);
  assert.match(endpoint, /chaturbateClicks: Number/);
  assert.match(endpoint, /bongacamsClicks: Number/);
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

test('Telegram campaign page creates unique UTM links and calls the Telegram-only report', () => {
  const page = fs.readFileSync(path.join(__dirname, '../public/telegram-campaigns.html'), 'utf8');
  assert.match(page, /utm_source/);
  assert.match(page, /utm_medium/);
  assert.match(page, /utm_campaign/);
  assert.match(page, /utm_content/);
  assert.match(page, /social_telegram/);
  assert.match(page, /\/api\/telegram-campaign-performance/);
  assert.match(page, /chaturbateClicks/);
  assert.match(page, /bongacamsClicks/);
});
