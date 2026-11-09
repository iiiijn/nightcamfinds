'use strict';

const CREDITED_EVENT_TYPES = new Set([
  'tokens_signup-referral',
  'tokens_broadcaster-referral',
  'ppr_signup-referral',
  'ppr_broadcaster-referral',
  'revshare_signup-referral',
  'revshare_broadcaster-referral',
  'revshare_purchase',
  'revshare_webmaster-commission',
  'revshare_payout-adjustment'
]);

function summarizeConversions(rows = []) {
  const totals = {
    matchedConversions: 0,
    unmatchedConversions: 0,
    testEvents: 0,
    excludedEvents: 0,
    attributedPayoutsByCurrency: {},
    pendingPayoutsByCurrency: {}
  };
  for (const row of rows) {
    const count = Math.max(0, Number(row.conversions || 0));
    if (row.isTest) {
      totals.testEvents += count;
      continue;
    }
    if (!CREDITED_EVENT_TYPES.has(String(row.conversionType || '').toLowerCase())) {
      totals.excludedEvents += count;
      continue;
    }
    const matched = Math.max(0, Number(row.matchedConversions || 0));
    const unmatched = Math.max(0, Number(row.unmatchedConversions || 0));
    totals.matchedConversions += matched;
    totals.unmatchedConversions += unmatched;
    const currency = String(row.currency || 'UNSPECIFIED').trim().toUpperCase() || 'UNSPECIFIED';
    const payout = Number(row.reportedPayout || 0);
    if (Number.isFinite(payout) && payout > 0) {
      const target = row.matchStatus === 'matched'
        ? totals.attributedPayoutsByCurrency
        : totals.pendingPayoutsByCurrency;
      target[currency] = (target[currency] || 0) + payout;
    }
  }
  return totals;
}

function summarizeTraffic(rows = []) {
  const byCountry = new Map();
  const byCampaign = new Map();
  for (const row of rows) {
    const clicks = Math.max(0, Number(row.clicks || 0));
    const conversions = Math.max(0, Number(row.matchedConversions || 0));
    const payouts = row.reportedPayoutsByCurrency && typeof row.reportedPayoutsByCurrency === 'object'
      ? row.reportedPayoutsByCurrency : {};
    const add = (map, key) => {
      const current = map.get(key) || { clicks: 0, matchedConversions: 0, payoutsByCurrency: {} };
      current.clicks += clicks;
      current.matchedConversions += conversions;
      for (const [currency, amount] of Object.entries(payouts)) {
        const code = String(currency || 'UNSPECIFIED').toUpperCase();
        const value = Number(amount || 0);
        if (Number.isFinite(value)) current.payoutsByCurrency[code] = (current.payoutsByCurrency[code] || 0) + value;
      }
      map.set(key, current);
    };
    add(byCountry, String(row.country || 'UNKNOWN').toUpperCase());
    add(byCampaign, [row.platform || 'unknown', row.source || 'unknown', row.campaign || 'unknown'].join(' · '));
  }
  const format = map => [...map.entries()].map(([name, value]) => ({
    name, ...value,
    conversionRate: value.clicks ? value.matchedConversions / value.clicks : 0
  })).sort((a, b) => b.clicks - a.clicks || a.name.localeCompare(b.name));
  return { countries: format(byCountry), campaigns: format(byCampaign) };
}

function combineUsdEarnings(chaturbateUsd, bongaManualUsd) {
  const cb = Number(chaturbateUsd || 0);
  const bonga = Number(bongaManualUsd || 0);
  return {
    chaturbateAttributedUsd: Number.isFinite(cb) ? cb : 0,
    bongaCashManualUsd: Number.isFinite(bonga) ? bonga : 0,
    combinedUsd: (Number.isFinite(cb) ? cb : 0) + (Number.isFinite(bonga) ? bonga : 0)
  };
}

module.exports = { CREDITED_EVENT_TYPES, summarizeConversions, summarizeTraffic, combineUsdEarnings };
