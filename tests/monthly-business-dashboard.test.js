'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('dashboard defaults to a current-month business overview', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  assert.match(html, /<option value="month" selected>This month<\/option>/);
  assert.match(html, /if\(r==='month'\)return\{from:iso\(new Date\(Date\.UTC\(today\.getUTCFullYear\(\),today\.getUTCMonth\(\),1\)\)\),to:iso\(today\)\}/);
  assert.match(html, /button\.dataset\.dashboardTab='monthly'/);
  assert.match(html, /Monthly Overview/);
  assert.match(html, /monthly business overview/i);
});

test('monthly overview keeps Chaturbate payouts and BongaCash manual figures separate', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  assert.match(html, /Chaturbate matched partner-reported payouts/);
  assert.match(html, /BongaCash manual reconciliation/);
  assert.match(html, /No combined currency total is calculated/);
  assert.match(html, /matchStatus==='matched'/);\n  assert.match(html, /Matched events per 100 clicks/);\n  assert.doesNotMatch(html, /Chaturbate match rate/);
});

test('monthly channel labels are presented as recorded source labels, not connected accounts', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  assert.match(html, /Recorded source label/);
  assert.match(html, /Redirects are not unique visitors/);
  assert.match(html, /source tags|source label/i);
});
