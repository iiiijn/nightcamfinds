'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const reporting = require('../src/services/conversion-revenue.cjs');

test('Chaturbate postback country is primary conversion country while click country stays separate', () => {
  const built = reporting.buildQuery({});
  assert.match(built.text, /COALESCE\(NULLIF\(UPPER\(cc\.country\), 'UNKNOWN'\), NULLIF\(UPPER\(ac\.country\), ''\)/);
  assert.match(built.text, /NULLIF\(UPPER\(cc\.country\), 'UNKNOWN'\)/);
  assert.match(built.text, /AS click_country/);
  const rows = reporting.toDashboardRows([{
    country: 'DE', click_country: 'US', source: 'reddit', campaign: 'tier1',
    conversion_type: 'revshare_signup-referral', currency: 'USD', is_test: false,
    match_status: 'matched', event_class: 'signup_referral', conversions: 1,
    matched_conversions: 1, unmatched_conversions: 0, reported_payout: '1.00', reported_spend: '0'
  }]);
  assert.equal(rows[0].country, 'DE');
  assert.equal(rows[0].clickCountry, 'US');
});

test('monthly overview shows matched conversion performance by postback country and source campaign', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  assert.match(html, /Countries bringing member signups/);
  assert.match(html, /monthlyConversionCountryTable/);
  assert.match(html, /Which marketing sources bring signups\?/);
  assert.match(html, /monthlyConversionSourceTable/);
  assert.match(html, /Only matched, non-test events are included/);
  assert.match(html, /broadcaster-referral/);
});
