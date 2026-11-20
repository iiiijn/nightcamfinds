'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('dashboard defaults to a current-month business overview', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  assert.ok(html.includes('<option value="month" selected>This month</option>'));
  assert.ok(html.includes("if(r==='month')return{from:iso(new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1))),to:iso(today)}"));
  assert.ok(html.includes("button.dataset.dashboardTab='monthly'"));
  assert.ok(html.includes('Monthly Overview'));
  assert.ok(html.includes('Monthly business overview'));
});

test('monthly overview keeps Chaturbate payouts and BongaCash manual figures separate', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  assert.ok(html.includes('Chaturbate matched partner-reported payouts'));
  assert.ok(html.includes('BongaCash manual reconciliation'));
  assert.ok(html.includes('No combined currency total is calculated'));
  assert.ok(html.includes("matchStatus==='matched'"));
  assert.ok(html.includes('Tier 1 member signup events'));
  assert.ok(html.includes('All matched member signup events'));
  assert.ok(html.includes('Matched broadcaster referral events'));
  assert.ok(!html.includes('Chaturbate match rate'));
});

test('monthly channel labels are presented as recorded source labels, not connected accounts', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  assert.ok(html.includes('Recorded source label'));
  assert.ok(html.includes('Redirects are not unique visitors'));
  assert.ok(/source tags|source label/i.test(html));
});
