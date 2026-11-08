const grid = document.querySelector("#grid");
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
if (category === "popular") sort.value = "viewers";
document.querySelectorAll("nav a").forEach((a) => {
  if (a.getAttribute("href") === location.pathname) a.setAttribute("aria-current", "page");
});

const NAMES = {"US":"United States","CA":"Canada","GB":"United Kingdom","IE":"Ireland","AU":"Australia","NZ":"New Zealand","DE":"Germany","AT":"Austria","CH":"Switzerland","FR":"France","BE":"Belgium","NL":"Netherlands","LU":"Luxembourg","SE":"Sweden","NO":"Norway","DK":"Denmark","FI":"Finland","IS":"Iceland","JP":"Japan","SG":"Singapore","CZ":"Czechia","EE":"Estonia","IL":"Israel","IT":"Italy","SK":"Slovakia","RU":"Russia","SI":"Slovenia","PL":"Poland","LV":"Latvia","GR":"Greece","ES":"Spain","LT":"Lithuania","AE":"United Arab Emirates","RO":"Romania","HU":"Hungary","TR":"Turkey","CY":"Cyprus","BG":"Bulgaria","HR":"Croatia","PT":"Portugal","MK":"North Macedonia","ZA":"South Africa","BH":"Bahrain","JO":"Jordan","RS":"Serbia","AR":"Argentina","KZ":"Kazakhstan","UA":"Ukraine","BY":"Belarus","CN":"China","MX":"Mexico","MD":"Republic of Moldova","BA":"Bosnia and Herzegovina","BR":"Brazil","EG":"Egypt","IN":"India","CO":"Colombia","CL":"Chile","PE":"Peru","VE":"Venezuela","PH":"Philippines","TH":"Thailand","KE":"Kenya"};
const QUICK = ["US","GB","CA","IE","AU","NZ","DE","FR","NL","SE","NO","DK","FI","CH","AT","BE","LU","IS"];

const hinted = document.querySelector('meta[name="ncf-country"]')?.content || "";
const forced = document.querySelector('meta[name="ncf-force"]')?.content || "";
const queryParams = new URLSearchParams(location.search);
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
      placement: category === "all" ? "home" : category
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
    placement: extra.placement || src,
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

function renderHomeSections(rooms) {
  const featuredPanel = document.querySelector("#featured-room");
  const featuredWrap = document.querySelector(".featured-panel");
  const categoryRows = document.querySelector("#category-rows");
  if (!featuredPanel || !categoryRows) return;

  const ranked = [...rooms].sort((a, b) => Number(b.viewerCount || 0) - Number(a.viewerCount || 0));
  const featuredRoom = ranked.find((room) => room.platform === "chaturbate") || ranked[0];
  featuredPanel.replaceChildren();
  categoryRows.replaceChildren();
  grid.hidden = true;
  featuredWrap.hidden = false;

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

  const groups = [["female", "Female"], ["male", "Male"], ["trans", "Trans"], ["couples", "Couples"]];
  for (const [key, label] of groups) {
    const matches = rooms.filter((room) => room.gender === key);
    if (!matches.length) continue;
    const section = document.createElement("section");
    section.className = "home-group";
    const heading = document.createElement("h2");
    heading.className = "row-heading";
    const title = document.createElement("span");
    title.textContent = label;
    const count = document.createElement("small");
    count.textContent = matches.length + " listed";
    const more = document.createElement("a");
    more.href = "/" + key + "/";
    more.textContent = "See all";
    heading.append(title, count, more);
    const row = document.createElement("div");
    row.className = "category-row";
    row.append(...pickHomeRooms(rooms, key).map(card));
    section.append(heading, row);
    categoryRows.append(section);
  }
  if (!categoryRows.children.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No live rooms match these filters right now.";
    categoryRows.append(empty);
  }
}

let timer;
function schedule() { clearTimeout(timer); timer = setTimeout(load, 250); }

async function load() {
  const params = new URLSearchParams({ category, sort: sort.value, q: q.value });
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
    if (!countrySelect.value && (forced || hinted) && (data.countries || []).includes(forced || hinted)) countrySelect.value = forced || hinted;
    if (countrySelect.value) return load();
  }
  const syncOptions = (select, values, label) => {
    const selected = select.value;
    const available = [...new Set((values || []).filter(Boolean))].sort((x, y) => x.localeCompare(y));
    select.replaceChildren(new Option(label, ""));
    for (const value of available) select.add(new Option(value, value));
    if (available.includes(selected)) select.value = selected;
  };
  syncOptions(regionSelect, data.regions, "All regions");
  syncOptions(languageSelect, data.languages, "All languages");
  const rooms = data.rooms || [];
  partners(rooms);
  const isUnfilteredHome = (category === "all" || category === "live") &&
    !q.value && !countrySelect.value && !regionSelect.value && !languageSelect.value;
  const countryHint = document.querySelector("#country-hint");
  if (countryHint) {
    countryHint.textContent = countrySelect.value
      ? "Showing rooms with the partner-feed country code " + (NAMES[countrySelect.value] || countrySelect.value) + ". Country labels are not independently verified."
      : "Choose a country to filter available rooms. Country and language details come from partner feeds.";
  }
  if (isUnfilteredHome) {
    renderHomeSections(rooms);
  } else {
    const featuredWrap = document.querySelector(".featured-panel");
    const categoryRows = document.querySelector("#category-rows");
    if (featuredWrap) featuredWrap.hidden = true;
    if (categoryRows) categoryRows.replaceChildren();
    grid.hidden = false;
    const displayed = balanceCategoryRooms(rooms);
    grid.replaceChildren(...displayed.map(card));
  }
  countEl.textContent = (rooms.length ? rooms.length + " live rooms" : "No rooms match that filter.") + " · updated " + new Date().toLocaleTimeString();
  notice.hidden = !data.notice;
  notice.textContent = data.notice || "";
}

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
