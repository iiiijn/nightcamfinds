const grid = document.querySelector("#grid");
const notice = document.querySelector("#notice");
const gate = document.querySelector("#gate");
if (localStorage.getItem("ncf18") === "1") gate.hidden = true;
document.querySelector("#enter")?.addEventListener("click", () => {
  localStorage.setItem("ncf18", "1");
  gate.hidden = true;
});

const category = location.pathname.replaceAll("/", "") || "all";
const sort = document.querySelector("#sort");
const q = document.querySelector("#q");
if (category === "popular") sort.value = "viewers";

async function loadCountries() {
  const countries = await fetch("/api/countries").then((r) => r.json());
  const select = document.querySelector("#country");
  for (const c of countries.filter((x) => x.enabled).sort((a, b) => a.priority - b.priority)) {
    const opt = document.createElement("option");
    opt.value = c.iso;
    opt.textContent = c.name;
    select.append(opt);
  }
}

function card(room) {
  const el = document.createElement("article");
  el.className = "card";
  const img = room.image ? `<img class="thumb" alt="" src="${room.image}" loading="lazy">` : `<div class="thumb"></div>`;
  const badges = [
    room.isHd ? "HD" : "",
    room.isNew ? "New" : "",
    room.viewerCount != null ? `${room.viewerCount} watching` : "",
    room.country || ""
  ].filter(Boolean).map((b) => `<span class="badge">${b}</span>`).join("");
  el.innerHTML = `${img}<div class="meta"><div class="badges">${badges}</div><strong>${room.displayName}</strong><p class="muted">${room.roomSubject || room.gender || ""}</p><a class="btn" href="/go/${encodeURIComponent(room.id)}">Enter Room</a></div>`;
  return el;
}

async function load() {
  const params = new URLSearchParams({ category: category || "all", sort: sort.value, q: q.value });
  const country = document.querySelector("#country").value;
  const data = await fetch("/api/rooms?" + params).then((r) => r.json());
  let rooms = data.rooms;
  if (country) rooms = rooms.filter((r) => (r.country || "").toUpperCase() === country);
  grid.replaceChildren(...rooms.map(card));
  notice.hidden = !data.notice;
  notice.textContent = data.notice || "";
}

document.querySelector("#surprise")?.addEventListener("click", async () => {
 try {
   const response = await fetch("/api/surprise");
const data = await response.json();
 if (!response.ok || !data.room?.id) {
sort?.addEventListener("change", load);
q?.addEventListener("input", () => { clearTimeout(q._t); q._t = setTimeout(load, 250); });
document.querySelector("#country")?.addEventListener("change", load);
loadCountries().then(load);
