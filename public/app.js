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

const NAMES = { US:"United States", CA:"Canada", GB:"United Kingdom", IE:"Ireland", AU:"Australia", NZ:"New Zealand", DE:"Germany", AT:"Austria", CH:"Switzerland", FR:"France", BE:"Belgium", NL:"Netherlands", LU:"Luxembourg", SE:"Sweden", NO:"Norway", DK:"Denmark", FI:"Finland", IS:"Iceland", JP:"Japan", SG:"Singapore", BR:"Brazil", CO:"Colombia", MX:"Mexico", AR:"Argentina", CL:"Chile", PE:"Peru", VE:"Venezuela", PH:"Philippines", TH:"Thailand", CN:"China", RO:"Romania", UA:"Ukraine", IT:"Italy", ES:"Spain", PL:"Poland", CZ:"Czechia", HU:"Hungary", KE:"Kenya", KZ:"Kazakhstan", IN:"India", RU:"Russia", ZA:"South Africa" };
const QUICK = ["US","GB","CA","AU","DE","FR","NL"];

const hinted = document.querySelector('meta[name="ncf-country"]')?.content || "";
const forced = document.querySelector('meta[name="ncf-force"]')?.content || "";
const queryParams = new URLSearchParams(location.search);
const trafficSource = (queryParams.get("utm_source") || queryParams.get("source") || "direct").slice(0, 30);
const trafficCampaign = (queryParams.get("utm_campaign") || queryParams.get("campaign") || "organic").slice(0, 40);
const trafficMedium = (queryParams.get("utm_medium") || "").slice(0, 30);
const trafficContent = (queryParams.get("utm_content") || "").slice(0, 40);

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

function trackingQuery(extra = {}) {
  const params = new URLSearchParams({
    src: extra.src || placement(),
    cat: extra.cat || (category === "all" ? "all" : category),
    source: trafficSource,
    campaign: trafficCampaign
  });
  if (trafficMedium) params.set("utm_medium", trafficMedium);
  if (trafficContent) params.set("utm_content", trafficContent);
  return params.toString();
}

function partners() {
  const src = category === "all" ? "home-footer" : category + "-footer";
  const wrap = document.querySelector("#partner-actions");

  const cb = document.createElement("a");
  cb.className = "btn";
  cb.href = "/go/directory?" + trackingQuery({ src: src + "-chaturbate" });
  cb.textContent = "Chat on Chaturbate";
  cb.rel = "sponsored nofollow noopener";
  wrap.append(cb);

  const bonga = document.createElement("a");
  bonga.className = "btn ghost";
  bonga.href = "/bgo/directory?" + trackingQuery({ src: src + "-bongacams" });
  bonga.textContent = "Browse BongaCams";
  bonga.rel = "sponsored nofollow noopener";
  wrap.append(bonga);
}

function card(room) {
  const a = document.createElement("a");
  const isBonga = room.platform === "bongacams";
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
  }
  const meta = document.createElement("div");
  meta.className = "meta";
  const badges = document.createElement("div");
  badges.className = "badges";
  const bits = [[isBonga ? "BongaCams" : "Chaturbate", "platform"], ["Live", "live"], room.isHd ? ["HD", ""] : null, room.isNew ? ["New", ""] : null, [Number(room.viewerCount || 0).toLocaleString() + " watching", ""], room.country ? [room.countryName || NAMES[room.country] || room.country, ""] : null].filter(Boolean);
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
    if (!countrySelect.value && (forced || hinted) && (data.countries || []).includes(forced || hinted)) countrySelect.value = forced || hinted;
    if (countrySelect.value) return load();
  }
  const rooms = data.rooms || [];
  if ((category === "all" || category === "live") && !q.value && !countrySelect.value) {
    grid.replaceChildren();
    for (const [key, label] of [["female","Top female"],["male","Top male"],["trans","Top trans"],["couples","Top couples"]]) {
      const picked = pickHomeRooms(rooms, key);
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
    const displayed = balanceCategoryRooms(rooms);
    grid.replaceChildren(...displayed.map(card));
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