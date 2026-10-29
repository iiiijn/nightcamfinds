"use strict";

function countryCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "UNKNOWN";
}

function platformName(value) {
  const platform = String(value ?? "").trim().toLowerCase();
  return ["chaturbate", "bongacams"].includes(platform) ? platform : "unknown";
}

function finiteAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function buildDateRange(from, to, column = "received_at") {
  const allowedColumns = new Set(["clicked_at", "received_at"]);
  if (!allowedColumns.has(column)) throw new Error("Unsupported date-range column");
  const validDate = value => {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(value || ""))) return false;
    const date = new Date(String(value) + "T00:00:00.000Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const params = [];
  const where = [];
  if (validDate(from)) {
    params.push(`${from}T00:00:00.000Z`);
    where.push(`${column} >= ${params.length}`);
  }
  if (validDate(to)) {
    params.push(`${to}T23:59:59.999Z`);
    where.push(`${column} <= ${params.length}`);
  }
  return { params, where: where.length ? `WHERE ${where.join(" AND ")}` : "" };
}

function summarizeCountryPerformance(clickRows = [], conversionRows = []) {
  const groups = new Map();
  const getGroup = (country, platform) => {
    const normalizedCountry = countryCode(country);
    const normalizedPlatform = platformName(platform);
    const key = normalizedCountry + ":" + normalizedPlatform;
    if (!groups.has(key)) {
      groups.set(key, {
        country: normalizedCountry,
        platform: normalizedPlatform,
        clicks: 0,
        engagedClicks: null,
        signups: 0,
        payers: 0,
        revenue: null,
        revenueCurrency: null,
        epc: null,
        attributionQuality: "click_attributed",
        _payerIds: new Set(),
        _revenueEvents: [],
        _hasUnmatched: false
      });
    }
    return groups.get(key);
  };

  for (const row of clickRows) {
    const group = getGroup(row.country, row.platform);
    group.clicks += Math.max(0, Math.trunc(finiteAmount(row.clicks)));
  }

  for (const row of conversionRows) {
    const hasMatchedClick = row.matched_click === true || row.matched_click === "true" || row.matched_click === 1;
    const clickCountry = String(row.click_country ?? "").trim();
    const matched = hasMatchedClick && /^[A-Za-z]{2}$/.test(clickCountry);
    const country = matched ? clickCountry : (row.reported_country || "UNKNOWN");
    const group = getGroup(country, row.platform);
    const type = String(row.conversion_type ?? "").trim().toLowerCase();
    const platform = platformName(row.platform);

    const isSignup = platform === "chaturbate"
      ? type === "revshare_signup-referral"
      : type === "registration";
    const isPayerEvent = platform === "chaturbate"
      ? type === "revshare_purchase"
      : type === "purchase";

    if (isSignup) group.signups += 1;
    if (isPayerEvent && row.user_id != null && String(row.user_id).trim()) {
      group._payerIds.add(String(row.user_id).trim());
    }

    const isRevenueEvent = platform === "chaturbate"
      ? ["revshare_purchase", "revshare_payout-adjustment"].includes(type)
      : ["purchase", "refund"].includes(type);
    if (isRevenueEvent) {
      const currency = String(row.currency ?? "").trim().toUpperCase();
      group._revenueEvents.push({
        payout: finiteAmount(row.payout),
        currency: /^[A-Z]{3,8}$/.test(currency) ? currency : null
      });
    }
    if (!matched) group._hasUnmatched = true;
  }

  return [...groups.values()].map(group => {
    group.payers = group._payerIds.size;
    const events = group._revenueEvents;
    const currencies = [...new Set(events.map(event => event.currency).filter(Boolean))];
    const hasMissingCurrency = events.some(event => !event.currency);
    if (events.length && currencies.length === 1 && !hasMissingCurrency) {
      group.revenue = Number(events.reduce((sum, event) => sum + event.payout, 0).toFixed(4));
      group.revenueCurrency = currencies[0];
      group.epc = group.clicks > 0
        ? Number((group.revenue / group.clicks).toFixed(6))
        : null;
    } else if (events.length) {
      group.revenue = null;
      group.revenueCurrency = currencies.length > 1 ? "MIXED" : "UNKNOWN";
      group.epc = null;
    }
    group.attributionQuality = group._hasUnmatched
      ? (group.clicks > 0 ? "mixed_matched_and_unmatched" : "partner_reported_unmatched")
      : "click_attributed";
    delete group._payerIds;
    delete group._revenueEvents;
    delete group._hasUnmatched;
    return group;
  }).sort((a, b) => a.country.localeCompare(b.country) || a.platform.localeCompare(b.platform));
}

module.exports = { summarizeCountryPerformance, buildDateRange };
