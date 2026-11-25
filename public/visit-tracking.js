'use strict';

(function attachVisitTracking(root) {
  function validVisitId(value) {
    return /^[a-f0-9]{32}$/i.test(String(value || ''));
  }

  function readCookie(name) {
    try {
      const prefix = name + '=';
      const entry = root.document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
      return entry ? decodeURIComponent(entry.slice(prefix.length)) : '';
    } catch (_) {
      return '';
    }
  }

  function writeCookie(name, value) {
    try {
      const secure = root.location && root.location.protocol === 'https:' ? '; Secure' : '';
      root.document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; SameSite=Lax' + secure;
    } catch (_) {}
  }

  let cachedVisitId = '';
  let cachedLandingPath = '';

  function isAffiliateLink(anchor) {
    if (!anchor) return false;
    try {
      const rawHref = typeof anchor.getAttribute === 'function' ? anchor.getAttribute('href') : anchor.href;
      const target = new URL(rawHref || anchor.href, root.location.href);
      return target.origin === root.location.origin && /^\/(?:go|bgo)\//i.test(target.pathname);
    } catch (_) {
      return false;
    }
  }

  function readAttribution() {
    try {
      const saved = JSON.parse(root.localStorage.getItem('ncf_attribution') || '{}');
      if (!saved || typeof saved !== 'object' || Number(saved.savedAt || 0) <= Date.now() - 30 * 24 * 60 * 60 * 1000) return {};
      return {
        source: String(saved.source || '').slice(0, 30),
        medium: String(saved.medium || '').slice(0, 30),
        campaign: String(saved.campaign || '').slice(0, 40),
        content: String(saved.content || '').slice(0, 40)
      };
    } catch (_) {
      return {};
    }
  }

  function decorateAffiliateLink(anchor) {
    if (!isAffiliateLink(anchor)) return false;
    const visitId = getVisitId();
    if (!validVisitId(visitId)) return false;
    try {
      const rawHref = typeof anchor.getAttribute === 'function' ? anchor.getAttribute('href') : anchor.href;
      const target = new URL(rawHref || anchor.href, root.location.href);
      target.searchParams.set('vid', visitId);
      target.searchParams.set('lp', getLandingPath(root.location.pathname));
      const attribution = readAttribution();
      for (const key of ['source', 'medium', 'campaign', 'content']) {
        if (attribution[key] && !target.searchParams.has(key) && !target.searchParams.has('utm_' + key)) {
          target.searchParams.set(key, attribution[key]);
        }
      }
      anchor.href = target.pathname + target.search + target.hash;
      return true;
    } catch (_) {
      return false;
    }
  }

  function decorateAffiliateLinks(node) {
    if (!node) return;
    if (typeof node.matches === 'function' && node.matches('a[href]')) decorateAffiliateLink(node);
    if (typeof node.querySelectorAll === 'function') {
      for (const anchor of node.querySelectorAll('a[href]')) decorateAffiliateLink(anchor);
    }
  }

  const GA4_MEASUREMENT_ID = 'G-W0HBR8LBKQ';
  const GA4_CONSENT_KEY = 'ncf_ga4_analytics_consent';

  function hasAnalyticsConsent() {
    try { return root.localStorage.getItem(GA4_CONSENT_KEY) === 'granted'; } catch (_) { return false; }
  }

  function sendGa4Event(name, params) {
    if (!hasAnalyticsConsent() || typeof root.gtag !== 'function') return;
    root.gtag('event', name, params);
  }

  function initializeGa4() {
    if (!hasAnalyticsConsent() || root.__NCF_GA4_INITIALIZED__) return;
    root.__NCF_GA4_INITIALIZED__ = true;
    root.dataLayer = root.dataLayer || [];
    root.gtag = function gtag() { root.dataLayer.push(arguments); };
    root.gtag('js', new Date());
    root.gtag('consent', 'update', { analytics_storage: 'granted' });
    const script = root.document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_MEASUREMENT_ID);
    root.document.head.appendChild(script);
    root.gtag('config', GA4_MEASUREMENT_ID, {
      page_location: root.location.origin + root.location.pathname,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  }

  function showAnalyticsConsent() {
    if (hasAnalyticsConsent()) {
      initializeGa4();
      return;
    }
    let choice = '';
    try { choice = root.localStorage.getItem(GA4_CONSENT_KEY) || ''; } catch (_) {}
    if (choice === 'denied' || root.document.getElementById('ncf-analytics-consent')) return;
    const panel = root.document.createElement('aside');
    panel.id = 'ncf-analytics-consent';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Analytics preferences');
    panel.style.cssText = 'position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;max-width:620px;margin:0 auto;padding:16px;background:#171923;color:#fff;border:1px solid #596174;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.35);font:14px/1.5 system-ui,sans-serif';
    const message = root.document.createElement('p');
    message.textContent = 'NightCamFinds uses optional Google Analytics to understand site visits and improve the directory. Analytics is disabled unless you choose to allow it. Do not include personal or sensitive information in analytics.';
    message.style.margin = '0 0 12px';
    const actions = root.document.createElement('div');
    actions.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
    const makeButton = (label, value) => {
      const button = root.document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.cssText = 'padding:9px 13px;border:1px solid #aab2c2;border-radius:7px;background:#2b3345;color:#fff;cursor:pointer';
      button.addEventListener('click', () => {
        try { root.localStorage.setItem(GA4_CONSENT_KEY, value); } catch (_) {}
        panel.remove();
        if (value === 'granted') initializeGa4();
      });
      return button;
    };
    actions.appendChild(makeButton('Allow analytics', 'granted'));
    actions.appendChild(makeButton('Reject optional analytics', 'denied'));
    panel.appendChild(message);
    panel.appendChild(actions);
    root.document.body.appendChild(panel);
  }

  function addAnalyticsPreferencesLink() {
    const footer = root.document.querySelector('footer');
    if (!footer || footer.querySelector('[data-ncf-analytics-preferences]')) return;
    const link = root.document.createElement('a');
    link.href = '#analytics-preferences';
    link.textContent = 'Analytics preferences';
    link.setAttribute('data-ncf-analytics-preferences', 'true');
    link.addEventListener('click', (event) => {
      event.preventDefault();
      try { root.localStorage.removeItem(GA4_CONSENT_KEY); } catch (_) {}
      root.document.getElementById('ncf-analytics-consent')?.remove();
      showAnalyticsConsent();
    });
    footer.appendChild(link);
  }

  function handleAffiliateClick(event) {
    const target = event && event.target;
    const anchor = target && typeof target.closest === 'function' ? target.closest('a[href]') : null;
    if (!anchor || !isAffiliateLink(anchor)) return;
    decorateAffiliateLink(anchor);
    let platform = 'unknown';
    try {
      const url = new URL(anchor.getAttribute('href') || anchor.href, root.location.href);
      platform = /^\/bgo\//i.test(url.pathname) ? 'bongacams' : /^\/go\//i.test(url.pathname) ? 'chaturbate' : 'unknown';
    } catch (_) {}
    sendGa4Event('affiliate_link_click', {
      affiliate_platform: platform,
      page_path: root.location.pathname,
      landing_page_path: getLandingPath(root.location.pathname),
      link_path: (() => { try { return new URL(anchor.href, root.location.href).pathname; } catch (_) { return ''; } })(),
      transport_type: 'beacon'
    });
  }

  function incomingCampaignKey() {
    try {
      const params = new URLSearchParams(root.location.search || '');
      const values = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map((key) =>
        String(params.get(key) || '').trim().toLowerCase()
      );
      if (!values.some(Boolean)) return '';
      return values.join('|').slice(0, 180);
    } catch (_) {
      return '';
    }
  }

  function getVisitId() {
    const campaignKey = incomingCampaignKey();
    let previousCampaignKey = '';
    try { previousCampaignKey = root.sessionStorage.getItem('ncf_visit_campaign_key') || ''; } catch (_) {}
    if (!previousCampaignKey) previousCampaignKey = readCookie('ncf_visit_campaign_key');
    const newCampaignEntry = Boolean(campaignKey && campaignKey !== previousCampaignKey);
    if (newCampaignEntry) {
      cachedVisitId = '';
      cachedLandingPath = '';
    }
    if (validVisitId(cachedVisitId) && !newCampaignEntry) return cachedVisitId;
    let id = '';
    if (!newCampaignEntry) {
      try { id = root.sessionStorage.getItem('ncf_visit_id') || ''; } catch (_) {}
      if (!validVisitId(id)) {
        const cookieId = readCookie('ncf_visit_id');
        if (validVisitId(cookieId)) id = cookieId;
      }
    }
    if (!validVisitId(id)) {
      try {
        const bytes = new Uint8Array(16);
        root.crypto.getRandomValues(bytes);
        id = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
      } catch (_) {
        return '';
      }
    }
    cachedVisitId = id;
    try {
      root.sessionStorage.setItem('ncf_visit_id', id);
      if (campaignKey) root.sessionStorage.setItem('ncf_visit_campaign_key', campaignKey);
    } catch (_) {}
    // First-party session cookies bridge browsers where sessionStorage is unavailable.
    writeCookie('ncf_visit_id', id);
    if (campaignKey) writeCookie('ncf_visit_campaign_key', campaignKey);
    if (newCampaignEntry) {
      try { root.sessionStorage.setItem('ncf_landing_path', root.location.pathname || '/'); } catch (_) {}
      writeCookie('ncf_landing_path', root.location.pathname || '/');
    }
    return id;
  }

  function getLandingPath(pathname) {
    if (cachedLandingPath) return cachedLandingPath;
    const fallback = String(pathname || '/');
    let value = '';
    try { value = root.sessionStorage.getItem('ncf_landing_path') || ''; } catch (_) {}
    if (!value) value = readCookie('ncf_landing_path');
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.length > 255 || /[\r\n]/.test(value)) value = fallback;
    cachedLandingPath = value;
    try { root.sessionStorage.setItem('ncf_landing_path', value); } catch (_) {}
    writeCookie('ncf_landing_path', value);
    return value;
  }

  root.NCFVisitTracking = Object.freeze({ getVisitId, getLandingPath, validVisitId, decorateAffiliateLink });

  // GA4 is optional and starts only after an explicit analytics opt-in.
  showAnalyticsConsent();
  addAnalyticsPreferencesLink();

  // Server-rendered links may be clicked before the directory API replaces them.
  // Decorate existing links immediately and catch all future clicks in capture phase.
  decorateAffiliateLinks(root.document);
  root.document.addEventListener('click', handleAffiliateClick, true);

  // Keep links created by dynamic room cards and widgets ready for copy/open actions too.
  if (root.MutationObserver && root.document.documentElement) {
    const observer = new root.MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes || []) decorateAffiliateLinks(node);
      }
    });
    observer.observe(root.document.documentElement, { childList: true, subtree: true });
  }
})(window);
