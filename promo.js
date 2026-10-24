(() => {
  "use strict";

  const cbSlot = document.querySelector("#chaturbate-live-promo");
  const cbBanner = document.querySelector("#cb-banner-promo");
  const bongaSlot = document.querySelector("#bonga-live-promo");
  const sticky = document.querySelector("#stickyPromo");
  const visitorCountry = String(document.querySelector('meta[name="ncf-country"]')?.content || "").toUpperCase();

  const TIER1 = new Set(["AN","AT","AU","BE","CA","CH","DE","DK","FI","FK","FO","FR","GB","GG","GI","GL","IE","IS","JE","JP","LI","LU","NL","NO","NZ","QA","SE","SG","SM","UM","US","VI"]);
  const TIER2 = new Set(["AE","AW","BN","BR","BS","CY","ES","GQ","GR","HK","IL","IM","IT","KR","KW","KY","MO","PF","PR","PT","SI","VG"]);
  const TIER3 = new Set(["AG","AI","BB","BH","CK","CL","CZ","EE","GU","HR","HU","KN","LB","LT","LV","MP","MT","MX","NC","OM","PL","RU","SA","SC","SK","TR","TT","TW","UY","VE"]);
  const tier = TIER1.has(visitorCountry) ? "Tier 1" : TIER2.has(visitorCountry) ? "Tier 2" : TIER3.has(visitorCountry) ? "Tier 3" : "Other";

  const esc = value => String(value ?? "").replace(/[&<>\"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[char]));

  function trackUrl(room, placement) {
    const platform = room.platform === "bongacams" ? "bongacams" : "chaturbate";
    const params = new URLSearchParams({
      src: `promo-${platform}-${placement}-${tier.toLowerCase().replace(/\s+/g, "-")}`,
      cat: "promo",
      source: "website",
      medium: "promo",
      campaign: "live-promo",
      content: placement
    });
    return platform === "bongacams"
      ? `/bgo/${encodeURIComponent(room.id)}?${params.toString()}`
      : `/go/${encodeURIComponent(room.id)}?${params.toString()}`;
  }

  function tierBanner() {
    if (!cbBanner) return;
    const copy = tier === "Tier 1"
      ? "Popular live rooms for premium traffic markets"
      : tier === "Tier 2"
        ? "Popular live cams, fresh rooms and easy chat access"
        : tier === "Tier 3"
          ? "Live rooms across categories and countries"
          : "Browse live rooms by category and country";
    cbBanner.hidden = false;
    cbBanner.innerHTML = `<div class="promo-title"><span class="promo-dot"></span><strong>${copy}</strong><span class="promo-sub">18+ · updated live</span></div><div class="promo-actions"><a class="btn" href="/go/chaturbate:featured?src=cb-smart-banner&cat=promo&source=website&medium=promo&campaign=tier-smart-banner&content=${encodeURIComponent(tier.toLowerCase().replace(/\s+/g, "-"))}" target="_blank" rel="sponsored nofollow noopener">Browse live rooms</a><span class="promo-sub">${esc(visitorCountry || "Global")} · ${tier}</span></div>`;
  }

  function roomCard(room, placement) {
    const href = trackUrl(room, placement);
    const image = room.image || "/og.svg";
    const name = esc(room.displayName || room.username || "Live room");
    const viewers = Number(room.viewerCount || 0).toLocaleString();
    const platform = room.platform === "bongacams" ? "BongaCams" : "Chaturbate";
    const subject = esc(room.roomSubject || "Live now");
    return `<a class="promo-card" href="${href}" target="_blank" rel="sponsored nofollow noopener">
      <img src="${esc(image)}" alt="${name} live cam" loading="lazy" onerror="this.src='/og.svg'">
      <span><strong>${name}</strong><small>${viewers} watching · ${platform}</small><small>${subject}</small></span>
    </a>`;
  }

  function renderSlot(element, title, subtitle, rooms, placement) {
    if (!element) return;
    if (!rooms.length) {
      element.hidden = true;
      return;
    }
    element.hidden = false;
    element.innerHTML = `<div class="promo-title"><span class="promo-dot"></span><strong>${title}</strong><span class="promo-sub">${subtitle}</span></div><div class="promo-cards">${rooms.slice(0, 3).map(room => roomCard(room, placement)).join("")}</div>`;
  }

  function renderSticky(rooms) {
    if (!sticky || !rooms.length) return;
    const room = rooms[0];
    sticky.hidden = false;
    sticky.innerHTML = `<div><span class="promo-dot"></span><strong>${esc(room.displayName || room.username || "Live now")}</strong><small>${Number(room.viewerCount || 0).toLocaleString()} watching · ${room.platform === "bongacams" ? "BongaCams" : "Chaturbate"}</small></div><a class="btn" href="${trackUrl(room, "sticky")}" target="_blank" rel="sponsored nofollow noopener">Watch live</a>`;
  }

  async function loadPromos() {
    tierBanner();
    try {
      const response = await fetch("/api/rooms?category=all&sort=viewers&q=", {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Promo feed HTTP ${response.status}`);
      const data = await response.json();
      const rooms = Array.isArray(data.rooms) ? data.rooms : [];
      const chaturbate = rooms.filter(room => room.platform === "chaturbate");
      const bongacams = rooms.filter(room => room.platform === "bongacams");

      renderSlot(cbSlot, "Live on Chaturbate", "Fresh rooms online now", chaturbate, "chaturbate-live");
      renderSlot(bongaSlot, "Live on BongaCams", "Fresh rooms online now", bongacams, "bongacams-live");
      renderSticky([...chaturbate, ...bongacams]);
    } catch (error) {
      console.warn("NightCamFinds promo feed unavailable:", error.message);
      if (cbSlot) cbSlot.hidden = true;
      if (bongaSlot) bongaSlot.hidden = true;
      if (sticky) sticky.hidden = true;
    }
  }

  loadPromos();
})();
