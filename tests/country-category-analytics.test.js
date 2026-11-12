'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const analytics = require('../src/services/country-category-analytics.cjs');

test('accepts supported date, country and platform filters', () => {
  assert.deepEqual(analytics.parseFilters(new URLSearchParams('from=2026-11-01&to=2026-11-06&country=US&platform=chaturbate')), {
    value: { from: '2026-11-01', to: '2026-11-06', country: 'US', platform: 'chaturbate' }
  });
});

test('rejects invalid dates, country codes and platforms', () => {
  assert.match(analytics.parseFilters(new URLSearchParams('from=2026-02-31')).error, /calendar dates/);
  assert.match(analytics.parseFilters(new URLSearchParams('country=USA')).error, /two-letter/);
  assert.match(analytics.parseFilters(new URLSearchParams('platform=other')).error, /Platform/);
});

test('query is parameterized and limits categories to the four directory categories', () => {
  const built = analytics.buildQuery({ from: '2026-11-01', to: '2026-11-06', country: 'US', platform: 'chaturbate' });
  assert.deepEqual(built.params, [analytics.CATEGORIES, '2026-11-01', '2026-11-06', 'US', 'chaturbate']);
  assert.match(built.text, /LOWER\(category\) = ANY\(\$1::text\[\]\)/);
  assert.match(built.text, /GROUP BY UPPER\(country\), LOWER\(category\), LOWER\(platform\)/);
  assert.match(built.text, /internal_test_clicks/);
  assert.match(built.text, /known_bot_clicks/);
  assert.match(built.text, /suspected_bot_clicks/);
  assert.match(built.text, /unflagged_non_test_clicks/);
  assert.match(built.text, /is_bot IS TRUE/);
  assert.match(built.text, /suspected_automation_user_agent/);
  assert.doesNotMatch(built.text, /2026-11-01|chaturbate/);
});

test('calculates country shares across categories and combines platform rows', () => {
  const rows = analytics.rankRows([
    { country: 'US', category: 'male', platform: 'chaturbate', clicks: 80, unflagged_non_test_clicks: 45, known_bot_clicks: 20, suspected_bot_clicks: 5, internal_test_clicks: 10 },
    { country: 'US', category: 'male', platform: 'bongacams', clicks: 20, unflagged_non_test_clicks: 15, known_bot_clicks: 2, suspected_bot_clicks: 1, internal_test_clicks: 2 },
    { country: 'US', category: 'trans', platform: 'chaturbate', clicks: 40, unflagged_non_test_clicks: 30, known_bot_clicks: 5, suspected_bot_clicks: 2, internal_test_clicks: 3 },
    { country: 'GB', category: 'female', platform: 'bongacams', clicks: 10, unflagged_non_test_clicks: 8, known_bot_clicks: 1, suspected_bot_clicks: 0, internal_test_clicks: 1 }
  ]);
  const usMale = rows.find(x => x.country === 'US' && x.category === 'male');
  assert.equal(usMale.clicks, 100);
  assert.equal(usMale.unflaggedNonTestClicks, 60);
  assert.equal(usMale.knownBotClicks, 22);
  assert.equal(usMale.suspectedBotClicks, 6);
  assert.equal(usMale.internalTestClicks, 12);
  assert.equal(usMale.sharePercent, 66.67);
  assert.equal(usMale.categoryClicks, 60);
  assert.equal(usMale.countryClicks, 90);
  assert.equal(usMale.topCategory, true);
  assert.equal(rows.find(x => x.country === 'US' && x.category === 'trans').topCategory, false);
});

test('platform-filtered input calculates shares only within the selected platform', () => {
  const rows = analytics.rankRows([
    { country: 'US', category: 'male', platform: 'chaturbate', clicks: 30, unflagged_non_test_clicks: 30 },
    { country: 'US', category: 'trans', platform: 'chaturbate', clicks: 70, unflagged_non_test_clicks: 70 }
  ]);
  const usTrans = rows.find(x => x.category === 'trans');
  assert.equal(usTrans.sharePercent, 70);
  assert.equal(usTrans.countryClicks, 100);
  assert.equal(usTrans.topCategory, true);
});

test('marks every category tied for first place as a top category', () => {
  const rows = analytics.rankRows([
    { country: 'US', category: 'male', platform: 'chaturbate', clicks: 50, unflagged_non_test_clicks: 50 },
    { country: 'US', category: 'trans', platform: 'chaturbate', clicks: 50, unflagged_non_test_clicks: 50 },
    { country: 'US', category: 'female', platform: 'chaturbate', clicks: 10, unflagged_non_test_clicks: 10 }
  ]);
  assert.equal(rows.find(x => x.category === 'male').topCategory, true);
  assert.equal(rows.find(x => x.category === 'trans').topCategory, true);
  assert.equal(rows.find(x => x.category === 'male').tiedTopCategories, true);
  assert.equal(rows.find(x => x.category === 'female').topCategory, false);
});
