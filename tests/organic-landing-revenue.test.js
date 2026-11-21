'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const report = require('../src/services/organic-landing-revenue.cjs');

test('groups affiliate activity and matched Chaturbate payouts by original landing path', () => {
  const built = report.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.deepEqual(built.params, ['2026-11-01', '2026-11-07']);
  assert.match(built.text, /ac\.landing_path/);
  assert.match(built.text, /tv\.landing_path/);
  assert.match(built.text, /cc\.matched_click IS TRUE/);
  assert.match(built.text, /click_id = cc\.click_id/);
  assert.match(built.text, /jsonb_object_agg\(currency, reported_payout\)/);
  assert.match(built.text, /FULL OUTER JOIN visit_groups/);
  assert.match(built.text, /known_bot_clicks/);
  assert.match(built.text, /suspected_bot_clicks/);
  assert.match(built.text, /unverified_not_flagged_clicks/);
  assert.match(built.text, /unclassified_clicks/);
  assert.match(built.text, /LIMIT 2000/);
});

test('keeps date filters parameterized and applies them independently to clicks, visits and conversions', () => {
  const built = report.buildQuery({ from: '2026-11-01', to: '2026-11-07' });
  assert.match(built.text, /ac\.clicked_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /tv\.first_seen_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /cc\.received_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);
  assert.match(built.text, /ac\.clicked_at < \(\(\$2::date \+ INTERVAL '1 day'\) AT TIME ZONE 'UTC'\)/);
  assert.doesNotMatch(built.text, /2026-11/);
});

test('rejects invalid and reversed date ranges', () => {
  assert.match(report.buildQuery({ from: '2026-02-31' }).error, /calendar dates/);
  assert.match(report.buildQuery({ from: '2026-11-08', to: '2026-11-07' }).error, /on or before/);
});

test('supports all-time reporting without date predicates', () => {
  const built = report.buildQuery({});
  assert.deepEqual(built.params, []);
  assert.doesNotMatch(built.text, /clicked_at >=|first_seen_at >=|received_at >=/);
});

test('excludes owner and identified test traffic from click, visit and conversion attribution', () => {
  const built = report.buildQuery({});
  assert.match(built.text, /COALESCE\(ac\.is_owner_traffic, FALSE\) IS FALSE/);
  assert.match(built.text, /COALESCE\(tv\.is_owner_traffic, FALSE\) IS FALSE/);
  assert.match(built.text, /LOWER\(COALESCE\(ac\.source, ''\)\) <> 'test'/);
  assert.match(built.text, /LOWER\(COALESCE\(tv\.source, ''\)\) <> 'test'/);
  assert.match(built.text, /COALESCE\(is_owner_traffic, FALSE\) IS FALSE/);
});

test('route keeps organic landing report private and separates reported payout from cash received', () => {
  const fs = require('node:fs');
  const route = fs.readFileSync(require('node:path').join(__dirname, '../route.js'), 'utf8');
  const start = route.indexOf('if (incoming.pathname === "/api/organic-landing-revenue")');
  assert.notEqual(start, -1);
  const endpoint = route.slice(start, route.indexOf('if (incoming.pathname === "/api/telegram-campaign-performance")', start));
  assert.match(endpoint, /validDashboardSession\(req\)/);
  assert.match(endpoint, /reportedPayoutsByCurrency/);
  assert.match(endpoint, /provider-reported, not verified cash received/);
});

test('organic landing-page dashboard script passes Node syntax validation', () => {
  const { execFileSync } = require('node:child_process');
  const path = require('node:path');
  const script = path.join(__dirname, '../public/organic-landing-revenue.js');
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', script], { stdio: 'pipe' }));
});
