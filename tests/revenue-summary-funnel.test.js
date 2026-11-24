'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeTraffic } = require('../public/revenue-summary.js');

test('aggregates visits, engagement, click-through visits and conversions by country and campaign', () => {
  const result = summarizeTraffic([
    { country: 'US', platform: 'chaturbate', source: 'x.com', campaign: 'male', visits: 10, engagedVisits: 6, visitsWithAffiliateClick: 4, clicks: 8, clicksWithVisitId: 6, clicksWithoutVisitId: 2, matchedConversions: 2, reportedPayoutsByCurrency: { USD: 12 } },
    { country: 'US', platform: 'bongacams', source: 'x.com', campaign: 'male', visits: 5, engagedVisits: 2, visitsWithAffiliateClick: 3, clicks: 4, clicksWithVisitId: 3, clicksWithoutVisitId: 1, matchedConversions: 0, reportedPayoutsByCurrency: {} },
    { country: 'DE', platform: 'chaturbate', source: 'google', campaign: 'organic', visits: 3, engagedVisits: 1, visitsWithAffiliateClick: 1, clicks: 2, matchedConversions: 1, reportedPayoutsByCurrency: { EUR: 4 } }
  ]);
  const us = result.countries.find(row => row.name === 'US');
  assert.deepEqual(
    { visits: us.visits, engaged: us.engagedVisits, clickVisits: us.visitsWithAffiliateClick, clicks: us.clicks, conversions: us.matchedConversions },
    { visits: 15, engaged: 8, clickVisits: 7, clicks: 12, conversions: 2 }
  );
  assert.equal(us.engagementRate, 8 / 15);
  assert.equal(us.visitToClickRate, 7 / 15);
  assert.equal(us.clicksWithVisitId, 9);
  assert.equal(us.clicksWithoutVisitId, 3);
  assert.equal(us.conversionRate, 2 / 12);
  assert.equal(us.payoutsByCurrency.USD, 12);
  assert.equal(result.campaigns.length, 3);
});

test('keeps zero-click visits visible in country and campaign summaries', () => {
  const result = summarizeTraffic([
    { country: 'CA', platform: 'directory', source: 'newsletter', campaign: 'launch', visits: 7, engagedVisits: 4, visitsWithAffiliateClick: 0, clicks: 0, matchedConversions: 0 }
  ]);
  assert.equal(result.countries[0].visits, 7);
  assert.equal(result.countries[0].clicks, 0);
  assert.equal(result.campaigns[0].engagedVisits, 4);
  assert.equal(result.campaigns[0].visitToClickRate, 0);
});
