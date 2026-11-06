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
  const totals = new Map();
  for (const row of rows) totals.set(row.country, (totals.get(row.country) || 0) + Number(row.clicks || 0));
  return rows.map(row => {
    const clicks = Number(row.clicks || 0);
    const total = totals.get(row.country) || 0;
    return { country: row.country, category: row.category, platform: row.platform, clicks, countryClicks: total, sharePercent: total ? Math.round(clicks / total * 10000) / 100 : 0 };
  }).sort((a, b) => a.country.localeCompare(b.country) || b.clicks - a.clicks || a.category.localeCompare(b.category));
}

module.exports = { CATEGORIES, validDate, parseFilters, buildQuery, rankRows };
