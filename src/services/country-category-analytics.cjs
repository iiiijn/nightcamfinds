'use strict';

const CATEGORIES = Object.freeze(['female', 'male', 'trans', 'couples']);
const ISO_DATE = /^\\d{4}-\\d{2}-\\d{2}$/;

function validDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function parseFilters(params) {
  const from = String(params.get('from') || '').trim();
  const to = String(params.get('to') || '').trim();
  const country = String(params.get('country') || 'ALL').trim().toUpperCase();
  const platform = String(params.get('platform') || 'ALL').trim().toLowerCase();
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };
  if (country !== 'ALL' && !/^[A-Z]{2}$/.test(country)) return { error: 'Country must be ALL or a two-letter country code.' };
  if (platform !== 'ALL' && !['chaturbate', 'bongacams'].includes(platform)) return { error: 'Platform must be ALL, chaturbate or bongacams.' };
  return { value: { from, to, country, platform } };
}

function buildQuery(filters) {
  const params = [];
  const where = ["LOWER(category) = ANY($1::text[])"];
  params.push(CATEGORIES);
  if (filters.from) { params.push(filters.from); where.push("clicked_at >= ($" + params.length + "::date AT TIME ZONE 'UTC')"); }
  if (filters.to) { params.push(filters.to); where.push("clicked_at < (($" + params.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')"); }
  if (filters.country !== 'ALL') { params.push(filters.country); where.push("UPPER(country) = $" + params.length); }
  if (filters.platform !== 'ALL') { params.push(filters.platform); where.push("LOWER(platform) = $" + params.length); }
  return {
    text: "SELECT UPPER(country) AS country, LOWER(category) AS category, LOWER(platform) AS platform, COUNT(*)::int AS clicks FROM affiliate_clicks WHERE " + where.join(' AND ') + " GROUP BY UPPER(country), LOWER(category), LOWER(platform) ORDER BY country ASC, clicks DESC, category ASC, platform ASC LIMIT 2000",
    params
  };
}

function rankRows(rows) {
  const countryTotals = new Map();
  const categoryTotals = new Map();
  for (const row of rows) {
    const clicks = Number(row.clicks || 0);
    countryTotals.set(row.country, (countryTotals.get(row.country) || 0) + clicks);
    const categories = categoryTotals.get(row.country) || new Map();
    categories.set(row.category, (categories.get(row.category) || 0) + clicks);
    categoryTotals.set(row.country, categories);
  }

  const topByCountry = new Map();
  for (const [country, categories] of categoryTotals) {
    const highest = Math.max(...categories.values());
    topByCountry.set(country, new Set(
      [...categories.entries()].filter(([, clicks]) => clicks === highest).map(([category]) => category)
    ));
  }

  return rows.map(row => {
    const clicks = Number(row.clicks || 0);
    const categoryClicks = categoryTotals.get(row.country)?.get(row.category) || 0;
    const total = countryTotals.get(row.country) || 0;
    const topCategories = topByCountry.get(row.country) || new Set();
    return {
      country: row.country,
      category: row.category,
      platform: row.platform,
      clicks,
      categoryClicks,
      countryClicks: total,
      sharePercent: total ? Math.round(categoryClicks / total * 10000) / 100 : 0,
      topCategory: topCategories.has(row.category),
      tiedTopCategories: topCategories.size > 1
    };
  }).sort((a, b) => a.country.localeCompare(b.country) || b.categoryClicks - a.categoryClicks || a.category.localeCompare(b.category) || a.platform.localeCompare(b.platform));
}

module.exports = { CATEGORIES, validDate, parseFilters, buildQuery, rankRows };
