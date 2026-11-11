(() => {
  const cbPromo = document.querySelector('#chaturbate-live-promo');
  const cbCategoryPromo = document.querySelector('#chaturbate-category-promo');
  const bcPromo = document.querySelector('#bonga-live-promo');
  const banner = document.querySelector('#cb-banner-promo');
  const bongaDynamicBanner = document.querySelector('#bonga-dynamic-banner');
  const bongaStaticBanners = document.querySelector('#bonga-static-banners');
  const bongaCategoryWidget = document.querySelector('#bonga-category-widget');
  const sticky = document.querySelector('#stickyPromo');
  if (!cbPromo && !bcPromo && !banner && !sticky && !bongaCategoryWidget) return;

  const metaCountry = String(document.querySelector('meta[name="ncf-country"]')?.content || 'UNKNOWN').toUpperCase();
  const targetingParams = new URLSearchParams(location.search);
  const targetPlatform = String(targetingParams.get('ncf_platform') || 'all').toLowerCase();
  const targetCountry = String(targetingParams.get('ncf_country') || 'all').toUpperCase();
  const targetCategory = String(targetingParams.get('ncf_category') || location.pathname.split('/').filter(Boolean)[0] || 'all').toLowerCase();
  const campaignPlacement = String(targetingParams.get('ncf_placement') || '').toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 70);
  const validPlatforms = new Set(['all', 'chaturbate', 'bongacams']);
  const validCategories = new Set(['all', 'female', 'male', 'trans', 'couples', 'hd', 'new', 'popular']);
  const safeTargetPlatform = validPlatforms.has(targetPlatform) ? targetPlatform : 'all';
  const safeTargetCategory = validCategories.has(targetCategory) ? targetCategory : 'all';
  const audienceMatches = targetCountry === 'ALL' || !/^[A-Z]{2}$/.test(targetCountry) || targetCountry === metaCountry;
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
    const explicitContent = url.get('utm_content') || url.get('ncf_placement') || url.get('content') || '';
    const savedSource = fresh ? saved.source : '';
    const referralOnly = !explicitSource && !savedSource && Boolean(referral);
    const validEvidence = new Set(['url_parameter', 'browser_referrer', 'stored_attribution', 'unknown']);
    const suppliedEvidence = String(url.get('evidence') || '').trim().toLowerCase();
    const explicitEvidence = validEvidence.has(suppliedEvidence) ? suppliedEvidence : '';
    const source = explicitSource || savedSource || referral || 'unknown';
    const sourceEvidence = explicitEvidence || (explicitSource || explicitMedium || explicitCampaign || explicitContent ? 'url_parameter' : referralOnly ? 'browser_referrer' : fresh ? (validEvidence.has(saved.sourceEvidence) ? saved.sourceEvidence : 'stored_attribution') : 'unknown');
    const medium = explicitMedium || (fresh ? saved.medium : '') || (referralOnly ? 'referral' : 'unknown');
    const campaign = explicitCampaign || (fresh ? saved.campaign : '') || (referralOnly ? 'referral' : 'unknown');
    const attribution = {
      source: clean(source, 'unknown'),
      medium: clean(medium, 'unknown'),
      campaign: clean(campaign, 'unknown'),
      content: clean(explicitContent || (fresh ? saved.content : ''), ''),
      sourceEvidence,
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
  function recordEngagement(eventType, details = {}) {
    if (!currentVisitId) return;
    const attr = getMarketingAttribution();
    fetch('/api/engage', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: currentVisitId, eventType, pagePath: location.pathname, landingPath: originalLandingPath,
        platform: details.platform || 'directory', source: attr.source, medium: attr.medium,
        campaign: attr.campaign, content: details.content || attr.content, placement: details.placement || 'promo'
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
      cat: room.gender || (safeTargetCategory !== 'all' ? safeTargetCategory : 'promo'),
      source: attr.source,
      medium: attr.medium,
      campaign: attr.campaign,
      content: campaignPlacement ? `${campaignPlacement}:${placement}` : placement,
      evidence: attr.sourceEvidence,
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
      img.onerror = () => {
        img.onerror = null;
        img.src = '/og.svg';
        img.classList.add('image-fallback');
        img.alt = 'NightCamFinds room preview unavailable';
      };
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
    const platform = config?.platform || 'chaturbate';
    const room = (rooms || []).find((item) => item.platform === platform);
    if (!banner || config?.enabled === false || !config?.bannerUrl || !room) return;
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
    img.onerror = () => { banner.hidden = true; };
    a.append(img);
    banner.append(a);
  }

  function renderBongaStaticBanners(config) {
    if (!bongaStaticBanners || !Array.isArray(config?.staticBanners)) return;
    const active = config.staticBanners.filter(item => item?.enabled === true && item?.targetCategory === 'all');
    if (!active.length) return;
    bongaStaticBanners.replaceChildren();
    const heading = document.createElement('h2');
    heading.className = 'bonga-static-heading';
    heading.textContent = 'Featured BongaCams promotions';
    bongaStaticBanners.append(heading);
    for (const item of active) {
      let source;
      try {
        source = new URL(item.iframeUrl);
        if (source.protocol !== 'https:' || source.hostname !== 'bngprm.com' ||
            source.pathname !== '/promo.php' || source.searchParams.get('type') !== 'banner' ||
            source.searchParams.get('c') !== '840970' || source.searchParams.get('size') !== '300x250' ||
            source.searchParams.get('name') !== item.id || item.width !== 300 || item.height !== 250) continue;
      } catch (_) { continue; }
      const card = document.createElement('article');
      card.className = 'bonga-static-banner';
      const title = document.createElement('h3');
      title.textContent = item.label || 'BongaCams promotion';
      const frame = document.createElement('iframe');
      frame.width = '300';
      frame.height = '250';
      frame.loading = 'lazy';
      frame.scrolling = 'no';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.title = item.label || 'BongaCams promotional banner';
      frame.setAttribute('frameborder', '0');
      frame.src = source.toString();
      frame.addEventListener('load', () => {
        recordEngagement('bonga_static_banner_loaded', { platform: 'bongacams', placement: item.placement, content: item.id });
      }, { once: true });
      let viewableRecorded = false;
      let timer;
      if (typeof IntersectionObserver === 'function') {
        const observer = new IntersectionObserver(entries => {
          const entry = entries[0];
          if (entry?.isIntersecting && entry.intersectionRatio >= 0.5 && !viewableRecorded) {
            clearTimeout(timer);
            timer = setTimeout(() => {
              if (document.visibilityState === 'visible' && !viewableRecorded) {
                viewableRecorded = true;
                recordEngagement('bonga_static_banner_viewable', { platform: 'bongacams', placement: item.placement, content: item.id });
                observer.disconnect();
              }
            }, 1000);
          } else clearTimeout(timer);
        }, { threshold: [0, 0.5, 1] });
        frame.addEventListener('load', () => observer.observe(card), { once: true });
      }
      card.append(title, frame);
      bongaStaticBanners.append(card);
    }
    bongaStaticBanners.hidden = bongaStaticBanners.querySelectorAll('iframe').length === 0;
  }


  function renderBongaCategoryWidget(config) {
    if (!bongaCategoryWidget || config?.enabled === false || !config?.scriptUrl) return;
    let source;
    try {
      source = new URL(config.scriptUrl);
      if (source.protocol !== 'https:' || source.hostname !== 'bngprm.com' ||
          source.pathname !== '/promo.php' || source.searchParams.get('type') !== 'category_widget' ||
          source.searchParams.get('c') !== '840970' || source.searchParams.get('section') !== 'straight' ||
          source.searchParams.get('width') !== '200' || source.searchParams.get('layout') !== 'button1') return;
    } catch (_) { return; }
    bongaCategoryWidget.replaceChildren();
    const heading = document.createElement('h2');
    heading.className = 'bonga-category-widget-heading';
    heading.textContent = 'Browse BongaCams categories';
    const mount = document.createElement('div');
    mount.id = 'bc_cw';
    mount.className = 'bonga-category-widget-content';
    bongaCategoryWidget.append(heading, mount);
    let viewableRecorded = false;
    let viewableTimer;
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => {
          const entry = entries[0];
          if (entry?.isIntersecting && entry.intersectionRatio >= 0.5 && !viewableRecorded) {
            clearTimeout(viewableTimer);
            viewableTimer = setTimeout(() => {
              if (document.visibilityState === 'visible' && !viewableRecorded) {
                viewableRecorded = true;
                recordEngagement('bonga_category_widget_viewable', { platform: 'bongacams', placement: 'bongacash_category_widget', content: 'campaign_840970' });
                observer.disconnect();
              }
            }, 1000);
          } else clearTimeout(viewableTimer);
        }, { threshold: [0, 0.5, 1] })
      : null;
    if (observer) observer.observe(bongaCategoryWidget);
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = source.toString();
    script.addEventListener('load', () => {
      recordEngagement('bonga_category_widget_loaded', { platform: 'bongacams', placement: 'bongacash_category_widget', content: 'campaign_840970' });
    }, { once: true });
    script.addEventListener('error', () => {
      observer?.disconnect();
      bongaCategoryWidget.hidden = true;
    }, { once: true });
    mount.append(script);
    bongaCategoryWidget.hidden = false;
  }

  function renderBongaDynamicBanner(config) {
    if (!bongaDynamicBanner || config?.enabled === false || !config?.iframeUrl) return;
    // Accept only the exact provider-hosted HTTPS BongaCash dynamic-banner endpoint.
    let source;
    try {
      source = new URL(config.iframeUrl);
      if (source.protocol !== 'https:' || source.hostname !== 'bngdin.com' ||
          source.pathname !== '/promo.php' || source.searchParams.get('type') !== 'dynamic_banner' ||
          source.searchParams.get('c') !== '840970') return;
    } catch (_) { return; }
    // The supplied 160x650 creative is a desktop sidebar. Mobile visitors keep the responsive room strip.
    if (window.matchMedia?.('(max-width: 640px)').matches) return;
    bongaDynamicBanner.innerHTML = '';
    const heading = document.createElement('h2');
    heading.className = 'bonga-dynamic-title';
    heading.textContent = 'Live on BongaCams';
    const frame = document.createElement('iframe');
    frame.className = 'bonga-dynamic-frame';
    frame.width = '160';
    frame.height = '650';
    frame.src = source.toString();
    frame.title = 'BongaCams live models';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.scrolling = 'no';
    frame.setAttribute('frameborder', '0');
    let viewableRecorded = false;
    let viewableTimer;
    const visibilityObserver = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => {
          const entry = entries[0];
          if (!entry) return;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !viewableRecorded) {
            clearTimeout(viewableTimer);
            viewableTimer = setTimeout(() => {
              if (document.visibilityState === 'visible' && !viewableRecorded) {
                viewableRecorded = true;
                recordEngagement('bonga_banner_viewable', { platform: 'bongacams', placement: 'bongacash_dynamic_banner', content: 'campaign_840970' });
                visibilityObserver.disconnect();
              }
            }, 1000);
          } else {
            clearTimeout(viewableTimer);
          }
        }, { threshold: [0, 0.5, 1] })
      : null;
    frame.addEventListener('load', () => {
      // A load is an iframe-load signal, not proof of a human view or affiliate click.
      recordEngagement('bonga_banner_loaded', { platform: 'bongacams', placement: 'bongacash_dynamic_banner', content: 'campaign_840970' });
      if (visibilityObserver) visibilityObserver.observe(bongaDynamicBanner);
    }, { once: true });
    bongaDynamicBanner.replaceChildren(heading, frame);
    bongaDynamicBanner.hidden = false;
  }

  function renderChaturbateCategoryPromo() {
    if (!cbCategoryPromo) return;
    const categories = [
      { id: 'female', label: 'Female rooms' },
      { id: 'male', label: 'Male rooms' },
      { id: 'trans', label: 'Trans rooms' },
      { id: 'couples', label: 'Couples rooms' }
    ];
    cbCategoryPromo.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = 'Explore Chaturbate categories';
    const intro = document.createElement('p');
    intro.textContent = 'Choose a category to discover currently live public rooms.';
    const links = document.createElement('div');
    links.className = 'cb-category-links';
    for (const category of categories) {
      const link = document.createElement('a');
      link.className = 'cb-category-link';
      const params = new URLSearchParams({ ncf_platform: 'chaturbate', ncf_category: category.id, ncf_placement: 'cb-category-' + category.id });
      if (/^[A-Z]{2}$/.test(metaCountry)) params.set('ncf_country', metaCountry);
      link.href = '/'+category.id+'/?'+params.toString();
      link.rel = 'nofollow';
      const label = document.createElement('span');
      label.textContent = category.label;
      const arrow = document.createElement('span');
      arrow.textContent = 'Explore';
      link.append(label, arrow);
      link.addEventListener('click', () => recordEngagement('chaturbate_category_click', { platform: 'chaturbate', placement: 'cb_category_' + category.id, content: category.id }));
      links.append(link);
    }
    cbCategoryPromo.append(heading, intro, links);
    cbCategoryPromo.hidden = false;
    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
          recordEngagement('chaturbate_category_promo_viewable', { platform: 'chaturbate', placement: 'cb_category_promo', content: 'female_male_trans_couples' });
          observer.disconnect();
        }
      }, { threshold: [0.5] });
      observer.observe(cbCategoryPromo);
    }
  }

  async function loadPlatform(platform) {
    const params = new URLSearchParams({ platform, sort: 'viewers', limit: '60' });
    if (safeTargetCategory !== 'all') params.set('category', safeTargetCategory);
    const response = await fetch(`/api/rooms?${params.toString()}`, { headers: { Accept: 'application/json' } });
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

    if (!audienceMatches) {
      if (cbPromo) cbPromo.hidden = true;
      if (bcPromo) bcPromo.hidden = true;
      if (banner) banner.hidden = true;
      if (bongaDynamicBanner) bongaDynamicBanner.hidden = true;
      if (bongaStaticBanners) bongaStaticBanners.hidden = true;
    } else {
      if (cbPromo) cbPromo.hidden = safeTargetPlatform === 'bongacams';
      if (bcPromo) bcPromo.hidden = safeTargetPlatform === 'chaturbate';
      if (safeTargetPlatform !== 'bongacams' && config.chaturbate?.enabled !== false) {
        renderStrip(cbPromo, cb, 'Live on Chaturbate', 'Chaturbate');
        renderChaturbateCategoryPromo();
      }
      if (safeTargetPlatform !== 'chaturbate' && config.bongacams?.enabled !== false) renderStrip(bcPromo, bc, 'Live on BongaCams', 'BongaCams');
      if (safeTargetPlatform === 'bongacams') renderBanner({ ...config.bongacams, platform: 'bongacams' }, bc);
      else renderBanner({ ...config.chaturbate, platform: 'chaturbate' }, cb);
      if (safeTargetPlatform !== 'chaturbate' && config.bongacams?.enabled !== false) renderBongaDynamicBanner(config.bongacams);
      if (safeTargetPlatform !== 'chaturbate' && config.bongacams?.enabled !== false) renderBongaStaticBanners(config.bongacams);
      if (safeTargetPlatform !== 'chaturbate' && config.bongacams?.enabled !== false) renderBongaCategoryWidget(config.bongacams?.categoryWidget);
    }

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
    const hero = document.querySelector('.hero');
    const reveal = () => {
      if (shown || sticky.innerHTML.trim() === '') return;
      // Keep the fixed live-count promo out of the first-screen hero area.
      // Reveal it only after the visitor has scrolled past the full hero.
      const heroHasPassed = !hero || hero.getBoundingClientRect().bottom <= 0;
      if (heroHasPassed && window.scrollY > 100) {
        shown = true;
        sticky.hidden = false;
      }
    };
    window.addEventListener('scroll', reveal, { passive: true });
    reveal();
  }
})();
