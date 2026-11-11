'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeConversions } = require('../public/revenue-summary.js');

test('keeps matched, pending, test and invalid callback revenue separate', () => {
  const result = summarizeConversions([
    { conversions: 1, isTest: true, matchStatus: 'invalid_callback', conversionType: 'unknown', currency: 'USD', reportedPayout: '99.00' },
    { conversions: 1, isTest: false, matchStatus: 'matched', conversionType: 'revshare_purchase', currency: 'USD', matchedConversions: 1, unmatchedConversions: 0, reportedPayout: '12.50' },
    { conversions: 1, isTest: false, matchStatus: 'click_id_not_found', conversionType: 'revshare_purchase', currency: 'USD', matchedConversions: 0, unmatchedConversions: 1, reportedPayout: '4.00' },
    { conversions: 1, isTest: false, matchStatus: 'matched', conversionType: 'unknown', currency: 'USD', matchedConversions: 0, unmatchedConversions: 0, reportedPayout: '50.00' }
  ]);
  assert.equal(result.invalidCallbacks, 1);
  assert.equal(result.testEvents, 1);
  assert.equal(result.excludedEvents, 1);
  assert.equal(result.matchedConversions, 1);
  assert.equal(result.unmatchedConversions, 1);
  assert.deepEqual(result.attributedPayoutsByCurrency, { USD: 12.5 });
  assert.deepEqual(result.pendingPayoutsByCurrency, { USD: 4 });
});

test('negative provider payout adjustments reduce attributed revenue', () => {
  const result = summarizeConversions([
    { conversions: 1, isTest: false, matchStatus: 'matched', conversionType: 'revshare_purchase', currency: 'USD', matchedConversions: 1, reportedPayout: '10.00' },
    { conversions: 1, isTest: false, matchStatus: 'matched', conversionType: 'revshare_payout-adjustment', currency: 'USD', matchedConversions: 1, reportedPayout: '-2.25' },
    { conversions: 1, isTest: false, matchStatus: 'click_id_not_found', conversionType: 'revshare_payout-adjustment', currency: 'EUR', unmatchedConversions: 1, reportedPayout: '-1.00' }
  ]);
  assert.deepEqual(result.attributedPayoutsByCurrency, { USD: 7.75 });
  assert.deepEqual(result.pendingPayoutsByCurrency, { EUR: -1 });
});

test('never combines currencies or creates a payout for zero-value events', () => {
  const result = summarizeConversions([
    { conversions: 1, isTest: false, matchStatus: 'matched', conversionType: 'revshare_purchase', currency: 'EUR', matchedConversions: 1, reportedPayout: '3.20' },
    { conversions: 1, isTest: false, matchStatus: 'matched', conversionType: 'revshare_purchase', currency: 'USD', matchedConversions: 1, reportedPayout: '0' }
  ]);
  assert.deepEqual(result.attributedPayoutsByCurrency, { EUR: 3.2 });
  assert.deepEqual(result.pendingPayoutsByCurrency, {});
});
