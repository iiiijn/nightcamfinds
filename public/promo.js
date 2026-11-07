(() => {
  const cbPromo = document.querySelector('#chaturbate-live-promo');
  const bcPromo = document.querySelector('#bonga-live-promo');
  const banner = document.querySelector('#cb-banner-promo');
  const sticky = document.querySelector('#stickyPromo');
  if (!cbPromo && !bcPromo && !banner && !sticky) return;

  const metaCountry = String(document.querySelector('meta[name="ncf-country"]')?.content || 'UNKNOWN').toUpperCase();
  const tier1 = new Set(['US','CA','GB','IE','AU','NZ','DE','FR','NL','SE','NO','DK','FI','CH','AT','BE']);
  const names = { US:'the US', CA:'Canada', GB:'the UK', IE:'Ireland', AU:'Australia', NZ:'New Zealand', DE:'Germany', FR:'France', NL:'the Netherlands', SE:'Sweden', NO:'Norway', DK:'Denmark', FI:'Finland', CH:'Switzerland', AT:'Austria', BE:'Belgium' };

  function getMarketingAttribution() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('ncf_attribution') || '{}'); } catch (_) {}
    const fresh = Number(saved.savedAt || 0) > Date.now() - 30 * 24 * 60 * 60 * 1000;
    const url = new URLSearchParams(location.search);
    const clean = (v, fallback) => String(v || fallback).toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || fallback;
    let referral = '';
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      const host = String(referrer?.hostname || '').toLowerCase().replace(/^www\./, '');
      const currentHost = String(location.hostname || '').toLowerCase().replace(/^www\./, '');
      if (host && host !== currentHost) referral = host;
    } catch (_) {}
    const explicitSource = url.get('utm_source') || url.get('source') || '';
    const explicitMedium = url.get('utm_medium') || url.get('medium') || '';
    const explicitCampaign = url.get('utm_campaign') || url.get('campaign') || '';
    const explicitContent = url.get('utm_content') || url.get('content') || '';
    const savedSource = fresh ? saved.source : '';
    const referralOnly = !explicitSource && !savedSource && Boolean(referral);
    const source = explicitSource || savedSource || referral || 'unknown';
    const medium = explicitMedium || (fresh ? saved.medium : '') || (referralOnly ? 'referral' : 'unknown');
    const campaign = explicitCampaign || (fresh ? saved.campaign : '') || (referralOnly ? 'referral' : 'unknown');
    const attribution = {
      source: clean(source, 'unknown'),
      medium: clean(medium, 'unknown'),
      campaign: clean(campaign, 'unknown'),
      content: clean(explicitContent || (fresh ? saved.content : ''), ''),
      landingPath: location.pathname,
      savedAt: Date.now()
    };
    if (referralOnly || explicitSource || explicitMedium || explicitCampaign || explicitContent) {
      try { localStorage.setItem('ncf_attribution', JSON.stringify(attribution)); } catch (_) {}
    }
    return attribution;
  }

  function visitId() {
    try {
      let id = sessionStorage.getItem('ncf_visit_id');
      if (!/^[a-f0-9]{32}$/i.test(id || '')) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        id = [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem('ncf_visit_id', id);
      }
      return id;
    } catch (_) { return ''; }
  }
  const currentVisitId = visitId();
  let originalLandingPath = location.pathname;
  try { originalLandingPath = sessionStorage.getItem("ncf_landing_path") || location.pathname; sessionStorage.setItem("ncf_landing_path", originalLandingPath); } catch (_) {}
  function recordEngagement(eventType) {
    if (!currentVisitId) return;
    const attr = getMarketingAttribution();
    fetch('/api/engage', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: currentVisitId, eventType, pagePath: location.pathname, landingPath: originalLandingPath,
        platform: 'directory', source: attr.source, medium: attr.medium,
        campaign: attr.campaign, placement: 'promo'
      })
    }).catch(() => {});
  }
  let engagementTimer;
  function scheduleEngagement() {
    clearTimeout(engagementTimer);
    if (!document.hidden) engagementTimer = setTimeout(() => recordEngagement('active_10s'), 10000);
  }
  document.addEventListener('visibilitychange', scheduleEngagement);
  scheduleEngagement();
  let scrolledEnough = false;
  window.addEventListener('scroll', () => {
    if (scrolledEnough) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max > 0 && window.scrollY / max >= 0.5) {
      scrolledEnough = true;
      recordEngagement('scroll_50');
    }
  }, { passive: true });

  function trackUrl(room, placement) {
    const platform = room.platform === 'bongacams' ? 'bongacams' : 'chaturbate';
    const attr = getMarketingAttribution();
    const params = new URLSearchParams({
      src: `${platform}-${placement}`,
      cat: 'promo',
      source: attr.source,
      medium: attr.medium,
      campaign: attr.campaign,
      content: placement,
      vid: currentVisitId,
      lp: originalLandingPath.slice(0, 255)
    });
    return platform === 'bongacams'
      ? `/bgo/${encodeURIComponent(room.id)}?${params.toString()}`
      : `/go/${encodeURIComponent(room.id)}?${params.toString()}`;
  }

  function renderStrip(el, rooms, label, platform) {
    if (!el || !rooms.length) return;
    el.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'promo-title';
    const market = 'Live rooms from partner feeds';
    const dot = document.createElement('span');
    dot.className = 'promo-dot';
    const titleText = document.createElement('strong');
    titleText.textContent = label;
    const subtitle = document.createElement('span');
    subtitle.className = 'promo-sub';
    subtitle.textContent = market;
    title.append(dot, titleText, subtitle);
    el.append(title);

    const cards = document.createElement('div');
    cards.className = 'promo-cards';
    for (const room of rooms.slice(0, 3)) {
      const a = document.createElement('a');
      a.className = 'promo-card';
      a.href = trackUrl(room, 'dynamic');
      a.target = '_blank';
      a.rel = 'sponsored nofollow noopener';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = `${room.displayName || room.username} live`;
      img.src = room.image || '/og.svg';
      const body = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = room.displayName || room.username;
      const detail = document.createElement('small');
      const viewers = Number(room.viewerCount || 0).toLocaleString();
      detail.textContent = `${viewers} watching · ${platform}`;
      body.append(name, detail);
      a.append(img, body);
      cards.append(a);
    }
    el.append(cards);
  }

  function renderBanner(config, rooms) {
    const room = (rooms || []).find((item) => item.platform === 'chaturbate');
    if (!banner || !config?.bannerUrl || !room) return;
    banner.hidden = false;
    banner.innerHTML = '';
    const a = document.createElement('a');
    a.href = trackUrl(room, 'banner');
    a.target = '_blank';
    a.rel = 'sponsored nofollow noopener';
    const img = document.createElement('img');
    img.src = config.bannerUrl;
    img.alt = config.bannerAlt || 'Chaturbate live cams';
    img.loading = 'lazy';
    a.append(img);
    banner.append(a);
  }

  async function loadPlatform(platform) {
    const response = await fetch(`/api/rooms?platform=${platform}&sort=viewers`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`${platform} feed unavailable`);
    const data = await response.json();
    return Array.isArray(data.rooms) ? data.rooms : [];
  }

  async function loadLiveCount() {
    const response = await fetch("/api/rooms?summary=1", { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("Live room count unavailable");
    const data = await response.json();
    return Number.isFinite(Number(data.liveCount)) ? Number(data.liveCount) : 0;
  }

  async function loadConfig() {
    try {
      const response = await fetch('/promo-config.json', { cache: 'no-store' });
      if (!response.ok) return {};
      return await response.json();
    } catch (_) { return {}; }
  }

  Promise.allSettled([loadPlatform('chaturbate'), loadPlatform('bongacams'), loadConfig(), loadLiveCount()]).then(results => {
    const cb = results[0].status === 'fulfilled' ? results[0].value : [];
    const bc = results[1].status === 'fulfilled' ? results[1].value : [];
    const config = results[2].status === 'fulfilled' ? results[2].value : {};
    const liveCount = results[3].status === 'fulfilled' ? results[3].value : null;

    if (config.chaturbate?.enabled !== false) renderStrip(cbPromo, cb, 'Live on Chaturbate', 'Chaturbate');
    // BongaCams room links stay hidden until the account-generated room deeplink format is verified.
    renderBanner(config.chaturbate, cb);

    if (sticky && liveCount !== null) {
      sticky.innerHTML = '';
      const body = document.createElement('div');
      const label = document.createElement('strong');
      label.textContent = `${liveCount.toLocaleString()} live rooms available`;
      const detail = document.createElement('small');
      detail.textContent = 'Across connected partner feeds. Availability changes.';
      body.append(label, detail);
      const link = document.createElement('a');
      link.className = 'btn';
      link.href = '#category-rows';
      link.textContent = 'Browse rooms';
      sticky.append(body, link);
      sticky.hidden = liveCount === 0;
    }
  });

  if (sticky) {
    let shown = false;
    const reveal = () => {
      if (shown || sticky.innerHTML.trim() === '') return;
      if (window.scrollY > Math.max(500, document.body.scrollHeight * 0.35)) {
        shown = true;
        sticky.hidden = false;
      }
    };
    window.addEventListener('scroll', reveal, { passive: true });
  }
})();
