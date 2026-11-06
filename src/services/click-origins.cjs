'use strict';

const CATEGORIES = Object.freeze(['female', 'male', 'trans', 'couples']);
const PLATFORMS = Object.freeze(['chaturbate', 'bongacams']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseFilters(params) {
  const from = String(params.get('from') || '').trim();
  const to = String(params.get('to') || '').trim();
  const country = String(params.get('country') || 'ALL').trim().toUpperCase();
  const platform = String(params.get('platform') || 'ALL').trim().toLowerCase();
  const category = String(params.get('category') || 'ALL').trim().toLowerCase();
  const source = String(params.get('source') || 'ALL').trim().toLowerCase();
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };
  if (country !== 'ALL' && !/^[A-Z]{2}$/.test(country)) return { error: 'Country must be ALL or a two-letter country code.' };
  if (platform !== 'ALL' && !PLATFORMS.includes(platform)) return { error: 'Platform must be ALL, chaturbate or bongacams.' };
  if (category !== 'ALL' && !CATEGORIES.includes(category)) return { error: 'Category must be ALL, female, male, trans or couples.' };
  if (source.length > 80 || !/^[a-z0-9._:-]*$/.test(source)) return { error: 'Source filter contains unsupported characters.' };
  return { value: { from, to, country, platform, category, source } };
}

function buildQuery(filters) {
  const params = [];
  const where = [];
  if (filters.from) { params.push(filters.from); where.push("clicked_at >= ($" + params.length + "::date AT TIME ZONE 'UTC')"); }
  if (filters.to) { params.push(filters.to); where.push("(clicked_at < (($" + params.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC'))"); }
  if (filters.country !== 'ALL') { params.push(filters.country); where.push("UPPER(country) = $" + params.length); }
  if (filters.platform !== 'ALL') { params.push(filters.platform); where.push("LOWER(platform) = $" + params.length); }
  if (filters.category !== 'ALL') { params.push(filters.category); where.push("LOWER(category) = $" + params.length); }
  if (filters.source !== 'ALL') { params.push(filters.source); where.push("LOWER(source) = $" + params.length); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return {
    text: "SELECT (clicked_at AT TIME ZONE 'UTC')::date AS date, UPPER(country) AS country, LOWER(platform) AS platform, LOWER(category) AS category, COALESCE(NULLIF(LOWER(source), ''), 'unknown') AS source, COALESCE(NULLIF(LOWER(medium), ''), 'unknown') AS medium, COALESCE(NULLIF(LOWER(campaign), ''), 'unknown') AS campaign, COALESCE(NULLIF(LOWER(content), ''), 'unknown') AS content, COALESCE(NULLIF(LOWER(placement), ''), 'unknown') AS placement, COALESCE(NULLIF(LOWER(landing_path), ''), 'unknown') AS landing_path, COALESCE(NULLIF(LOWER(device), ''), 'unknown') AS device, COUNT(*)::int AS clicks FROM affiliate_clicks " + whereSql + " GROUP BY 1,2,3,4,5,6,7,8,9,10,11 ORDER BY clicks DESC, date DESC, country ASC LIMIT 2000",
    params
  };
}

module.exports = { CATEGORIES, PLATFORMS, validDate, parseFilters, buildQuery };
