const grid = document.querySelector("#grid");
const notice = document.querySelector("#notice");
const gate = document.querySelector("#gate");
const countEl = document.querySelector("#result-count");

if (localStorage.getItem("ncf18") === "1" && gate) gate.hidden = true;
document.querySelector("#enter")?.addEventListener("click", () => {
  localStorage.setItem("ncf18", "1");
  gate.hidden = true;
});

const PAGES = {
  all: {
    kicker: "Independent discovery",
    title: "Discover live cams right now",
    intro: "Explore live rooms, compare viewer counts, and open a broadcaster on the partner site. NightCamFinds does not stream video itself.",
    documentTitle: "NightCamFinds — Live cam directory"
  },
  live: {
    kicker: "Live now",
    title: "Rooms that are live now",
    intro: "Currently online rooms from partner platforms. Counts and subjects come from the feed and can change every minute.",
    documentTitle: "Live cams now — NightCamFinds"
  },
  female: {
    kicker: "Female",
    title: "Female live cams",
    intro: "Rooms tagged female in the partner feed. Open a card to continue on the broadcaster’s platform.",
    documentTitle: "Female live cams — NightCamFinds"
  },
  male: {
    kicker: "Male",
    title: "Male live cams",
    intro: "Rooms tagged male in the partner feed. Use search or country to narrow the list.",
    documentTitle: "Male live cams — NightCamFinds"
  },
  trans: {
    kicker: "Trans",
    title: "Trans live cams",
    intro: "Rooms tagged trans in the partner feed. NightCamFinds only lists public rooms supplied by partners.",
    documentTitle: "Trans live cams — NightCamFinds"
  },
  couples: {
    kicker: "Couples",
    title: "Couple live cams",
    intro: "Rooms tagged as couples. Availability depends on who is online.",
    documentTitle: "Couple live cams — NightCamFinds"
  },
  hd: {
    kicker: "HD",
    title: "HD live cams",
    intro: "Rooms the feed marks as HD. Quality still depends on the broadcaster’s connection.",
    documentTitle: "HD live cams — NightCamFinds"
  },
  new: {
    kicker: "New",
    title: "New broadcasters",
    intro: "Rooms marked new in the feed. Newer rooms often have fewer viewers.",
    documentTitle: "New live cams — NightCamFinds"
  },
  popular: {
    kicker: "Popular",
    title: "Most watched rooms",
    intro: "Sorted by viewer count from the current feed.",
    documentTitle: "Popular live cams — NightCamFinds"
  },
  countries: {
    kicker: "Countries",
    title: "Live cams by country",
    intro: "Pick a country to filter rooms that publish a country code. Not every room includes one.",
    documentTitle: "Live cams by country — NightCamFinds"
  }
};

const BLOCKED = /\b(teen|teens|teenage|underage|preteen|lolita|child|children|kid|kids|young|18yo|19yo|#18\b|#19\b)\b/i;

const category = location.pathname.replaceAll("/", "") || "all";
const page = PAGES[category] || PAGES.all;
const sort = document.querySelector("#sort");
const q = document.querySelector("#q");

if (page) {
  const kicker = document.querySelector("#kicker");
  const title = document.querySelector("#page-title");
  const intro = document.querySelector("#page-intro");
  if (kicker) kicker.textContent = page.kicker;
  if (title) title.textContent = page.title;
  if (intro) intro.textContent = page.intro;
  document.title = page.documentTitle;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", page.intro);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = location.origin + location.pathname;
  document.querySelectorAll("nav a").forEach((a) => {
    if (a.getAttribute("href") === location.pathname) a.setAttribute("aria-current", "page");
  });
}
if (category === "popular" && sort) sort.value = "viewers";

function trackForPage() {
  return category === "all" ? "home" : category;
}

function partnerLinks() {
  const track = encodeURIComponent(trackForPage());
  return [
    {
      label: "Browse Chaturbate",
      url: `https://chaturbate.com/in/?tour=LQps&campaign=C6yxN&track=${track}`
    },
    {
      label: "Browse BongaCams",
      url: `https://bongacams4.com/track?c=840970&track=${track}`
    }
  ];
}

function addAffiliateLinks() {
  const wrap = document.querySelector("#partner-actions");
  if (!wrap) return;
  for (const item of partnerLinks()) {
    const link = document.createElement("a");
    link.className = "btn";
    link.href = item.url;
    link.textContent = item.label;
    link.target = "_blank";
    link.rel = "sponsored nofollow noopener";
    wrap.append(link);
  }
}

function cleanSubject(text) {
  if (!text) return "Live room";
  return text
    .replace(BLOCKED, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-|#]+|[\s\-|#]+$/g, "")
    .trim() || "Live room";
}

function card(room) {
  const el = document.createElement("article");
  el.className = "card";
  const name = room.displayName || "Live room";
  const img = document.createElement(room.image ? "img" : "div");
  img.className = "thumb";
  if (room.image) {
    img.alt = `${name} live room preview`;
    img.src = room.image;
    img.loading = "lazy";
  }
  const meta = document.createElement("div");
  meta.className = "meta";
  const badges = document.createElement("div");
  badges.className = "badges";
  const bits = [
    ["Live", "live"],
    room.isHd ? ["HD", ""] : null,
    room.isNew ? ["New", ""] : null,
    room.viewerCount != null ? [`${Number(room.viewerCount).toLocaleString()} watching`, ""] : null,
    room.country ? [room.country, ""] : null
  ].filter(Boolean);
  for (const [label, extra] of bits) {
    const span = document.createElement("span");
    span.className = extra ? `badge ${extra}` : "badge";
    span.textContent = label;
    badges.append(span);
  }
  const strong = document.createElement("strong");
  strong.textContent = name;
  const subject = document.createElement("p");
  subject.className = "muted subject";
  subject.textContent = cleanSubject(room.roomSubject || room.gender || "");
  const enter = document.createElement("button");
  enter.className = "btn";
  enter.type = "button";
  enter.textContent = "View model";
  enter.addEventListener("click", () => openRoom(room));
  meta.append(badges, strong, subject, enter);
  el.append(img, meta);
  return el;
}

async function loadCountries() {
  const select = document.querySelector("#country");
  if (!select) return;
  try {
    const countries = await fetch("/api/countries").then((r) => r.json());
    const list = Array.isArray(countries) ? countries : countries.countries || [];
    for (const c of list.filter((x) => x.enabled !== false).sort((a, b) => (a.priority || 0) - (b.priority || 0))) {
      const opt = document.createElement("option");
      opt.value = c.iso;
      opt.textContent = c.name;
      select.append(opt);
    }
  } catch (error) {
    console.error("Could not load countries:", error);
  }
}

let timer;
function scheduleLoad() {
  clearTimeout(timer);
  timer = setTimeout(load, 250);
}

async function load() {
  const params = new URLSearchParams({ category: category || "all", sort: sort?.value || "recommended", q: q?.value || "" });
  const country = document.querySelector("#country")?.value || "";
  if (country) params.set("country", country);
  const data = await fetch("/api/rooms?" + params).then((r) => r.json());
  let rooms = data.rooms || [];
  if (country) rooms = rooms.filter((r) => (r.country || "").toUpperCase() === country.toUpperCase());
  grid.replaceChildren(...rooms.map(card));
  if (countEl) countEl.textContent = rooms.length ? `${rooms.length} rooms` : "No rooms match that filter.";
  if (notice) {
    notice.hidden = !data.notice && rooms.length > 0;
    notice.textContent = data.notice || (rooms.length ? "" : "No rooms match that filter. Try another category or country.");
  }
}

document.querySelector("#surprise")?.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/surprise");
    const data = await response.json();
    if (!response.ok || !data.room?.id) return;
    location.href = "/go/" + encodeURIComponent(data.room.id);
  } catch (error) {
    console.error("Surprise failed:", error);
  }
});
sort?.addEventListener("change", load);
document.querySelector("#country")?.addEventListener("change", load);
q?.addEventListener("input", scheduleLoad);

addAffiliateLinks();
loadCountries().finally(() => {
  load().catch((error) => {
    console.error("Could not load rooms:", error);
    if (notice) {
      notice.textContent = "Could not load rooms. Please try again.";
      notice.hidden = false;
    }
  });
});


const GROUPS = [
  ["female", "Top female"],
  ["male", "Top male"],
  ["trans", "Top trans"],
  ["couples", "Top couples"]
];

function providerName(room) {
  if ((room.provider || room.id || "").includes("bonga")) return "BongaCams";
  return "Chaturbate";
}

function openRoom(room) {
  let dialog = document.querySelector("#room-dialog");
  if (!dialog) {
    dialog = document.createElement("div");
    dialog.id = "room-dialog";
    dialog.className = "age-gate";
    dialog.innerHTML = `<div class="panel" id="room-panel"></div>`;
    document.body.append(dialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.hidden = true;
    });
  }
  const name = room.displayName || "Live model";
  const partner = providerName(room);
  dialog.querySelector("#room-panel").innerHTML = `
    <p class="eyebrow">${partner}</p>
    <h2>${name}</h2>
    <p class="muted">${cleanSubject(room.roomSubject || room.gender || "")}</p>
    <p class="muted">NightCamFinds does not host this room. Create a free account on ${partner}, or sign in there, to open it. That button uses this model's tracked link, which is how the commission is recorded.</p>
    <div class="actions">
      <a class="btn" href="/go/${encodeURIComponent(room.id)}">Create account and enter</a>
      <button class="ghost" type="button" id="close-room">Back</button>
    </div>`;
  dialog.hidden = false;
  dialog.querySelector("#close-room").addEventListener("click", () => { dialog.hidden = true; });
}

function renderHome(rooms) {
  grid.replaceChildren();
  for (const [key, label] of GROUPS) {
    const picked = rooms.filter((room) => (room.gender || "").toLowerCase() === key).slice(0, 8);
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
  const bonga = document.createElement("section");
  bonga.className = "home-group";
  bonga.innerHTML = `<h2>BongaCams</h2><p class="muted">Live BongaCams models are not connected yet, so none are invented here. The tracked link is ready for when that feed is verified.</p><a class="btn" href="https://bongacams4.com/track?c=840970&track=home" target="_blank" rel="sponsored nofollow noopener">Browse BongaCams</a>`;
  grid.append(bonga);
}

const originalLoad = load;
load = async function () {
  const params = new URLSearchParams({ category: category || "all", sort: sort?.value || "recommended", q: q?.value || "" });
  const country = document.querySelector("#country")?.value || "";
  if (country) params.set("country", country);
  const data = await fetch("/api/rooms?" + params).then((r) => r.json());
  let rooms = data.rooms || [];
  if (country) rooms = rooms.filter((r) => (r.country || "").toUpperCase() === country.toUpperCase());
  if ((category === "all" || category === "live") && !q?.value && !country) renderHome(rooms);
  else grid.replaceChildren(...rooms.map(card));
  if (countEl) countEl.textContent = rooms.length ? `${rooms.length} live rooms` : "No rooms match that filter.";
  if (notice) {
    notice.hidden = !data.notice && rooms.length > 0;
    notice.textContent = data.notice || (rooms.length ? "" : "No rooms match that filter.");
  }
};
