'use strict';

const clickOrigins = require('./click-origins.cjs');

function buildQuery(filters) {
  const parsed = clickOrigins.parseFilters(new URLSearchParams(
    Object.entries(filters || {}).filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => [key, String(value)]).reduce((params, [key, value]) => {
        params.append(key, value);
        return params;
      }, new URLSearchParams())
  ));
  if (parsed.error) return parsed;
  const base = clickOrigins.buildQuery(parsed.value);
  const whereStart = base.text.indexOf(' FROM affiliate_clicks ');
  const whereClause = base.text.slice(whereStart, base.text.indexOf(' GROUP BY'));
  return {
    text: "SELECT UPPER(country) AS country, LOWER(platform) AS platform, COALESCE(NULLIF(LOWER(source), ''), 'unknown') AS source, COALESCE(NULLIF(LOWER(campaign), ''), 'unknown') AS campaign, COUNT(*)::int AS clicks FROM affiliate_clicks" + whereClause + " GROUP BY 1,2,3,4 ORDER BY clicks DESC, country ASC, platform ASC, source ASC, campaign ASC LIMIT 2000",
    params: base.params,
    filters: parsed.value
  };
}

module.exports = { buildQuery };
