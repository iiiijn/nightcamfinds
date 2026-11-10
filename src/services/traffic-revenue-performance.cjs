'use strict';

const { validDate } = require('./click-origins.cjs');

function buildQuery(filters = {}) {
  const from = String(filters.from || '').trim();
  const to = String(filters.to || '').trim();
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };

  const clickParams = [], clickWhere = [];
  const visitParams = [], visitWhere = [];
  const conversionParams = [], conversionWhere = [];
  if (from) {
    clickParams.push(from); clickWhere.push("ac.clicked_at >= ($" + clickParams.length + "::date AT TIME ZONE 'UTC')");
    visitParams.push(from); visitWhere.push("tv.first_seen_at >= ($" + visitParams.length + "::date AT TIME ZONE 'UTC')");
    conversionParams.push(from); conversionWhere.push("cc.received_at >= ($" + conversionParams.length + "::date AT TIME ZONE 'UTC')");
  }
  if (to) {
    clickParams.push(to); clickWhere.push("ac.clicked_at < (($" + clickParams.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    visitParams.push(to); visitWhere.push("tv.first_seen_at < (($" + visitParams.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    conversionParams.push(to); conversionWhere.push("cc.received_at < (($" + conversionParams.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
  }

  const internalClickExclusion = "LOWER(COALESCE(ac.source, '')) <> 'test' AND LOWER(COALESCE(ac.campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')";
  const internalVisitExclusion = "LOWER(COALESCE(tv.source, '')) <> 'test' AND LOWER(COALESCE(tv.campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')";

  const text = [
    'WITH click_groups AS (',
    "  SELECT UPPER(COALESCE(NULLIF(ac.country, ''), 'UNKNOWN')) AS country,",
    "         LOWER(COALESCE(NULLIF(ac.platform, ''), 'unknown')) AS platform,",
    "         COALESCE(NULLIF(LOWER(ac.source), ''), 'unknown') AS source,",
    "         COALESCE(NULLIF(LOWER(ac.campaign), ''), 'unknown') AS campaign,",
    '         COUNT(*)::int AS clicks',
    '  FROM affiliate_clicks ac',
    '  WHERE ' + [...clickWhere, internalClickExclusion].join(' AND '),
    '  GROUP BY 1,2,3,4',
    '), visit_groups AS (',
    "  SELECT UPPER(COALESCE(NULLIF(tv.country, ''), 'UNKNOWN')) AS country,",
    "         LOWER(COALESCE(NULLIF(tv.platform, ''), 'unknown')) AS platform,",
    "         COALESCE(NULLIF(LOWER(tv.source), ''), 'unknown') AS source,",
    "         COALESCE(NULLIF(LOWER(tv.campaign), ''), 'unknown') AS campaign,",
    '         COUNT(*)::int AS visits,',
    "         COUNT(*) FILTER (WHERE tv.traffic_class = 'unverified' AND EXISTS (",
    "           SELECT 1 FROM traffic_engagement_events e WHERE e.visit_id = tv.visit_id AND e.event_type IN ('active_10s','scroll_50')",
    '         ))::int AS engaged_visits,',
    '         COUNT(*) FILTER (WHERE EXISTS (',
    '           SELECT 1 FROM affiliate_clicks acv WHERE acv.visit_id = tv.visit_id',
    '         ))::int AS visits_with_affiliate_click',
    '  FROM traffic_visits tv',
    '  WHERE ' + [...visitWhere, internalVisitExclusion].join(' AND '),
    '  GROUP BY 1,2,3,4',
    '), matched_by_currency AS (',
    "  SELECT UPPER(COALESCE(NULLIF(cc.currency, ''), 'UNSPECIFIED')) AS currency,",
    "         UPPER(COALESCE(NULLIF(ac.country, ''), 'UNKNOWN')) AS country,",
    "         'chaturbate'::text AS platform,",
    "         COALESCE(NULLIF(LOWER(ac.source), ''), 'unknown') AS source,",
    "         COALESCE(NULLIF(LOWER(ac.campaign), ''), 'unknown') AS campaign,",
    '         COUNT(*)::int AS conversions,',
    '         COALESCE(SUM(cc.payout), 0)::numeric AS reported_payout',
    '  FROM cb_conversions cc',
    '  JOIN LATERAL (',
    '    SELECT country, source, campaign FROM affiliate_clicks',
    "    WHERE click_id = cc.click_id AND LOWER(platform) = 'chaturbate' AND LOWER(COALESCE(source, '')) <> 'test' AND LOWER(COALESCE(campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')",
    '    ORDER BY clicked_at ASC, id ASC LIMIT 1',
    '  ) ac ON TRUE',
    '  WHERE cc.matched_click IS TRUE',
    "    AND LOWER(cc.conversion_type) IN ('tokens_signup-referral','tokens_broadcaster-referral','ppr_signup-referral','ppr_broadcaster-referral','revshare_signup-referral','revshare_broadcaster-referral','revshare_purchase','revshare_webmaster-commission','revshare_payout-adjustment')",
    "    AND NULLIF(BTRIM(cc.click_id), '') IS NOT NULL",
    "    AND NOT EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(cc.raw_payload, '{}'::jsonb)) AS p(key,value) WHERE p.value ~ '^\\{[A-Za-z][A-Za-z0-9_]*\\}$')",
    conversionWhere.length ? '    AND ' + conversionWhere.join(' AND ') : '',
    '  GROUP BY 1,2,3,4,5',
    '), conversion_groups AS (',
    '  SELECT country, platform, source, campaign,',
    '         SUM(conversions)::int AS matched_conversions,',
    '         jsonb_object_agg(currency, reported_payout) AS reported_payouts_by_currency',
    '  FROM matched_by_currency',
    '  GROUP BY country, platform, source, campaign',
    '), all_groups AS (',
    '  SELECT COALESCE(c.country, v.country) AS country,',
    '         COALESCE(c.platform, v.platform) AS platform,',
    '         COALESCE(c.source, v.source) AS source,',
    '         COALESCE(c.campaign, v.campaign) AS campaign,',
    '         COALESCE(c.clicks, 0)::int AS clicks,',
    '         COALESCE(v.visits, 0)::int AS visits,',
    '         COALESCE(v.engaged_visits, 0)::int AS engaged_visits,',
    '         COALESCE(v.visits_with_affiliate_click, 0)::int AS visits_with_affiliate_click',
    '  FROM click_groups c FULL OUTER JOIN visit_groups v',
    '    ON c.country=v.country AND c.platform=v.platform AND c.source=v.source AND c.campaign=v.campaign',
    ')',
    'SELECT g.country, g.platform, g.source, g.campaign, g.clicks, g.visits,',
    '       g.engaged_visits, g.visits_with_affiliate_click,',
    '       COALESCE(v.matched_conversions, 0)::int AS matched_conversions,',
    "       COALESCE(v.reported_payouts_by_currency, '{}'::jsonb) AS reported_payouts_by_currency",
    'FROM all_groups g',
    'LEFT JOIN conversion_groups v USING (country, platform, source, campaign)',
    'ORDER BY matched_conversions DESC, engaged_visits DESC, clicks DESC, visits DESC, country ASC, source ASC, campaign ASC',
    'LIMIT 2000'
  ].filter(Boolean).join('\n');

  return { text, params: { clicks: clickParams, visits: visitParams, conversions: conversionParams }, filters: { from, to } };
}

module.exports = { buildQuery };
