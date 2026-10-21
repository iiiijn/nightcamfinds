const grid = document.querySelector("#grid");
const notice = document.querySelector("#notice");
const gate = document.querySelector("#gate");
const countEl = document.querySelector("#result-count");
const sort = document.querySelector("#sort");
const q = document.querySelector("#q");
const countrySelect = document.querySelector("#country");

if (localStorage.getItem("ncf18") === "1" && gate) gate.hidden = true;
document.querySelector("#enter")?.addEventListener("click", () => { localStorage.setItem("ncf18", "1"); document.documentElement.classList.add("ok"); if (gate) gate.hidden = true; });

const PAGES = {
  all: ["Independent discovery", "Find live cams worth clicking", "Browse live rooms from Chaturbate and BongaCams. Open a room on the partner site to watch and chat.", "NightCamFinds — Live cams now"],
  live: ["Live now", "Rooms that are live now", "Currently online rooms from the partner feeds. Viewer counts and subjects can change quickly.", "Live cams now — NightCamFinds"],
  female: ["Female", "Female live cams", "Browse live female rooms and continue to the partner site when you find one you like.", "Female live cams — NightCamFinds"],
  male: ["Male", "Male live cams", "Browse live male rooms from the partner feeds.", "Male live cams — NightCamFinds"],
  trans: ["Trans", "Trans live cams", "Browse live trans rooms from the partner feeds.", "Trans live cams — NightCamFinds"],
  couples: ["Couples", "Couple live cams", "Browse live couple rooms from the partner feeds.", "Couple live cams — NightCamFinds"],
  hd: ["HD", "HD live cams", "Browse rooms marked HD by the partner feeds.", "HD live cams — NightCamFinds"],
  new: ["New", "New broadcasters", "Browse rooms marked new in the current feeds.", "New live cams — NightCamFinds"],
  popular: ["Popular", "Most watched rooms", "Start with rooms that currently have the most viewers.", "Popular live cams — NightCamFinds"],
  countries: ["Countries", "Live cams by country", "Choose a country to focus your browsing and paid-traffic tests.", "Live cams by country — NightCamFinds"]
};

const pathName = location.pathname.replaceAll("/", "") || "all";
const category = PAGES[pathName] ? pathName : "all";
const page = PAGES[category];
const incoming = new URLSearchParams(location.search);
const trafficSource = incoming.get("utm_source") || incoming.get("source") || "direct";
const trafficCampaign = incoming.get("utm_campaign") || incoming.get("campaign") || "organic";
const NAMES = { US:"United States", CA:"Canada", GB:"United Kingdom", IE:"Ireland", AU:"Australia", NZ:"New Zealand", DE:"Germany", AT:"Austria", CH:"Switzerland", FR:"France", BE:"Belgium", NL:"Netherlands", LU:"Luxembourg", SE:"Sweden", NO:"Norway", DK:"Denmark", FI:"Finland", IS:"Iceland", JP:"Japan", SG:"Singapore" };
const QUICK = ["US","GB","CA","AU","DE","FR","NL"];

document.querySelector("#kicker").textContent = page[0];
document.querySelector("#page-title").textContent = page[1];
document.querySelector("#page-intro").textContent = page[2];
document.title = page[3];
document.querySelector('meta[name="description"]')?.setAttribute("content", page[2]);
document.querySelector('link[rel="canonical"]')?.setAttribute("href", location.origin + location.pathname);
if (category === "popular") sort.value = "viewers";
document.querySelectorAll("nav a").forEach(a => { if (a.getAttribute("href") === location.pathname) a.setAttribute("aria-current", "page"); });

const quick = document.querySelector("#quick");
for (const iso of QUICK) {
  const button = document.createElement("button");
  button.type = "button"; button.className = "ghost"; button.textContent = NAMES[iso];
  button.addEventListener("click", () => { countrySelect.value = iso; load(); document.querySelector("#rooms")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  quick?.append(button);
}

function cleanTrack(value, fallback) { return String(value || fallback).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || fallback; }
function trackingParams(room, placement = "card") {
  const platform = room?.platform || "mixed";
  const country = countrySelect.value ? countrySelect.value.toLowerCase() : "all";
  const base = category === "all" ? "home" : category;
  const src = cleanTrack(`${trafficSource}-${platform}-${base}-${country}-${placement}`, `ncf-${platform}`);
  return new URLSearchParams({ src, cat: category, source: cleanTrack(trafficSource, "direct"), campaign: cleanTrack(trafficCampaign, "organic") });
}
function goUrl(room, placement = "card") {
  const params = trackingParams(room, placement);
  if (room.platform === "bongacams") return `/bgo/${encodeURIComponent(room.id)}?${params.toString()}`;
  return `/go/${encodeURIComponent(room.id)}?${params.toString()}`;
}
function partners() {
  const wrap = document.querySelector("#partner-actions"); if (!wrap) return; wrap.innerHTML = "";
  const cb = document.createElement("a"); cb.className = "btn"; cb.href = goUrl({ id: "chaturbate:featured", platform: "chaturbate" }, "footer"); cb.textContent = "Browse Chaturbate"; cb.target = "_blank"; cb.rel = "sponsored nofollow noopener";
  const bc = document.createElement("a"); bc.className = "btn ghost"; bc.href = goUrl({ id: "bongacams:featured", platform: "bongacams" }, "footer"); bc.textContent = "Browse BongaCams"; bc.target = "_blank"; bc.rel = "sponsored nofollow noopener";
  wrap.append(cb, bc);
}
function badge(text, live = false) { const span = document.createElement("span"); span.className = `badge${live ? " live" : ""}`; span.textContent = text; return span; }
function card(room) {
  const a = document.createElement("a"); a.className = "card"; a.href = goUrl(room); a.target = "_blank"; a.rel = "sponsored nofollow noopener";
  const img = document.createElement("img"); img.className = "thumb"; img.loading = "lazy"; img.alt = `${room.displayName} live cam`; img.src = room.image || "/og.svg"; img.addEventListener("error", () => { img.src = "/og.svg"; }, { once: true });
  const meta = document.createElement("div"); meta.className = "meta";
  const badges = document.createElement("div"); badges.className = "badges"; badges.append(badge("LIVE", true), badge(room.platformName || room.platform)); if (room.isHd) badges.append(badge("HD")); if (room.isNew) badges.append(badge("NEW")); if (room.countryName) badges.append(badge(room.countryName));
  const title = document.createElement("strong"); title.textContent = room.displayName || room.username;
  const subject = document.createElement("p"); subject.className = "subject"; subject.textContent = room.roomSubject || "Live now";
  const viewers = document.createElement("span"); viewers.className = "muted"; viewers.textContent = `${Number(room.viewerCount || 0).toLocaleString()} viewers`;
  meta.append(badges, title, subject, viewers); a.append(img, meta); return a;
}
function populateCountries(countries) {
  const current = countrySelect.value; const seen = new Set([...countrySelect.options].map(o => o.value));
  for (const iso of countries) { if (seen.has(iso)) continue; const option = document.createElement("option"); option.value = iso; option.textContent = NAMES[iso] || iso; countrySelect.append(option); }
  if (current) countrySelect.value = current;
}

let loading = false;
async function load() {
  if (loading) return; loading = true;
  try {
    const params = new URLSearchParams({ category, sort: sort.value, q: q.value.trim() });
    if (countrySelect.value) params.set("country", countrySelect.value);
    const response = await fetch(`/api/rooms?${params.toString()}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    let rooms = Array.isArray(data.rooms) ? data.rooms : [];
    if (["female","male","trans","couples"].includes(category)) rooms = rooms.filter(r => r.gender === category);
    if (category === "hd") rooms = rooms.filter(r => r.isHd);
    if (category === "new") rooms = rooms.filter(r => r.isNew);
    if (countrySelect.value) rooms = rooms.filter(r => r.country === countrySelect.value);
    if (q.value.trim()) { const term = q.value.trim().toLowerCase(); rooms = rooms.filter(r => `${r.displayName} ${r.roomSubject} ${r.country} ${r.platformName}`.toLowerCase().includes(term)); }
    if (sort.value === "viewers" || sort.value === "recommended") rooms.sort((a,b) => Number(b.viewerCount || 0) - Number(a.viewerCount || 0));
    if (sort.value === "newest") rooms.sort((a,b) => Number(b.isNew) - Number(a.isNew) || Number(b.viewerCount || 0) - Number(a.viewerCount || 0));

    populateCountries(data.countries || []);
    grid.innerHTML = "";
    for (const room of rooms.slice(0, 60)) grid.append(card(room));
    const platformText = [...new Set(rooms.map(r => r.platform).filter(Boolean))].map(p => p === "bongacams" ? "BongaCams" : "Chaturbate").join(" + ");
    countEl.textContent = `${Math.min(60, rooms.length)} live rooms shown${platformText ? ` · ${platformText}` : ""}`;
    notice.hidden = true;
  } catch (err) {
    grid.innerHTML = ""; notice.hidden = false; notice.textContent = "Live rooms are temporarily unavailable. Please check again shortly."; countEl.textContent = ""; console.error(err);
  } finally { loading = false; }
}

q.addEventListener("input", () => { clearTimeout(window.ncfSearchTimer); window.ncfSearchTimer = setTimeout(load, 250); });
sort.addEventListener("change", load); countrySelect.addEventListener("change", load);
partners(); load();
