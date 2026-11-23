'use strict';

const DEFAULTS = Object.freeze({ perMinute: 8, perHour: 40 });

function parseFilters(searchParams = new URLSearchParams()) {
  const from = searchParams.get('from') || null;
  const to = searchParams.get('to') || null;
  const valid = value => /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));
  if (from && !valid(from)) return { error: 'Invalid start date.' };
  if (to && !valid(to)) return { error: 'Invalid end date.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };
  return { value: { from, to } };
}

function buildQuery(filters = {}, thresholds = DEFAULTS) {
  const params = [];
  const clauses = ["visit_id IS NOT NULL", "BTRIM(visit_id) <> ''", "COALESCE(is_owner_traffic,FALSE) IS FALSE"];
  if (filters.from) { params.push(filters.from + 'T00:00:00.000Z'); clauses.push('clicked_at >= $' + params.length + '::timestamptz'); }
  if (filters.to) { params.push(filters.to + 'T23:59:59.999Z'); clauses.push('clicked_at <= $' + params.length + '::timestamptz'); }
  params.push(Number(thresholds.perMinute || DEFAULTS.perMinute));
  const minuteParam = '$' + params.length;
  params.push(Number(thresholds.perHour || DEFAULTS.perHour));
  const hourParam = '$' + params.length;
  const text = `
    WITH scoped AS (
      SELECT visit_id, UPPER(COALESCE(NULLIF(country,''),'UNKNOWN')) AS country,
             LOWER(COALESCE(NULLIF(platform,''),'unknown')) AS platform, clicked_at
      FROM affiliate_clicks WHERE ${clauses.join(' AND ')}
    ),
    minute_buckets AS (
      SELECT visit_id, country, platform, date_trunc('minute', clicked_at) AS bucket, COUNT(*)::int AS clicks
      FROM scoped GROUP BY visit_id, country, platform, date_trunc('minute', clicked_at)
    ),
    hour_buckets AS (
      SELECT visit_id, country, platform, date_trunc('hour', clicked_at) AS bucket, COUNT(*)::int AS clicks
      FROM scoped GROUP BY visit_id, country, platform, date_trunc('hour', clicked_at)
    ),
    visit_totals AS (
      SELECT visit_id, country, platform, COUNT(*)::int AS total_clicks,
             MIN(clicked_at) AS first_click, MAX(clicked_at) AS last_click
      FROM scoped GROUP BY visit_id, country, platform
    ),
    minute_peaks AS (
      SELECT visit_id, country, platform, MAX(clicks)::int AS peak_clicks_per_minute
      FROM minute_buckets GROUP BY visit_id, country, platform
    ),
    hour_peaks AS (
      SELECT visit_id, country, platform, MAX(clicks)::int AS peak_clicks_per_hour
      FROM hour_buckets GROUP BY visit_id, country, platform
    )
    SELECT v.visit_id, v.country, v.platform, v.total_clicks, v.first_click, v.last_click,
           m.peak_clicks_per_minute, h.peak_clicks_per_hour,
           CASE WHEN m.peak_clicks_per_minute >= ${minuteParam} THEN 'high_burst'
                WHEN h.peak_clicks_per_hour >= ${hourParam} THEN 'repeated'
                ELSE 'normal' END AS anomaly_class
    FROM visit_totals v
    JOIN minute_peaks m USING (visit_id,country,platform)
    JOIN hour_peaks h USING (visit_id,country,platform)
    WHERE m.peak_clicks_per_minute >= ${minuteParam} OR h.peak_clicks_per_hour >= ${hourParam}
    ORDER BY m.peak_clicks_per_minute DESC, h.peak_clicks_per_hour DESC, v.total_clicks DESC
    LIMIT 500
  `;
  return { text, params, thresholds: { perMinute: Number(thresholds.perMinute || DEFAULTS.perMinute), perHour: Number(thresholds.perHour || DEFAULTS.perHour) } };
}

function summarize(rows = []) {
  const countries = new Map();
  const platforms = new Map();
  let flaggedClicks = 0;
  for (const row of rows) {
    const clicks = Number(row.total_clicks || 0);
    flaggedClicks += clicks;
    countries.set(row.country, (countries.get(row.country) || 0) + clicks);
    platforms.set(row.platform, (platforms.get(row.platform) || 0) + clicks);
  }
  const entries = map => Object.fromEntries([...map.entries()].sort((a,b) => b[1]-a[1]));
  return {
    affectedVisits: new Set(rows.map(row => row.visit_id)).size,
    flaggedClicks,
    highBurstVisits: rows.filter(row => row.anomaly_class === 'high_burst').length,
    repeatedVisits: rows.filter(row => row.anomaly_class === 'repeated').length,
    byCountry: entries(countries),
    byPlatform: entries(platforms),
    rows: rows.map(row => ({
      visitId: row.visit_id,
      country: row.country,
      platform: row.platform,
      clicks: Number(row.total_clicks || 0),
      peakClicksPerMinute: Number(row.peak_clicks_per_minute || 0),
      peakClicksPerHour: Number(row.peak_clicks_per_hour || 0),
      firstClick: row.first_click,
      lastClick: row.last_click,
      classification: row.anomaly_class
    }))
  };
}

module.exports = { DEFAULTS, parseFilters, buildQuery, summarize };
