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

  function decorateAffiliateLink(anchor) {
    if (!isAffiliateLink(anchor)) return false;
    const visitId = getVisitId();
    if (!validVisitId(visitId)) return false;
    try {
      const rawHref = typeof anchor.getAttribute === 'function' ? anchor.getAttribute('href') : anchor.href;
      const target = new URL(rawHref || anchor.href, root.location.href);
      target.searchParams.set('vid', visitId);
      target.searchParams.set('lp', getLandingPath(root.location.pathname));
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

  function handleAffiliateClick(event) {
    const target = event && event.target;
    const anchor = target && typeof target.closest === 'function' ? target.closest('a[href]') : null;
    if (anchor) decorateAffiliateLink(anchor);
  }

  function getVisitId() {
    if (validVisitId(cachedVisitId)) return cachedVisitId;
    let id = '';
    try { id = root.sessionStorage.getItem('ncf_visit_id') || ''; } catch (_) {}
    if (!validVisitId(id)) {
      const cookieId = readCookie('ncf_visit_id');
      if (validVisitId(cookieId)) id = cookieId;
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
    try { root.sessionStorage.setItem('ncf_visit_id', id); } catch (_) {}
    // A session cookie bridges pages when sessionStorage is unavailable.
    writeCookie('ncf_visit_id', id);
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
