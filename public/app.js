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
  all: ["Independent discovery", "Discover live cams right now", "Explore live rooms, compare viewer counts, and open a broadcaster on the partner site. NightCamFinds does not stream video itself.", "NightCamFinds — Live cam directory"],
  live: ["Live now", "Rooms that are live now", "Currently online rooms from partner platforms. Counts and subjects come from the feed and can change every minute.", "Live cams now — NightCamFinds"],
  female: ["Female", "Female live cams", "Rooms tagged female in the partner feed. Open a card to continue on the broadcaster’s platform.", "Female live cams — NightCamFinds"],
  male: ["Male", "Male live cams", "Rooms tagged male in the partner feed. Use search or country to narrow the list.", "Male live cams — NightCamFinds"],
  trans: ["Trans", "Trans live cams", "Rooms tagged trans in the partner feed. NightCamFinds only lists public rooms supplied by partners.", "Trans live cams — NightCamFinds"],
  couples: ["Couples", "Couple live cams", "Rooms tagged as couples. Availability depends on who is online.", "Couple live cams — NightCamFinds"],
  hd: ["HD", "HD live cams", "Rooms the feed marks as HD. Quality still depends on the broadcaster’s connection.", "HD live cams — NightCamFinds"],
  new: ["New", "New broadcasters", "Rooms marked new in the feed. Newer rooms often have fewer viewers.", "New live cams — NightCamFinds"],
  popular: ["Popular", "Most watched rooms", "Sorted by viewer count from the current feed.", "Popular live cams — NightCamFinds"],
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
const TIER1 = Object.keys(NAMES);

const hinted = document.querySelector('meta[name="ncf-country"]')?.content || "";
const forced = document.querySelector('meta[name="ncf-force"]')?.content || "";
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

function track() {
  const country = countrySelect.value ? "country-" + countrySelect.value.toLowerCase() : "";
  const base = category === "all" ? "home" : category;
  return country || base + "-card";
}

function partners() {
  const src = category === "all" ? "home-footer" : category + "-footer";
  const wrap = document.querySelector("#partner-actions");
  const links = [
    ["Chat free", `https://chaturbate.com/in/?tour=LQps&campaign=C6yxN&track=watch-signup`]
  ];
  for (const [label, href] of links) {
    const a = document.createElement("a");
    a.className = "btn";
    a.href = href;
    a.textContent = label;
    a.target = "_blank";
    a.rel = "sponsored nofollow noopener";
    wrap.append(a);
  }
}

function card(room) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = "/go/" + encodeURIComponent(room.id) + "?src=" + encodeURIComponent(track());
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
  const bits = [["Live", "live"], room.isHd ? ["HD", ""] : null, room.isNew ? ["New", ""] : null, [Number(room.viewerCount || 0).toLocaleString() + " watching", ""], room.country ? [room.countryName || NAMES[room.country] || room.country, ""] : null].filter(Boolean);
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
    if (!countrySelect.value && (forced || hinted) && (data.countries || []).includes(forced || hinted)) countrySelect.value = forced || hinted;
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
  } else grid.replaceChildren(...rooms.map(card));
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
