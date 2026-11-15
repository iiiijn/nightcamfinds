'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('owner traffic migration is additive and preserves all historical rows', () => {
  const sql = read('sql/011_owner_traffic.sql');
  assert.match(sql, /ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS is_owner_traffic BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(sql, /ALTER TABLE traffic_visits ADD COLUMN IF NOT EXISTS is_owner_traffic BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.doesNotMatch(sql, /UPDATE\s+affiliate_clicks|UPDATE\s+traffic_visits|DELETE FROM|DROP TABLE|TRUNCATE/i);
  const plan = read('scripts/migration-plan.js');
  assert.match(plan, /version: "011_owner_traffic"/);
  assert.match(plan, /file: "011_owner_traffic.sql"/);
});

test('redirect tracking stores owner status in click and visit rows without downgrading a visit', () => {
  const server = read('server.js');
  assert.match(server, /verifyOwnerCookie\(cookieValue\(req, OWNER_COOKIE_NAME\)/);
  assert.match(server, /page_type,is_owner_traffic\) VALUES/);
  assert.match(server, /traffic_visits\.is_owner_traffic OR EXCLUDED\.is_owner_traffic/);
  assert.match(server, /isOwnerTraffic\]\s*\n\s*\);/);
});

test('owner-mode control requires an admin session, same-origin POST and installed schema', () => {
  const route = read('route.js');
  const start = route.indexOf('if (incoming.pathname === "/api/owner-traffic")');
  const end = route.indexOf('if (incoming.pathname === "/api/engage")', start);
  assert.ok(start >= 0 && end > start);
  const endpoint = route.slice(start, end);
  assert.match(endpoint, /validDashboardSession\(req\)/);
  assert.match(endpoint, /isSameOriginRequest\(req\.headers\)/);
  assert.match(endpoint, /information_schema\.columns/);
  assert.match(endpoint, /ownerTrafficCookie\.createOwnerCookie/);
  assert.match(endpoint, /Set-Cookie/);
  assert.match(endpoint, /Owner traffic migration 011 is not installed/);
});

test('business reporting queries exclude owner traffic and trace retains owner-only diagnostics', () => {
  const origins = read('src/services/click-origins.cjs');
  const daily = read('src/services/daily-country-analytics.cjs');
  const revenue = read('src/services/traffic-revenue-performance.cjs');
  const conversions = read('src/services/conversion-revenue.cjs');
  const trace = read('src/services/individual-click-trace.cjs');
  assert.ok(origins.includes('COALESCE(is_owner_traffic, FALSE) IS FALSE'));
  assert.ok(daily.includes('COALESCE(is_owner_traffic,FALSE) IS FALSE'));
  assert.ok(revenue.includes('ac.is_owner_traffic'));
  assert.ok(revenue.includes('tv.is_owner_traffic'));
  assert.ok(conversions.includes('owner_click.is_owner_traffic IS TRUE'));
  const route = read('route.js');
  assert.ok(route.includes('ownerCallbackExclusion'));
  assert.ok(trace.includes("filters.ownerMode === 'only'"));
  assert.ok(trace.includes("COALESCE(c.is_owner_traffic, FALSE) IS TRUE"));
});

test('dashboard exposes owner mode and a separate owner-only trace filter', () => {
  const html = read('public/dashboard.html');
  assert.match(html, /id="ownerTrafficToggle"/);
  assert.match(html, /id="ownerTrafficStatus"/);
  assert.match(html, /id="traceOwnerMode"/);
  assert.ok(html.includes('Owner diagnostics only'));
  assert.ok(html.includes('/api/owner-traffic'));
});

test('BongaCash conversion totals and breakdowns exclude owner-linked clicks without deleting conversions', async () => {
  const bongacash = require('../bongacash');
  const statements = [];
  const pool = {
    async query(sql) {
      statements.push(String(sql));
      return { rows: [{}], rowCount: 0 };
    }
  };
  await bongacash.stats(pool, '2026-11-10', '2026-11-16');
  const reports = statements.slice(-3);
  assert.equal(reports.length, 3);
  for (const sql of reports) {
    assert.match(sql, /NOT EXISTS \\(SELECT 1 FROM affiliate_clicks owner_click WHERE owner_click\\.click_id = bonga_conversions\\.click_id AND owner_click\\.is_owner_traffic IS TRUE\\)/);
    assert.match(sql, /WHERE .*received_at/);
  }
  assert.doesNotMatch(bongacash.stats.toString(), /DELETE FROM bonga_conversions|UPDATE bonga_conversions/);
});
