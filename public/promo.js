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
    return {
      source: clean(url.get('utm_source') || url.get('source') || (fresh ? saved.source : ''), 'direct'),
      medium: clean(url.get('utm_medium') || url.get('medium') || (fresh ? saved.medium : ''), 'unknown'),
      campaign: clean(url.get('utm_campaign') || url.get('campaign') || (fresh ? saved.campaign : ''), 'organic')
    };
  }

  function trackUrl(room, placement) {
    const platform = room.platform === 'bongacams' ? 'bongacams' : 'chaturbate';
    const attr = getMarketingAttribution();
    const params = new URLSearchParams({
      src: `${platform}-${placement}`,
      cat: 'promo',
      source: attr.source,
      medium: attr.medium,
      campaign: attr.campaign,
      content: placement
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
    const market = tier1.has(metaCountry) ? `Popular with viewers in ${names[metaCountry] || 'your market'}` : 'Fresh rooms online now';
    title.innerHTML = `<span class="promo-dot"></span><strong>${label}</strong><span class="promo-sub">${market}</span>`;
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
      const viewers = Number(room.viewerCount || 0).toLocaleString();
      body.innerHTML = `<strong>${room.displayName || room.username}</strong><small>${viewers} watching · ${platform}</small>`;
      a.append(img, body);
      cards.append(a);
    }
    el.append(cards);
  }

  function renderBanner(config) {
    if (!banner || !config?.bannerUrl) return;
    banner.hidden = false;
    banner.innerHTML = '';
    const a = document.createElement('a');
    const attr = getMarketingAttribution();
    a.href = `/go/chaturbate:featured?src=chaturbate-banner&cat=promo&source=${encodeURIComponent(attr.source)}&medium=${encodeURIComponent(attr.medium)}&campaign=${encodeURIComponent(attr.campaign)}&content=banner`;
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

  async function loadConfig() {
    try {
      const response = await fetch('/promo-config.json', { cache: 'no-store' });
      if (!response.ok) return {};
      return await response.json();
    } catch (_) { return {}; }
  }

  Promise.allSettled([loadPlatform('chaturbate'), loadPlatform('bongacams'), loadConfig()]).then(results => {
    const cb = results[0].status === 'fulfilled' ? results[0].value : [];
    const bc = results[1].status === 'fulfilled' ? results[1].value : [];
    const config = results[2].status === 'fulfilled' ? results[2].value : {};

    if (config.chaturbate?.enabled !== false) renderStrip(cbPromo, cb, 'Live on Chaturbate', 'Chaturbate');
    if (config.bongacams?.enabled !== false) renderStrip(bcPromo, bc, 'Live on BongaCams', 'BongaCams');
    renderBanner(config.chaturbate);

    if (sticky) {
      const room = [...cb, ...bc].sort((a, b) => Number(b.viewerCount || 0) - Number(a.viewerCount || 0))[0];
      if (!room) return;
      sticky.innerHTML = '';
      const body = document.createElement('div');
      body.innerHTML = `<span class="promo-dot"></span><strong>${room.displayName || room.username} is live</strong><small>${Number(room.viewerCount || 0).toLocaleString()} watching on ${room.platformName || room.platform}</small>`;
      const link = document.createElement('a');
      link.className = 'btn';
      link.href = trackUrl(room, 'sticky');
      link.target = '_blank';
      link.rel = 'sponsored nofollow noopener';
      link.textContent = 'Watch live';
      sticky.append(body, link);
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
