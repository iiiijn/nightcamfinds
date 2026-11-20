'use strict';

const SOURCE_CHANNELS = Object.freeze([
  'organic_search', 'social_x', 'social_telegram', 'social_reddit',
  'social_facebook', 'social_instagram', 'social_other',
  'direct', 'email', 'partner', 'other', 'test'
]);

const SOURCE_ALIASES = Object.freeze({
  x: 'social_x', twitter: 'social_x', 't.co': 'social_x', 'twitter.com': 'social_x', 'x.com': 'social_x',
  telegram: 'social_telegram', tg: 'social_telegram', 't.me': 'social_telegram',
  'telegram.me': 'social_telegram', 'telegram.org': 'social_telegram',
  reddit: 'social_reddit', 'reddit.com': 'social_reddit', 'redd.it': 'social_reddit',
  facebook: 'social_facebook', fb: 'social_facebook', 'facebook.com': 'social_facebook', 'fb.com': 'social_facebook',
  instagram: 'social_instagram', ig: 'social_instagram', 'instagram.com': 'social_instagram',
  threads: 'social_other', 'threads.net': 'social_other', tiktok: 'social_other',
  'tiktok.com': 'social_other', youtube: 'social_other', 'youtube.com': 'social_other'
});

function normalizeSourceLabel(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const withoutScheme = raw.replace(/^https?:[/][/]/, '');
  const host = withoutScheme.split(/[/?#]/, 1)[0].replace(/^www[.]/, '');
  return host.replace(/[^a-z0-9._-]/g, '');
}

function classifySourceChannel(value, evidence = 'unknown') {
  const source = normalizeSourceLabel(value);
  if (String(evidence || '').toLowerCase() === 'legacy' && source === 'direct') return 'other';
  if (!source || source === 'unknown' || source === 'none' || source === 'direct') return 'direct';
  if (SOURCE_ALIASES[source]) return SOURCE_ALIASES[source];
  if (['organic_search', 'organic-search', 'google', 'bing', 'duckduckgo', 'yahoo', 'ecosia'].includes(source)) return 'organic_search';
  if (['email', 'newsletter', 'mailchimp', 'campaign_monitor'].includes(source)) return 'email';
  if (['partner', 'affiliate', 'referral_partner'].includes(source)) return 'partner';
  if (source === 'test' || source.startsWith('test_')) return 'test';
  return 'other';
}

function normalizeSpikeThreshold(value, fallback = 60) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 10 && parsed <= 10000 ? parsed : fallback;
}

function classifyClickEvidence({ isBot, botReason, visitClass } = {}) {
  if (isBot === true || botReason === 'known_bot_user_agent' || visitClass === 'known_bot') return 'known_bot';
  if (botReason === 'suspected_automation_user_agent' || visitClass === 'suspected_bot') return 'suspected_bot';
  if (visitClass === 'unverified') return 'unverified';
  return 'unclassified';
}

module.exports = { SOURCE_CHANNELS, SOURCE_ALIASES, normalizeSourceLabel, classifySourceChannel, normalizeSpikeThreshold, classifyClickEvidence };
