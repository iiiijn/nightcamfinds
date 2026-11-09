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

  function getVisitId() {
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
    try { root.sessionStorage.setItem('ncf_visit_id', id); } catch (_) {}
    // A session cookie bridges pages when sessionStorage is unavailable.
    writeCookie('ncf_visit_id', id);
    return id;
  }

  function getLandingPath(pathname) {
    const fallback = String(pathname || '/');
    let value = '';
    try { value = root.sessionStorage.getItem('ncf_landing_path') || ''; } catch (_) {}
    if (!value) value = readCookie('ncf_landing_path');
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.length > 255 || /[\r\n]/.test(value)) value = fallback;
    try { root.sessionStorage.setItem('ncf_landing_path', value); } catch (_) {}
    writeCookie('ncf_landing_path', value);
    return value;
  }

  root.NCFVisitTracking = Object.freeze({ getVisitId, getLandingPath, validVisitId });
})(window);
