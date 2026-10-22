(() => {
  const promo = document.querySelector('#bonga-live-promo');
  const sticky = document.querySelector('#stickyPromo');
  if (!promo && !sticky) return;

  const metaCountry = String(document.querySelector('meta[name="ncf-country"]')?.content || 'UNKNOWN').toUpperCase();
  const tier1 = new Set(['US','CA','GB','IE','AU','NZ','DE','FR','NL','SE','NO','DK','FI','CH','AT','BE']);
  const names = { US:'the US', CA:'Canada', GB:'the UK', IE:'Ireland', AU:'Australia', NZ:'New Zealand', DE:'Germany', FR:'France', NL:'the Netherlands', SE:'Sweden', NO:'Norway', DK:'Denmark', FI:'Finland', CH:'Switzerland', AT:'Austria', BE:'Belgium' };

  function trackUrl(room, placement) {
    const params = new URLSearchParams({
      src: `bongacams-${placement}`,
      cat: 'promo',
      source: 'website',
      medium: 'onsite',
      campaign: 'nightcamfinds-bonga'
    });
    return `/bgo/${encodeURIComponent(room.id)}?${params.toString()}`;
  }

  function render(rooms) {
    if (!rooms.length) return;
    if (promo) {
      promo.innerHTML = '';
      const title = document.createElement('div');
      title.className = 'promo-title';
      title.innerHTML = `<span class="promo-dot"></span><strong>Live on BongaCams</strong><span class="promo-sub">${tier1.has(metaCountry) ? `Popular with viewers in ${names[metaCountry] || 'your market'}` : 'Fresh rooms online now'}</span>`;
      promo.append(title);

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
        body.innerHTML = `<strong>${room.displayName || room.username}</strong><small>${Number(room.viewerCount || 0).toLocaleString()} watching</small>`;
        a.append(img, body);
        cards.append(a);
      }
      promo.append(cards);
    }

    if (sticky) {
      const room = rooms[0];
      sticky.innerHTML = `<div><span class="promo-dot"></span><strong>${room.displayName || room.username} is live</strong><small>${Number(room.viewerCount || 0).toLocaleString()} watching on BongaCams</small></div>`;
      const link = document.createElement('a');
      link.className = 'btn';
      link.href = trackUrl(room, 'sticky');
      link.target = '_blank';
      link.rel = 'sponsored nofollow noopener';
      link.textContent = 'Watch live';
      sticky.append(link);
      sticky.hidden = true;
    }
  }

  fetch('/api/rooms?platform=bongacams&sort=viewers', { headers: { Accept: 'application/json' } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('Bonga feed unavailable')))
    .then(data => render(Array.isArray(data.rooms) ? data.rooms : []))
    .catch(() => {});

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
