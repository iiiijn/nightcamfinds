const grid = document.querySelector("#grid");
const notice = document.querySelector("#notice");
const gate = document.querySelector("#gate");
const countEl = document.querySelector("#result-count");
const sort = document.querySelector("#sort");
const q = document.querySelector("#q");
const countrySelect = document.querySelector("#country");

if (localStorage.getItem("ncf18") === "1" && gate) gate.hidden = true;
document.querySelector("#enter")?.addEventListener("click", () => {
  localStorage.setItem("ncf18", "1");
  document.documentElement.classList.add("ok");
  gate.hidden = true;
});

const PAGES = {
  all: ["Independent discovery", "Find live cams worth clicking", "Browse live rooms by category and country. Open a room on Chaturbate to watch and chat.", "NightCamFinds — Live cams now"],
  live: ["Live now", "Rooms that are live now", "Currently online rooms from the partner feed. Viewer counts and subjects can change quickly.", "Live cams now — NightCamFinds"],
  female: ["Female", "Female live cams", "Browse live female rooms and continue to Chaturbate when you find one you like.", "Female live cams — NightCamFinds"],
  male: ["Male", "Male live cams", "Browse live male rooms and continue to Chaturbate when you find one you like.", "Male live cams — NightCamFinds"],
  trans: ["Trans", "Trans live cams", "Browse live trans rooms from the partner feed.", "Trans live cams — NightCamFinds"],
  couples: ["Couples", "Couple live cams", "Browse live couple rooms and open a room on Chaturbate.", "Couple live cams — NightCamFinds"],
  hd: ["HD", "HD live cams", "Browse rooms marked HD by the partner feed.", "HD live cams — NightCamFinds"],
  new: ["New", "New broadcasters", "Browse rooms marked new in the current feed.", "New live cams — NightCamFinds"],
  popular: ["Popular", "Most watched rooms", "Start with rooms that currently have the most viewers.", "Popular live cams — NightCamFinds"],
  countries: ["Countries", "Live cams by country", "Choose a country to focus your browsing and paid-traffic tests.", "Live cams by country — NightCamFinds"]
};

const path = location.pathname.replaceAll("/", "") || "all";
const category = PAGES[path] ? path : "all";
const page = PAGES[category];
const incoming = new URLSearchParams(location.search);
const trafficSource = incoming.get("utm_source") || incoming.get("source") || "direct";
const trafficCampaign = incoming.get("utm_campaign") || incoming.get("campaign") || "organic";
const hinted = document.querySelector('meta[name="ncf-country"]')?.content || "";

const NAMES = { US:"United States", CA:"Canada", GB:"United Kingdom", IE:"Ireland", AU:"Australia", NZ:"New Zealand", DE:"Germany", AT:"Austria", CH:"Switzerland", FR:"France", BE:"Belgium", NL:"Netherlands", LU:"Luxembourg", SE:"Sweden", NO:"Norway", DK:"Denmark", FI:"Finland", IS:"Iceland", JP:"Japan", SG:"Singapore" };
const QUICK = ["US","GB","CA","AU","DE","FR","NL"];
const TIER1 = Object.keys(NAMES);

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

const quick = document.querySelector("#quick");
for (const iso of QUICK) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost";
  button.textContent = NAMES[iso];
  button.addEventListener("click", () => {
    countrySelect.value = iso;
    load();
    document.querySelector("#rooms")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  quick?.append(button);
}

function cleanTrack(value, fallback) {
  return String(value || fallback).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || fallback;
}

function track() {
  const country = countrySelect.value ? countrySelect.value.toLowerCase() : "all";
  const base = category === "all" ? "home" : category;
  return cleanTrack(`${trafficSource}-${base}-${country}`, "ncf-home");
}

function trackingParams() {
  const params = new URLSearchParams();
  params.set("src", track());
  params.set("cat", category);
  params.set("source", cleanTrack(trafficSource, "direct"));
  params.set("campaign", cleanTrack(trafficCampaign, "organic"));
  return params;
}

function partners() {
  const src = cleanTrack(`${trafficSource}-${category}-footer`, "home-footer");
  const params = new URLSearchParams({ src, cat: category, source: cleanTrack(trafficSource, "direct"), campaign: cleanTrack(trafficCampaign, "organic") });
  const wrap = document.querySelector("#partner-actions");
  const a = document.createElement("a");
  a.className = "btn";
  a.href = `/go/chaturbate:featured?${params.toString()}`;
  a.textContent = "Browse Chaturbate";
  a.target = "_blank";
  a.rel = "sponsored nofollow noopener";
  wrap?.append(a);
}

function card(room) {
  const a = document.createElement("a");
  a.className = "card";
  const params = trackingParams();
  a.href = "/go/" + encodeURIComponent(room.id) + "?" + params.toString();
  a.rel = "sponsored nofollow noopener";

  const img = document.createElement(room.image ? "img" : "div");
  img.className = "thumb";
  if (room.image) {
    img.alt = room.displayName + " live room preview";
    img.src = room.image;
    img.loading = "lazy";
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  const badges = document.createElement("div");
  badges.className = "badges";
  const bits = [["Live", "live"], room.isHd ? ["HD", ""] : null, room.isNew ? ["New", ""] : null, [Number(room.viewerCount || 0).toLocaleString() + " watching", ""], room.country ? [NAMES[room.country] || room.country, ""] : null].filter(Boolean);
  for (const [label, extra] of bits) {
    const span = document.createElement("span");
    span.className = extra ? "badge " + extra : "badge";
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
  cta.textContent = "Watch live";
  meta.append(badges, strong, subject, cta);
  a.append(img, meta);
  return a;
}

let timer;
function schedule() { clearTimeout(timer); timer = setTimeout(load, 250); }

async function load() {
  const params = new URLSearchParams({ category, sort: sort.value, q: q.value });
  if (countrySelect.value) params.set("country", countrySelect.value);
  const data = await fetch("/api/rooms?" + params).then((r) => r.json());

  if (countrySelect.options.length === 1) {
    for (const iso of data.countries || []) {
      const opt = document.createElement("option");
      opt.value = iso;
      opt.textContent = NAMES[iso] || iso;
      countrySelect.append(opt);
    }
    if (!countrySelect.value && TIER1.includes(hinted) && (data.countries || []).includes(hinted)) countrySelect.value = hinted;
    if (countrySelect.value) return load();
  }

  const rooms = data.rooms || [];
  if ((category === "all" || category === "live") && !q.value && !countrySelect.value) {
    grid.replaceChildren();
    for (const [key, label] of [["female","Top female"],["male","Top male"],["trans","Top trans"],["couples","Top couples"]]) {
      const picked = rooms.filter((room) => room.gender === key).slice(0, 8);
      if (!picked.length) continue;
      const section = document.createElement("section");
      section.className = "home-group";
      const heading = document.createElement("h2");
      heading.textContent = label;
      const row = document.createElement("div");
      row.className = "grid";
      row.append(...picked.map(card));
      section.append(heading, row);
      grid.append(section);
    }
  } else {
    grid.replaceChildren(...rooms.map(card));
  }

  countEl.textContent = (rooms.length ? rooms.length + " live rooms" : "No rooms match that filter.") + " · updated " + new Date().toLocaleTimeString();
  notice.hidden = !data.notice;
  notice.textContent = data.notice || "";
}

sort.addEventListener("change", load);
countrySelect.addEventListener("change", load);
q.addEventListener("input", schedule);
partners();
load().catch(() => {
  notice.hidden = false;
  notice.textContent = "Could not load rooms. Please try again.";
});
setInterval(() => {
  if (document.hidden || q.value) return;
  load().catch(() => {});
}, 30000);
