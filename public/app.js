const grid = document.querySelector("#grid");
const loadMoreButton = document.querySelector("#load-more");
let currentOffset = 0;
const notice = document.querySelector("#notice");
const gate = document.querySelector("#gate");
const countEl = document.querySelector("#result-count");
const sort = document.querySelector("#sort");
const q = document.querySelector("#q");
const countrySelect = document.querySelector("#country");
const regionSelect = document.querySelector("#region");
const languageSelect = document.querySelector("#language");

let ageAccepted = false;
try { ageAccepted = localStorage.getItem("ncf18") === "1"; } catch (_) {}
if (ageAccepted && gate) gate.hidden = true;
document.querySelector("#enter")?.addEventListener("click", () => {
  try { localStorage.setItem("ncf18", "1"); } catch (_) {}
  document.documentElement.classList.add("ok");
  document.documentElement.classList.remove("age-pending");
  if (gate) gate.hidden = true;
});

const PAGES = {
  all: ["Independent discovery", "Discover live cams right now", "Explore live rooms, compare viewer counts, and open a room on Chaturbate or BongaCams. NightCamFinds does not stream video itself.", "NightCamFinds — Live cam directory"],
  live: ["Live now", "Rooms that are live now", "Currently online rooms from partner platforms. Counts and subjects come from the feed and can change every minute.", "Live cams now — NightCamFinds"],
  female: ["Female", "Find live female cams", "Browse public female rooms that are live now. Filter by country or viewer count, then continue to the room on its partner platform.", "Female live cams — NightCamFinds"],
  male: ["Male", "Find live male cams", "Browse public male rooms that are live now. Filter by country or viewer count, then continue to the room on its partner platform.", "Male live cams — NightCamFinds"],
  trans: ["Trans", "Find live trans cams", "Browse public trans rooms that are live now. Filter by country or viewer count, then continue to the room on its partner platform.", "Trans live cams — NightCamFinds"],
  couples: ["Couples", "Find live couples cams", "Browse public couples rooms that are live now. Filter by country or viewer count, then continue to the room on its partner platform.", "Couples live cams — NightCamFinds"],
  hd: ["HD", "Find HD live cams", "Browse rooms the feed marks as HD. Quality can change with the broadcaster's connection.", "HD live cams — NightCamFinds"],
  new: ["New", "Find new live broadcasters", "Browse rooms marked new in the live feed. Availability changes as broadcasters come online and offline.", "New live cams — NightCamFinds"],
  popular: ["Popular", "Find the most watched live rooms", "Browse rooms sorted by current viewer count and continue to the broadcaster's room on its partner platform.", "Popular live cams — NightCamFinds"],
  countries: ["Countries", "Live cams by country", "Pick a country to filter rooms that publish a country code. Not every room includes one.", "Live cams by country — NightCamFinds"]
};

const path = location.pathname.replaceAll("/", "") || "all";
const category = PAGES[path] ? path : "all";
const page = PAGES[category];
document.querySelector("#kicker").textContent = page[0];
document.querySelector("#page-title").textContent = page[1];
document.querySelector("#page-intro").textContent = page[2];
document.title = page[3];
document.querySelector('meta[name="description"]').setAttribute("content", page[2]);
document.querySelector('link[rel="canonical"]').href = location.origin + location.pathname;
if (category === "popular" || queryParams.get("sort") === "viewers") sort.value = "viewers";
document.querySelectorAll("nav a").forEach((a) => {
  if (a.getAttribute("href") === location.pathname) a.setAttribute("aria-current", "page");
});

const NAMES = {"US":"United States","CA":"Canada","GB":"United Kingdom","IE":"Ireland","AU":"Australia","NZ":"New Zealand","DE":"Germany","AT":"Austria","CH":"Switzerland","FR":"France","BE":"Belgium","NL":"Netherlands","LU":"Luxembourg","SE":"Sweden","NO":"Norway","DK":"Denmark","FI":"Finland","IS":"Iceland","JP":"Japan","SG":"Singapore","CZ":"Czechia","EE":"Estonia","IL":"Israel","IT":"Italy","SK":"Slovakia","RU":"Russia","SI":"Slovenia","PL":"Poland","LV":"Latvia","GR":"Greece","ES":"Spain","LT":"Lithuania","AE":"United Arab Emirates","RO":"Romania","HU":"Hungary","TR":"Turkey","CY":"Cyprus","BG":"Bulgaria","HR":"Croatia","PT":"Portugal","MK":"North Macedonia","ZA":"South Africa","BH":"Bahrain","JO":"Jordan","RS":"Serbia","AR":"Argentina","KZ":"Kazakhstan","UA":"Ukraine","BY":"Belarus","CN":"China","MX":"Mexico","MD":"Republic of Moldova","BA":"Bosnia and Herzegovina","BR":"Brazil","EG":"Egypt","IN":"India","CO":"Colombia","CL":"Chile","PE":"Peru","VE":"Venezuela","PH":"Philippines","TH":"Thailand","KE":"Kenya"};
const QUICK = ["US","GB","CA","IE","AU","NZ","DE","FR","NL","SE","NO","DK","FI","CH","AT","BE","LU","IS"];

const hinted = document.querySelector('meta[name="ncf-country"]')?.content || "";
const forced = document.querySelector('meta[name="ncf-force"]')?.content || "";
const queryParams = new URLSearchParams(location.search);
const campaignCountry = /^[a-z]{2}$/i.test(queryParams.get("ncf_country") || "") ? queryParams.get("ncf_country").toUpperCase() : "";
const campaignPlatform = ["chaturbate", "bongacams"].includes((queryParams.get("ncf_platform") || "").toLowerCase()) ? queryParams.get("ncf_platform").toLowerCase() : "";
const campaignCategory = ["all", "live", "female", "male", "trans", "couples", "hd", "new"].includes((queryParams.get("ncf_category") || "").toLowerCase()) ? queryParams.get("ncf_category").toLowerCase() : "";
const campaignPlacement = String(queryParams.get("ncf_placement") || "").trim().replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const initialFilters = { country: queryParams.get("country") || campaignCountry, region: queryParams.get("region") || "", language: queryParams.get("language") || "", q: queryParams.get("q") || "" };
let initialFiltersApplied = false;
if (initialFilters.q) q.value = initialFilters.q;
const incomingAttribution = {
  source: queryParams.get("utm_source") || queryParams.get("source") || "",
  medium: queryParams.get("utm_medium") || queryParams.get("medium") || "",
  campaign: queryParams.get("utm_campaign") || queryParams.get("campaign") || "",
  content: queryParams.get("utm_content") || queryParams.get("content") || ""
};
let referralSource = "";
try {
  const referrer = document.referrer ? new URL(document.referrer) : null;
  const normalizeReferralHost = (hostname) => String(hostname || "").toLowerCase().replace(/^www\./, "");
  const referrerHost = referrer ? normalizeReferralHost(referrer.hostname) : "";
  const currentHost = normalizeReferralHost(location.hostname);
  if (referrerHost && referrerHost !== currentHost) {
    referralSource = referrerHost.slice(0, 30);
  }
} catch (_) {}
const hasExplicitAttribution = Object.values(incomingAttribution).some((value) => String(value).trim() !== "");
const hasReferralAttribution = Boolean(referralSource) && !incomingAttribution.source.trim();
let savedAttribution = {};
try { savedAttribution = JSON.parse(localStorage.getItem("ncf_attribution") || "{}"); } catch (_) { savedAttribution = {}; }
if (hasExplicitAttribution || hasReferralAttribution) {
  savedAttribution = {
    source: incomingAttribution.source || (hasReferralAttribution ? referralSource : "unknown"),
    medium: incomingAttribution.medium || (hasReferralAttribution ? "referral" : "unknown"),
    campaign: incomingAttribution.campaign || (hasReferralAttribution ? "referral" : "unknown"),
    content: incomingAttribution.content || "",
    landingPath: location.pathname,
    savedAt: Date.now()
  };
  try { localStorage.setItem("ncf_attribution", JSON.stringify(savedAttribution)); } catch (_) {}
}
const attributionFresh = Number(savedAttribution.savedAt || 0) > Date.now() - 30 * 24 * 60 * 60 * 1000;
const trafficSource = String(incomingAttribution.source || (attributionFresh ? savedAttribution.source : "") || "unknown").slice(0, 30);
const trafficCampaign = String(incomingAttribution.campaign || (attributionFresh ? savedAttribution.campaign : "") || "unknown").slice(0, 40);
const trafficMedium = String(incomingAttribution.medium || (attributionFresh ? savedAttribution.medium : "") || "unknown").slice(0, 30);
const trafficContent = String(incomingAttribution.content || (attributionFresh ? savedAttribution.content : "") || "").slice(0, 40);

const paidCampaign = /^(paid|cpc|ppc|ad|ads)$/i.test(trafficMedium);
if (paidCampaign && category !== "all") {
  const market = forced || hinted;
  const marketName = NAMES[market] || "your market";
  const campaignTitle = {
    female: `Live female cams in ${marketName}`,
    male: `Live male cams in ${marketName}`,
    trans: `Live trans cams in ${marketName}`,
    couples: `Live couples cams in ${marketName}`
  }[category];
  if (campaignTitle) {
    document.querySelector("#page-title").textContent = campaignTitle;
    document.querySelector("#page-intro").textContent = `See who is live now, compare viewer counts, and choose a public room. Click a room to continue on its partner platform.`;
  }
}

const quick = document.querySelector("#quick");
for (const iso of QUICK) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost";
  button.textContent = NAMES[iso];
  button.addEventListener("click", () => {
    countrySelect.value = iso;
    load();
  });
  quick.append(button);
}

function placement() {
  if (campaignPlacement) return campaignPlacement;
  const country = countrySelect.value ? "country-" + countrySelect.value.toLowerCase() : "";
  const base = category === "all" ? "home" : category;
  return country || base + "-card";
}

function trafficVisitId() {
  try {
    let id = sessionStorage.getItem("ncf_visit_id");
    if (!/^[a-f0-9]{32}$/i.test(id || "")) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = [...bytes].map(x => x.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem("ncf_visit_id", id);
    }
    return id;
  } catch (_) { return ""; }
}
const visitId = trafficVisitId();
let visitLandingPath = location.pathname;
try { visitLandingPath = sessionStorage.getItem("ncf_landing_path") || location.pathname; sessionStorage.setItem("ncf_landing_path", visitLandingPath); } catch (_) {}
function sendEngagement(eventType) {
  if (!visitId) return;
  fetch("/api/engage", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitId, eventType, pagePath: location.pathname, landingPath: visitLandingPath,
      platform: "directory", source: trafficSource, medium: trafficMedium,
      campaign: trafficCampaign, content: trafficContent,
      placement: placement()
    })
  }).catch(() => {});
}
let activeTimer;
function scheduleActiveEngagement() {
  clearTimeout(activeTimer);
  if (!document.hidden) activeTimer = setTimeout(() => sendEngagement("active_10s"), 10000);
}
document.addEventListener("visibilitychange", scheduleActiveEngagement);
scheduleActiveEngagement();
let scrollQualified = false;
window.addEventListener("scroll", () => {
  if (scrollQualified) return;
  const height = document.documentElement.scrollHeight - window.innerHeight;
  if (height > 0 && window.scrollY / height >= 0.5) {
    scrollQualified = true;
    sendEngagement("scroll_50");
  }
}, { passive: true });
function trackingQuery(extra = {}) {
  const src = extra.src || placement();
  const params = new URLSearchParams({
    src,
    cat: extra.cat || (category === "all" ? "all" : category),
    source: trafficSource,
    medium: trafficMedium || "unknown",
    campaign: trafficCampaign,
    content: trafficContent || "",
    placement: extra.placement || placement(),
    lp: String(visitLandingPath || location.pathname || "/").slice(0, 255),
    vid: visitId
  });
  return params.toString();
}
function partners(rooms = []) {
  const src = category === "all" ? "home-footer" : category + "-footer";
  const wrap = document.querySelector("#partner-actions");
  if (!wrap) return;
  wrap.replaceChildren();
  const chaturbate = rooms.find((room) => room.platform === "chaturbate");
  if (chaturbate) {
    const cb = document.createElement("a");
    cb.className = "btn";
    cb.href = "/go/" + encodeURIComponent(chaturbate.id) + "?" + trackingQuery({ src: src + "-chaturbate", cat: chaturbate.gender || "all" });
    cb.textContent = "Open a Chaturbate room";
    cb.rel = "sponsored nofollow noopener";
    wrap.append(cb);
  }
  const bonga = rooms.find((room) => room.platform === "bongacams");
  if (bonga) {
    const bc = document.createElement("a");
    bc.className = "btn ghost";
    bc.href = "/bgo/" + encodeURIComponent(bonga.id) + "?" + trackingQuery({ src: src + "-bongacams", cat: bonga.gender || "all" });
    bc.textContent = "Open a BongaCams room";
    bc.rel = "sponsored nofollow noopener";
    wrap.append(bc);
  }
}

function card(room) {
  const isBonga = room.platform === "bongacams";
  const a = document.createElement("a");
  const redirect = isBonga ? "/bgo/" : "/go/";
  a.className = "card";
  a.href = redirect + encodeURIComponent(room.id) + "?" + trackingQuery({
    src: placement(),
    cat: room.gender || (category === "all" ? "all" : category)
  });
  a.rel = "sponsored nofollow noopener";
  const img = document.createElement(room.image ? "img" : "div");
  img.className = "thumb";
  if (room.image) {
    img.alt = room.displayName + " live room preview";
    img.src = room.image;
    img.loading = "lazy";
    img.onerror = () => {
      img.onerror = null;
      img.src = "/og.svg";
      img.classList.add("image-fallback");
      img.alt = "NightCamFinds room preview unavailable";
    };
  }
  const meta = document.createElement("div");
  meta.className = "meta";
  const badges = document.createElement("div");
  badges.className = "badges";
  const bits = [[isBonga ? "BongaCams" : "Chaturbate", "platform"], ["Live", "live"], room.isHd ? ["HD", ""] : null, room.isNew ? ["New", ""] : null, [Number(room.viewerCount || 0).toLocaleString() + " watching", ""], room.country ? [room.countryName || NAMES[room.country] || room.country, ""] : null].filter(Boolean);
  for (const [label, extra] of bits) {
    const span = document.createElement("span");
    span.className = extra ? "badge " + extra : "badge";
    if (extra === "platform") span.classList.add(isBonga ? "bongacams" : "chaturbate");
    span.textContent = label;
    badges.append(span);
  }
  const strong = document.createElement("strong");
  strong.textContent = room.displayName;
  const subject = document.createElement("p");
  subject.className = "muted subject";
  subject.textContent = room.roomSubject || "Live room";
  const cta = document.createElement("span");
  cta.className = "btn";
  cta.textContent = isBonga ? "Watch on BongaCams" : "Watch on Chaturbate";
  meta.append(badges, strong, subject, cta);
  a.append(img, meta);
  return a;
}

// Home sections are deliberately balanced between the two partner platforms.
// Target: 4 rooms per category, ideally 2 BongaCams + 2 Chaturbate.
// If one platform has fewer live rooms, fill the remaining slots from the other platform.
function pickHomeRooms(rooms, gender) {
  const matches = rooms.filter((room) => room.gender === gender);
  const bonga = matches.filter((room) => room.platform === "bongacams");
  const chaturbate = matches.filter((room) => room.platform === "chaturbate");
  const selected = [];
  const pairs = Math.max(Math.min(bonga.length, 2), Math.min(chaturbate.length, 2));
  for (let i = 0; i < 2; i++) {
    if (bonga[i]) selected.push(bonga[i]);
    if (chaturbate[i]) selected.push(chaturbate[i]);
  }

  if (selected.length < 4) {
    const selectedIds = new Set(selected.map((room) => room.id));
    for (const room of matches) {
      if (selected.length >= 4) break;
      if (selectedIds.has(room.id)) continue;
      selected.push(room);
      selectedIds.add(room.id);
    }
  }

  return selected.slice(0, 4);
}

// Category pages also use a balanced first block so one platform cannot occupy
// the entire visible section simply because it has a larger feed.
function balanceCategoryRooms(rooms) {
  const bonga = rooms.filter((room) => room.platform === "bongacams");
  const chaturbate = rooms.filter((room) => room.platform === "chaturbate");
  const mixed = [];
  const maxPairs = Math.max(bonga.length, chaturbate.length);
  for (let i = 0; i < maxPairs; i++) {
    if (bonga[i]) mixed.push(bonga[i]);
    if (chaturbate[i]) mixed.push(chaturbate[i]);
  }
  return mixed;
}

function renderRegionalSections(regionalRooms) {
  const featuredPanel = document.querySelector("#featured-room");
  const featuredWrap = document.querySelector(".featured-panel");
  const categoryRows = document.querySelector("#category-rows");
  if (!featuredPanel || !categoryRows) return;
  const groups = regionalRooms && typeof regionalRooms === "object" ? regionalRooms : {};
  const regions = Object.keys(groups);
  const homeLike = category === "all" || category === "live";
  const allRooms = regions.flatMap((region) => Array.isArray(groups[region]) ? groups[region] : []);
  const featuredRoom = [...allRooms].sort((a,b)=>Number(b.viewerCount||0)-Number(a.viewerCount||0))[0];
  featuredPanel.replaceChildren();
  categoryRows.replaceChildren();
  grid.hidden = true;
  if (featuredWrap) featuredWrap.hidden = !homeLike;
  if (homeLike) {
    if (featuredRoom) {
      const featured = card(featuredRoom);
      featured.classList.add("featured-card");
      featuredPanel.append(featured);
    } else {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No live rooms are available for this selection right now.";
      featuredPanel.append(empty);
    }
  }
  if (homeLike) {
    const topByCategory = window.__ncfTopChaturbateByCategory || {};
    for (const [gender, label] of [["female", "Female"], ["male", "Male"], ["trans", "Trans"], ["couples", "Couples"]]) {
      const rooms = Array.isArray(topByCategory[gender]) ? topByCategory[gender] : [];
      if (!rooms.length) continue;
      const section = document.createElement("section");
      section.className = "home-group global-chaturbate-group";
      const heading = document.createElement("h2");
      heading.className = "row-heading";
      const title = document.createElement("span");
      title.textContent = "Popular Chaturbate " + label + " Rooms";
      const count = document.createElement("small");
      count.textContent = "Top " + rooms.length + " worldwide by current viewers";
      const more = document.createElement("a");
      more.href = "/" + gender + "/?ncf_platform=chaturbate&sort=viewers";
      more.textContent = "See all";
      heading.append(title, count, more);
      const row = document.createElement("div");
      row.className = "category-row";
      row.append(...rooms.map(card));
      section.append(heading, row);
      categoryRows.append(section);
    }
  }
  for (const region of regions) {
    const rooms = Array.isArray(groups[region]) ? groups[region] : [];
    if (!rooms.length) continue;
    const section = document.createElement("section");
    section.className = "home-group regional-group";
    const heading = document.createElement("h2");
    heading.className = "row-heading";
    const title = document.createElement("span");
    title.textContent = homeLike ? region : page[0] + " in " + region;
    const count = document.createElement("small");
    count.textContent = rooms.length + " top rooms";
    const more = document.createElement("a");
    more.href = location.pathname + "?region=" + encodeURIComponent(region);
    more.textContent = "See all";
    heading.append(title, count, more);
    const row = document.createElement("div");
    row.className = "category-row";
    row.append(...rooms.map(card));
    section.append(heading, row);
    categoryRows.append(section);
  }
  if (!categoryRows.children.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No live rooms with verified regional information are available in this category right now.";
    categoryRows.append(empty);
  }
}

let timer;
function schedule() { clearTimeout(timer); timer = setTimeout(load, 250); }

async function load(offset = 0, append = false) {
  const params = new URLSearchParams({ category: campaignCategory || category, sort: sort.value, q: q.value, limit: "60", offset: String(offset) });
  if (campaignPlatform) params.set("platform", campaignPlatform);
  if (countrySelect.value) params.set("country", countrySelect.value);
  if (regionSelect.value) params.set("region", regionSelect.value);
  if (languageSelect.value) params.set("language", languageSelect.value);
  const data = await fetch("/api/rooms?" + params).then((r) => r.json());
  if (countrySelect.options.length === 1) {
    for (const iso of data.countries || []) {
      const opt = document.createElement("option");
      opt.value = iso;
      opt.textContent = NAMES[iso] || iso;
      countrySelect.append(opt);
    }
    // Only explicit country landing pages force a country filter. The homepage stays global by default.
    if (!countrySelect.value && forced && (data.countries || []).includes(forced)) countrySelect.value = forced;
    if (countrySelect.value) return load();
  }
  const syncOptions = (select, values, label) => {
    const selected = select.value;
    const available = [...new Set((values || []).filter(Boolean))];
    if (select !== regionSelect) available.sort((x, y) => x.localeCompare(y));
    select.replaceChildren(new Option(label, ""));
    for (const value of available) select.add(new Option(value, value));
    if (available.includes(selected)) select.value = selected;
  };
  syncOptions(regionSelect, data.regions, "All regions");
  syncOptions(languageSelect, data.languages, "All languages");
  if (!initialFiltersApplied) {
    if (initialFilters.country) {
      if (![...countrySelect.options].some(option => option.value === initialFilters.country)) countrySelect.add(new Option(NAMES[initialFilters.country] || initialFilters.country, initialFilters.country));
      countrySelect.value = initialFilters.country;
    }
    if (initialFilters.region && [...regionSelect.options].some(option => option.value === initialFilters.region)) regionSelect.value = initialFilters.region;
    if (initialFilters.language && [...languageSelect.options].some(option => option.value === initialFilters.language)) languageSelect.value = initialFilters.language;
    initialFiltersApplied = true;
    if (countrySelect.value || regionSelect.value || languageSelect.value || q.value) return load();
  }
  const rooms = data.rooms || [];
  window.__ncfTopChaturbateByCategory = data.topChaturbateByCategory || {};
  if (append) {
    const displayed = balanceCategoryRooms(rooms);
    grid.append(...displayed.map(card));
    currentOffset = offset + rooms.length;
    if (loadMoreButton) {
      loadMoreButton.hidden = !data.hasMore;
      loadMoreButton.disabled = false;
    }
    countEl.textContent = (data.liveCount || 0) + " live rooms · showing " + currentOffset;
    notice.hidden = !data.notice;
    notice.textContent = data.notice || "";
    return;
  }
  currentOffset = rooms.length;
  partners(rooms);
  const isUnfilteredRegionalView = ["all","live","female","male","trans","couples","hd","new","popular"].includes(category) &&
    !q.value && !countrySelect.value && !regionSelect.value && !languageSelect.value;
  const countryHint = document.querySelector("#country-hint");
  if (countryHint) {
    countryHint.textContent = countrySelect.value
      ? "Showing rooms with the partner-feed country code " + (NAMES[countrySelect.value] || countrySelect.value) + ". Country labels are not independently verified."
      : "Choose a country to filter available rooms. Country and language details come from partner feeds.";
  }
  if (isUnfilteredRegionalView) {
    renderRegionalSections(data.regionalRooms || {});
  } else {
    const featuredWrap = document.querySelector(".featured-panel");
    const categoryRows = document.querySelector("#category-rows");
    if (featuredWrap) featuredWrap.hidden = true;
    if (categoryRows) categoryRows.replaceChildren();
    grid.hidden = false;
    const displayed = balanceCategoryRooms(rooms);
    grid.replaceChildren(...displayed.map(card));
  }
  countEl.textContent = (data.liveCount ? data.liveCount + " live rooms" : "No rooms match that filter.") +
    (isUnfilteredRegionalView ? " across regions · top picks shown" : " · showing " + rooms.length) + " · updated " + new Date().toLocaleTimeString();
  if (loadMoreButton) {
    loadMoreButton.hidden = isUnfilteredRegionalView || !data.hasMore;
    loadMoreButton.disabled = false;
  }
  notice.hidden = !data.notice;
  notice.textContent = data.notice || "";
}

loadMoreButton?.addEventListener("click", () => {
  loadMoreButton.disabled = true;
  load(currentOffset, true).catch(() => {
    loadMoreButton.disabled = false;
    notice.hidden = false;
    notice.textContent = "Could not load more rooms. Please try again.";
  });
});

sort.addEventListener("change", load);
countrySelect.addEventListener("change", load);
regionSelect.addEventListener("change", load);
languageSelect.addEventListener("change", load);
q.addEventListener("input", schedule);
document.querySelector("#quick-exit")?.addEventListener("click", () => {
  location.replace("https://www.google.com");
});
load().catch(() => {
  notice.hidden = false;
  notice.textContent = "Could not load rooms. Please try again.";
});
setInterval(() => {
  if (document.hidden || q.value) return;
  load().catch(() => {});
}, 30000);
// NIGHTCAMFINDS_SEO_ATTRIBUTION_CLIENT_V2
// NIGHTCAMFINDS_SEO_ATTRIBUTION_CLIENT_V3
