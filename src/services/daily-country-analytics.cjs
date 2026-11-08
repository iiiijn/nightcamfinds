'use strict';

const TIER1_COUNTRIES = Object.freeze(['US','GB','NO','CH','SE','DK','AU','CA','DE','NL','FR','IE','FI','AT','BE','NZ','IS','LU']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseFilters(searchParams) {
  const from = String(searchParams.get('from') || '').trim();
  const to = String(searchParams.get('to') || '').trim();
  const country = String(searchParams.get('country') || 'ALL').trim().toUpperCase();
  const tier1 = String(searchParams.get('tier1') || '').toLowerCase() === 'true';
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };
  if (country !== 'ALL' && !/^[A-Z]{2}$/.test(country)) return { error: 'Country must be ALL or a two-letter country code.' };
  return { value: { from, to, country, tier1 } };
}

function buildQuery(filters, options = {}) {
  const params = [], conditions = [];
  if (filters.from) { params.push(filters.from); conditions.push("clicked_at >= ($" + params.length + "::date AT TIME ZONE 'UTC')"); }
  if (filters.to) { params.push(filters.to); conditions.push("clicked_at < (($" + params.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')"); }
  if (filters.tier1) { params.push(TIER1_COUNTRIES); conditions.push('UPPER(country) = ANY($' + params.length + '::text[])'); }
  if (filters.country !== 'ALL') { params.push(filters.country); conditions.push('UPPER(country) = $' + params.length); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const engagement = options.includeEngagement === false ? 'NULL::int AS engaged_clicks' : 'COUNT(*) FILTER (WHERE engaged_at IS NOT NULL)::int AS engaged_clicks';
  return { text: "SELECT (clicked_at AT TIME ZONE 'UTC')::date AS day, UPPER(country) AS country, LOWER(platform) AS platform, COUNT(*)::int AS clicks, " + engagement + " FROM affiliate_clicks " + where + " GROUP BY (clicked_at AT TIME ZONE 'UTC')::date, UPPER(country), LOWER(platform) ORDER BY day DESC, clicks DESC, country ASC, platform ASC LIMIT 20000", params };
}

module.exports = { TIER1_COUNTRIES, validDate, parseFilters, buildQuery };
