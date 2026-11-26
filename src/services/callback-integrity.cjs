'use strict';

const MACRO_PATTERN = "'^[{][A-Za-z][A-Za-z0-9_]*[}]$'";
const SUPPORTED_EVENT_TYPES = [
  'tokens_signup-referral', 'tokens_broadcaster-referral',
  'ppr_signup-referral', 'ppr_broadcaster-referral',
  'revshare_signup-referral', 'revshare_broadcaster-referral',
  'revshare_purchase', 'revshare_webmaster-commission', 'revshare_payout-adjustment'
];
const TYPED_FIELDS = [
  'conversion_type', 'currency', 'click_id', 'country', 'track', 'source',
  'campaign_id', 'program_name', 'device', 'language', 'referral', 'region'
];
function checkedAlias(alias) {
  const value = String(alias || 'cc');
  if (!/^[a-z][a-z0-9_]*$/i.test(value)) throw new TypeError('Invalid SQL table alias.');
  return value;
}
function unresolvedMacroPredicate(alias = 'cc') {
  const table = checkedAlias(alias);
  const raw = "EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(" + table + ".raw_payload, '{}'::jsonb)) AS payload(key, value) WHERE payload.value ~ " + MACRO_PATTERN + ')';
  const typed = '(' + TYPED_FIELDS.map(field => "COALESCE(" + table + "." + field + ", '') ~ " + MACRO_PATTERN).join(' OR ') + ')';
  return '(' + raw + ' OR ' + typed + ')';
}
function unsupportedEventTypePredicate(alias = 'cc') {
  const table = checkedAlias(alias);
  const types = SUPPORTED_EVENT_TYPES.map(type => "'" + type + "'").join(', ');
  return "LOWER(BTRIM(COALESCE(" + table + ".conversion_type, ''))) NOT IN (" + types + ')';
}
function invalidCallbackPredicate(alias = 'cc') {
  const table = checkedAlias(alias);
  return '(' + unresolvedMacroPredicate(table) + ' OR ' + unsupportedEventTypePredicate(table) + ')';
}
module.exports = { SUPPORTED_EVENT_TYPES, unresolvedMacroPredicate, unsupportedEventTypePredicate, invalidCallbackPredicate };
