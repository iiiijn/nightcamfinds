(function (root) {
  'use strict';
  const CREDITED_EVENT_TYPES = new Set([
    'tokens_signup-referral','tokens_broadcaster-referral','ppr_signup-referral',
    'ppr_broadcaster-referral','revshare_signup-referral','revshare_broadcaster-referral',
    'revshare_purchase','revshare_webmaster-commission','revshare_payout-adjustment'
  ]);
  function summarizeConversions(rows = []) {
    const out = { matchedConversions: 0, unmatchedConversions: 0, testEvents: 0, excludedEvents: 0, attributedPayoutsByCurrency: {}, pendingPayoutsByCurrency: {} };
    for (const row of rows) {
      const count = Math.max(0, Number(row.conversions || 0));
      if (row.isTest) { out.testEvents += count; continue; }
      if (!CREDITED_EVENT_TYPES.has(String(row.conversionType || '').toLowerCase())) { out.excludedEvents += count; continue; }
      const matched = Math.max(0, Number(row.matchedConversions || 0));
      const unmatched = Math.max(0, Number(row.unmatchedConversions || 0));
      out.matchedConversions += matched;
      out.unmatchedConversions += unmatched;
      const currency = String(row.currency || 'UNSPECIFIED').trim().toUpperCase() || 'UNSPECIFIED';
      const payout = Number(row.reportedPayout || 0);
      if (Number.isFinite(payout) && payout > 0) {
        const target = row.matchStatus === 'matched' ? out.attributedPayoutsByCurrency : out.pendingPayoutsByCurrency;
        target[currency] = (target[currency] || 0) + payout;
      }
    }
    return out;
  }
  function summarizeTraffic(rows = []) {
    const countries = new Map(), campaigns = new Map();
    for (const row of rows) {
      const clicks = Math.max(0, Number(row.clicks || 0));
      const conversions = Math.max(0, Number(row.matchedConversions || 0));
      const payouts = row.reportedPayoutsByCurrency && typeof row.reportedPayoutsByCurrency === 'object' ? row.reportedPayoutsByCurrency : {};
      const add = (map, key) => {
        const item = map.get(key) || { clicks: 0, matchedConversions: 0, payoutsByCurrency: {} };
        item.clicks += clicks; item.matchedConversions += conversions;
        for (const [currency, amount] of Object.entries(payouts)) {
          const code = String(currency || 'UNSPECIFIED').toUpperCase(), value = Number(amount || 0);
          if (Number.isFinite(value)) item.payoutsByCurrency[code] = (item.payoutsByCurrency[code] || 0) + value;
        }
        map.set(key, item);
      };
      add(countries, String(row.country || 'UNKNOWN').toUpperCase());
      add(campaigns, [row.platform || 'unknown', row.source || 'unknown', row.campaign || 'unknown'].join(' · '));
    }
    const format = map => [...map.entries()].map(([name, item]) => ({ name, ...item, conversionRate: item.clicks ? item.matchedConversions / item.clicks : 0 }))
      .sort((a,b) => b.clicks-a.clicks || a.name.localeCompare(b.name));
    return { countries: format(countries), campaigns: format(campaigns) };
  }
  const api = { CREDITED_EVENT_TYPES, summarizeConversions, summarizeTraffic };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NCFRevenueSummary = api;
})(typeof window !== 'undefined' ? window : globalThis);
