'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const origins = require('../src/services/click-origins.cjs');

test('accepts valid origin report filters', () => {
  assert.deepEqual(origins.parseFilters(new URLSearchParams('from=2026-11-01&to=2026-11-07&country=US&platform=chaturbate&category=male&source=x')), {
    value: { from: '2026-11-01', to: '2026-11-07', country: 'US', platform: 'chaturbate', category: 'male', source: 'x', sourceEvidence: 'ALL' }
  });
});

test('rejects invalid dates, platform, category, country and unsafe source filter values', () => {
  assert.match(origins.parseFilters(new URLSearchParams('from=2026-02-31')).error, /calendar dates/);
  assert.match(origins.parseFilters(new URLSearchParams('country=USA')).error, /two-letter/);
  assert.match(origins.parseFilters(new URLSearchParams('platform=other')).error, /Platform/);
  assert.match(origins.parseFilters(new URLSearchParams('category=unknown')).error, /Category/);
  assert.match(origins.parseFilters(new URLSearchParams('source=' + 'a'.repeat(81))).error, /80 characters/);
  assert.match(origins.parseFilters(new URLSearchParams('source=x%00y')).error, /control characters/);
  assert.match(origins.parseFilters(new URLSearchParams('evidence=forged')).error, /Evidence/);
});

test('accepts historical source labels containing spaces and punctuation', () => {
  const parsed = origins.parseFilters(new URLSearchParams('source=X+%28Twitter%29'));
  assert.deepEqual(parsed.value, {
    from: '', to: '', country: 'ALL', platform: 'ALL', category: 'ALL', source: 'x (twitter)', sourceEvidence: 'ALL'
  });
});

test('keeps source filter values parameterized even when they resemble SQL', () => {
  const source = "x' or 1=1 --";
  const parsed = origins.parseFilters(new URLSearchParams('source=' + encodeURIComponent(source)));
  assert.equal(parsed.value.source, source);
  const built = origins.buildQuery(parsed.value);
  assert.equal(built.params.at(-1), source);
  assert.doesNotMatch(built.text, /x' OR 1=1/);
});

test('builds a parameterized aggregation across country, platform, category and attribution dimensions', () => {
  const built = origins.buildQuery({ from: '2026-11-01', to: '2026-11-07', country: 'US', platform: 'chaturbate', category: 'male', source: 'x' });
  assert.deepEqual(built.params, ['2026-11-01', '2026-11-07', 'US', 'chaturbate', 'male', 'x']);
  assert.match(built.text, /source_evidence/);
  assert.match(built.text, /THEN 'unknown' ELSE COALESCE/);
  assert.match(built.text, /GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12/);
  assert.match(built.text, /landing_path/);
  assert.match(built.text, /placement/);
  assert.doesNotMatch(built.text, /2026-11-01|chaturbate|x/);
  assert.match(built.text, /LIMIT 2000/);
});

test('uses no raw IP, exact location, names or email fields', () => {
  const built = origins.buildQuery({ from: '', to: '', country: 'ALL', platform: 'ALL', category: 'ALL', source: 'ALL' });
  assert.doesNotMatch(built.text, /ip_address|user_agent|email|full_name|latitude|longitude/i);
});

test('private dashboard exposes click-origin dimensions and filters', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  for (const id of ['originsCountry','originsPlatform','originsCategory','originsSource','originsEvidence','originsRefresh','originsTable']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.ok(html.includes('loadClickOrigins()'));
  assert.ok(html.includes('/api/click-origins'));
});

test('click origins API is protected by dashboard session and validates GET filters', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const route = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  const start = route.indexOf('if (incoming.pathname === "/api/click-origins")');
  const end = route.indexOf('if (incoming.pathname === "/api/health")', start);
  assert.ok(start >= 0 && end > start);
  const block = route.slice(start, end);
  assert.ok(block.includes('validDashboardSession(req)'));
  assert.ok(block.includes('clickOrigins.parseFilters'));
  assert.ok(block.includes('pool.query(query.text, query.params)'));
  assert.ok(block.includes('sourceEvidence: row.source_evidence'));
});

test('fresh login loads the click origins report through shared dashboard initialization', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  const loaderStart = html.indexOf('async function loadDashboardData()');
  const checkStart = html.indexOf('async function check()', loaderStart);
  const loginStart = html.indexOf('async function login(e)');
  const loginEnd = html.indexOf('async function logout()', loginStart);
  assert.ok(loaderStart >= 0 && checkStart > loaderStart);
  assert.ok(loginStart >= 0 && loginEnd > loginStart);
  assert.match(html.slice(loaderStart, checkStart), /loadClickOrigins\(\)/);
  assert.match(html.slice(loginStart, loginEnd), /await loadDashboardData\(\)/);
});

test('recent room clicks endpoint is session-protected, read-only, bounded and excludes raw visitor identifiers', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const route = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  const start = route.indexOf('if (incoming.pathname === "/api/recent-room-clicks")');
  const end = route.indexOf('if (incoming.pathname === "/api/health")', start);
  assert.ok(start >= 0 && end > start);
  const block = route.slice(start, end);
  assert.ok(block.includes('validDashboardSession(req)'));
  assert.ok(block.includes('req.method !== "GET"'));
  assert.ok(block.includes('limit > 100'));
  assert.ok(block.includes("LOWER(content) LIKE 'room-%'"));
  assert.ok(block.includes('click_id'));
  assert.ok(block.includes('source_evidence'));
  assert.doesNotMatch(block, /ip_address|user_agent|email|full_name/i);
});

test('dashboard exposes and refreshes recent room clicks', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  for (const id of ['recentRoomPlatform','recentRoomRefresh','recentRoomStatus','recentRoomTable']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.ok(html.includes('/api/recent-room-clicks'));
  assert.ok(html.includes('loadRecentRoomClicks()'));
});

test('filters and groups click-origin rows by capture evidence', () => {
  const parsed = origins.parseFilters(new URLSearchParams('evidence=browser_referrer'));
  assert.deepEqual(parsed.value, {
    from: '', to: '', country: 'ALL', platform: 'ALL', category: 'ALL', source: 'ALL', sourceEvidence: 'browser_referrer'
  });
  const built = origins.buildQuery(parsed.value);
  assert.deepEqual(built.params, ['browser_referrer']);
  assert.match(built.text, /LOWER\(source_evidence\) = \$1/);
  assert.match(built.text, /GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12/);
});
