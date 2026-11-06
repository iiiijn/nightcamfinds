'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyUserAgent, normalizeVisitId, normalizeEvent, newVisitId, nairobiWeekBounds } = require('../src/services/traffic-quality.cjs');

test('classifies known crawlers separately from suspected automation', () => {
  assert.equal(classifyUserAgent('Googlebot/2.1'), 'known_bot');
  assert.equal(classifyUserAgent('curl/8.1'), 'suspected_bot');
  assert.equal(classifyUserAgent('Mozilla/5.0 Chrome/120 Safari/537.36'), 'unverified');
  assert.equal(classifyUserAgent(''), 'unverified');
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
  const bounds = nairobiWeekBounds(new Date('2026-11-01T21:00:00.000Z'));
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
