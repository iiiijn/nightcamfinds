'use strict';

const MACRO_PATTERN = "'^[{][A-Za-z][A-Za-z0-9_]*[}]$'";
const TYPED_FIELDS = [
  'conversion_type', 'currency', 'click_id', 'country', 'track', 'source',
  'campaign_id', 'program_name', 'device', 'language', 'referral', 'region'
];

function checkedAlias(alias) {
  const value = String(alias || 'cc');
  if (!/^[a-z][a-z0-9_]*$/i.test(value)) throw new TypeError('Invalid SQL table alias.');
  return value;
}

function typedMacroPredicate(alias = 'cc') {
  const table = checkedAlias(alias);
  return '(' + TYPED_FIELDS.map(field => "COALESCE(" + table + "." + field + ", '') ~ " + MACRO_PATTERN).join(' OR ') + ')';
}

function invalidCallbackPredicate(alias = 'cc') {
  const table = checkedAlias(alias);
  const raw = "EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(" + table + ".raw_payload, '{}'::jsonb)) AS payload(key, value) WHERE payload.value ~ " + MACRO_PATTERN + ')';
  return '(' + raw + ' OR ' + typedMacroPredicate(table) + ')';
}

module.exports = { invalidCallbackPredicate, typedMacroPredicate };
