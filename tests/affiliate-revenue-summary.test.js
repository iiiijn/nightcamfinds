'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const summary = require('../public/revenue-summary.js');

test('only matched non-test credited events contribute to attributed payouts', () => {
  const result = summary.summarizeConversions([
    { conversionType: 'revshare_purchase', currency: 'USD', conversions: 1, matchedConversions: 1, unmatchedConversions: 0, reportedPayout: '4.50', matchStatus: 'matched' },
    { conversionType: 'revshare_purchase', currency: 'EUR', conversions: 1, matchedConversions: 0, unmatchedConversions: 1, reportedPayout: '2.00', matchStatus: 'click_id_not_found' },
    { conversionType: '{type}', currency: '{CURRENCY}', conversions: 1, isTest: true, reportedPayout: '999.00' },
    { conversionType: 'unknown', currency: 'USD', conversions: 1, matchedConversions: 1, reportedPayout: '50.00', matchStatus: 'matched' }
  ]);
  assert.equal(result.matchedConversions, 1);
  assert.equal(result.unmatchedConversions, 1);
  assert.equal(result.testEvents, 1);
  assert.equal(result.excludedEvents, 1);
  assert.deepEqual(result.attributedPayoutsByCurrency, { USD: 4.5 });
  assert.deepEqual(result.pendingPayoutsByCurrency, { EUR: 2 });
});

test('traffic summary groups countries and campaigns without mixing currencies', () => {
  const result = summary.summarizeTraffic([
    { country: 'US', platform: 'chaturbate', source: 'x', campaign: 'launch', clicks: 10, matchedConversions: 1, reportedPayoutsByCurrency: { USD: 3, EUR: 2 } },
    { country: 'US', platform: 'chaturbate', source: 'x', campaign: 'launch', clicks: 5, matchedConversions: 0, reportedPayoutsByCurrency: { USD: 1 } },
    { country: 'GB', platform: 'bongacams', source: 'telegram', campaign: 'rooms', clicks: 7, matchedConversions: 0, reportedPayoutsByCurrency: {} }
  ]);
  const us = result.countries.find(row => row.name === 'US');
  assert.equal(us.clicks, 15);
  assert.equal(us.matchedConversions, 1);
  assert.deepEqual(us.payoutsByCurrency, { USD: 4, EUR: 2 });
  assert.equal(result.campaigns.length, 2);
});
