'use strict';

const { validDate } = require('./click-origins.cjs');

function buildQuery(filters = {}) {
  const from = String(filters.from || '').trim();
  const to = String(filters.to || '').trim();
  if ((from && !validDate(from)) || (to && !validDate(to))) return { error: 'Dates must be valid calendar dates in YYYY-MM-DD format.' };
  if (from && to && from > to) return { error: 'Start date must be on or before end date.' };

  const clickParams = [];
  const clickWhere = [];
  const conversionParams = [];
  const conversionWhere = [];
  if (from) {
    clickParams.push(from);
    clickWhere.push("ac.clicked_at >= ($" + clickParams.length + "::date AT TIME ZONE 'UTC')");
    conversionParams.push(from);
    conversionWhere.push("cc.received_at >= ($" + conversionParams.length + "::date AT TIME ZONE 'UTC')");
  }
  if (to) {
    clickParams.push(to);
    clickWhere.push("ac.clicked_at < (($" + clickParams.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
    conversionParams.push(to);
    conversionWhere.push("cc.received_at < (($" + conversionParams.length + "::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");
  }

  const internalTrafficExclusion = "LOWER(COALESCE(ac.source, '')) <> 'test' AND LOWER(COALESCE(ac.campaign, '')) NOT IN ('test_female_01', 'revshare_audit_01')";

  const text = [
    'WITH click_groups AS (',
    '  SELECT UPPER(COALESCE(NULLIF(ac.country, \'\'), \'UNKNOWN\')) AS country,',
    '         LOWER(COALESCE(NULLIF(ac.platform, \'\'), \'unknown\')) AS platform,',
    '         COALESCE(NULLIF(LOWER(ac.source), \'\'), \'unknown\') AS source,',
    '         COALESCE(NULLIF(LOWER(ac.campaign), \'\'), \'unknown\') AS campaign,',
    '         COUNT(*)::int AS clicks',
    '  FROM affiliate_clicks ac',
    '  WHERE ' + [...clickWhere, internalTrafficExclusion].join(' AND '),
    '  GROUP BY 1,2,3,4',
    '), matched_by_currency AS (',
    '  SELECT UPPER(COALESCE(NULLIF(cc.currency, \'\'), \'UNSPECIFIED\')) AS currency,',
    '         UPPER(COALESCE(NULLIF(ac.country, \'\'), \'UNKNOWN\')) AS country,',
    '         \'chaturbate\'::text AS platform,',
    '         COALESCE(NULLIF(LOWER(ac.source), \'\'), \'unknown\') AS source,',
    '         COALESCE(NULLIF(LOWER(ac.campaign), \'\'), \'unknown\') AS campaign,',
    '         COUNT(*)::int AS conversions,',
    '         COALESCE(SUM(cc.payout), 0)::numeric AS reported_payout',
    '  FROM cb_conversions cc',
    '  JOIN LATERAL (',
    '    SELECT country, source, campaign FROM affiliate_clicks',
    '    WHERE click_id = cc.click_id AND LOWER(platform) = \'chaturbate\' AND LOWER(COALESCE(source, \'\')) <> \'test\' AND LOWER(COALESCE(campaign, \'\')) NOT IN (\'test_female_01\', \'revshare_audit_01\')',
    '    ORDER BY clicked_at ASC, id ASC LIMIT 1',
    '  ) ac ON TRUE',
    '  WHERE cc.matched_click IS TRUE',
    "    AND LOWER(cc.conversion_type) IN ('tokens_signup-referral','tokens_broadcaster-referral','ppr_signup-referral','ppr_broadcaster-referral','revshare_signup-referral','revshare_broadcaster-referral','revshare_purchase','revshare_webmaster-commission','revshare_payout-adjustment')",
    "    AND NULLIF(BTRIM(cc.click_id), '') IS NOT NULL",
    "    AND NOT EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(cc.raw_payload, '{}'::jsonb)) AS p(key,value) WHERE p.value ~ '^\\\\{[A-Za-z][A-Za-z0-9_]*\\\\}$')",
    conversionWhere.length ? '    AND ' + conversionWhere.join(' AND ') : '',
    '  GROUP BY 1,2,3,4,5',
    '), conversion_groups AS (',
    '  SELECT country, platform, source, campaign,',
    '         SUM(conversions)::int AS matched_conversions,',
    '         jsonb_object_agg(currency, reported_payout) AS reported_payouts_by_currency',
    '  FROM matched_by_currency',
    '  GROUP BY country, platform, source, campaign',
    ')',
    'SELECT c.country, c.platform, c.source, c.campaign, c.clicks,',
    '       COALESCE(v.matched_conversions, 0)::int AS matched_conversions,',
    '       COALESCE(v.reported_payouts_by_currency, \'{}\'::jsonb) AS reported_payouts_by_currency',
    'FROM click_groups c',
    'LEFT JOIN conversion_groups v USING (country, platform, source, campaign)',
    'ORDER BY matched_conversions DESC, clicks DESC, country ASC, source ASC, campaign ASC',
    'LIMIT 2000'
  ].filter(Boolean).join('\n');

  return { text, params: { clicks: clickParams, conversions: conversionParams }, filters: { from, to } };
}

module.exports = { buildQuery };
