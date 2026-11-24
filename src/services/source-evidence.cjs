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

function displaySource(source, evidence) {
  const normalizedSource = String(source || 'unknown').trim().toLowerCase() || 'unknown';
  const normalizedEvidence = String(evidence || 'legacy').trim().toLowerCase() || 'legacy';
  return normalizedEvidence === 'legacy' && normalizedSource === 'direct' ? 'unknown' : normalizedSource;
}

module.exports = { SOURCE_EVIDENCE, normalizeSourceEvidence, displaySource };
