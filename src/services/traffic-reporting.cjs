'use strict';

const SOURCE_CHANNELS = Object.freeze(['organic_search', 'direct', 'email', 'partner', 'test', 'other']);

function classifySourceChannel(value, evidence = 'unknown') {
  const source = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (String(evidence || '').toLowerCase() === 'legacy' && source === 'direct') return 'other';
  if (!source || source === 'unknown' || source === 'none' || source === 'direct') return 'direct';
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

module.exports = { SOURCE_CHANNELS, classifySourceChannel, normalizeSpikeThreshold, classifyClickEvidence };
