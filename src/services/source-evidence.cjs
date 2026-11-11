'use strict';

const SOURCE_EVIDENCE = Object.freeze([
  'url_parameter',
  'browser_referrer',
  'stored_attribution',
  'unknown'
]);

function normalizeSourceEvidence(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return SOURCE_EVIDENCE.includes(normalized) ? normalized : 'unknown';
}

module.exports = { SOURCE_EVIDENCE, normalizeSourceEvidence };
