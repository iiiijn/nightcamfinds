'use strict';

const DIRECT_LABEL = 'none';

function cleanLabel(value, fallback = 'unknown') {
  const cleaned = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 80);
  return cleaned || fallback;
}

/**
 * Keep absent campaign metadata explicit without inventing a marketing source.
 * "direct" means no source label was supplied; source_evidence remains unknown.
 */
function normalizeClickAttribution({ source, medium, campaign } = {}) {
  const normalizedSource = cleanLabel(source);
  const isUnattributed = normalizedSource === 'unknown';
  return {
    source: isUnattributed ? 'direct' : normalizedSource,
    medium: cleanLabel(medium, 'unknown') === 'unknown' && isUnattributed
      ? DIRECT_LABEL : cleanLabel(medium),
    campaign: cleanLabel(campaign, 'unknown') === 'unknown' && isUnattributed
      ? DIRECT_LABEL : cleanLabel(campaign)
  };
}

function resolvePageType(pathname) {
  const path = String(pathname || '/').split('?')[0].split('#')[0];
  if (path === '/') return 'home';
  if (/^\/country\/[a-z]{2}\/$/i.test(path)) return 'country';
  if (path === '/countries/' || path === '/countries') return 'countries';
  if (path === '/broadcast' || path === '/broadcast/') return 'broadcast';
  if (/^\/(live|female|male|trans|couples|hd|new|popular)\/$/.test(path)) return 'category';
  if (path === '/about' || path === '/affiliate-disclosure' || path === '/privacy' || path === '/terms' || path === '/contact') return 'content';
  return 'other';
}

module.exports = { normalizeClickAttribution, resolvePageType };
