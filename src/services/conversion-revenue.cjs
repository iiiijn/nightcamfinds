'use strict';
const { validDate } = require('./click-origins.cjs');
const { invalidCallbackPredicate } = require('./callback-integrity.cjs');
function buildQuery(filters = {}) {
  const from=String(filters.from||'').trim(), to=String(filters.to||'').trim();
  if((from&&!validDate(from))||(to&&!validDate(to))) return {error:'Dates must be valid calendar dates in YYYY-MM-DD format.'};
  if(from&&to&&from>to) return {error:'Start date must be on or before end date.'};
  const params=[],where=[];
  if(from){params.push(from);where.push("cc.received_at >= ($"+params.length+"::date AT TIME ZONE 'UTC')");}
  if(to){params.push(to);where.push("cc.received_at < (($"+params.length+"::date + INTERVAL '1 day') AT TIME ZONE 'UTC')");}
  const isMacro=invalidCallbackPredicate('cc');
  const eventClass="CASE WHEN LOWER(cc.conversion_type)='revshare_purchase' THEN 'member_purchase_revshare' WHEN LOWER(cc.conversion_type) IN ('tokens_signup-referral','ppr_signup-referral','revshare_signup-referral') THEN 'signup_referral' WHEN LOWER(cc.conversion_type) IN ('tokens_broadcaster-referral','ppr_broadcaster-referral','revshare_broadcaster-referral') THEN 'broadcaster_referral' WHEN LOWER(cc.conversion_type)='revshare_webmaster-commission' THEN 'webmaster_commission' WHEN LOWER(cc.conversion_type)='revshare_payout-adjustment' THEN 'payout_adjustment' ELSE 'other' END";
  const text=[
    'SELECT',
    "COALESCE(NULLIF(UPPER(ac.country), ''), NULLIF(UPPER(bc.country), ''), NULLIF(UPPER(cc.country), ''), 'UNKNOWN') AS country,",
    "'chaturbate'::text AS platform,",
    "COALESCE(NULLIF(LOWER(ac.source), ''), NULLIF(LOWER(bc.source), ''), NULLIF(LOWER(cc.source), ''), 'unknown') AS source,",
    "COALESCE(NULLIF(LOWER(ac.campaign), ''), NULLIF(LOWER(bc.campaign), ''), NULLIF(LOWER(cc.campaign_id), ''), 'unknown') AS campaign,",
    "LOWER(COALESCE(NULLIF(cc.conversion_type, ''), 'unknown')) AS conversion_type,",
    "COALESCE(NULLIF(UPPER(cc.currency), ''), 'UNSPECIFIED') AS currency,",
    isMacro+' AS is_test,',
    "CASE WHEN "+isMacro+" THEN 'invalid_callback' WHEN NULLIF(BTRIM(cc.click_id), '') IS NULL THEN 'missing_click_id' WHEN cc.matched_click IS TRUE THEN 'matched' ELSE 'click_id_not_found' END AS match_status,",
    eventClass+' AS event_class,',
    'COUNT(*)::int AS conversions,',
    'COUNT(*) FILTER (WHERE cc.matched_click IS TRUE AND NOT '+isMacro+')::int AS matched_conversions,',
    'COUNT(*) FILTER (WHERE cc.matched_click IS NOT TRUE AND NOT '+isMacro+')::int AS unmatched_conversions,',
    'COALESCE(SUM(cc.payout), 0)::numeric AS reported_payout,',
    "COALESCE(SUM(cc.amount) FILTER (WHERE LOWER(cc.conversion_type)='revshare_purchase'), 0)::numeric AS reported_spend",
    'FROM cb_conversions cc',
    'LEFT JOIN cb_clicks bc ON bc.click_id = cc.click_id',
    "LEFT JOIN LATERAL (SELECT country, source, campaign FROM affiliate_clicks WHERE click_id = cc.click_id AND LOWER(platform) = 'chaturbate' ORDER BY clicked_at ASC, id ASC LIMIT 1) ac ON TRUE",
    where.length?'WHERE '+where.join(' AND '):'',
    'GROUP BY 1,2,3,4,5,6,7,8,9',
    'ORDER BY is_test ASC, conversions DESC, currency ASC, country ASC, source ASC, campaign ASC',
    'LIMIT 2000'
  ].filter(Boolean).join('\n');
  return {text,params,filters:{from,to},dateBasis:'callback_received_at_utc'};
}
module.exports={buildQuery};
