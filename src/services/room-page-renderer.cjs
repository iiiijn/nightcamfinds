"use strict";

function plainText(value, depth = 0) {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => plainText(item, depth + 1)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    for (const key of ["text", "title", "description", "subject", "topic", "value", "label", "name"]) {
      if (value[key] != null) { const result = plainText(value[key], depth + 1); if (result) return result; }
    }
  }
  return "";
}

const escapeHtml = (value) => plainText(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function renderHeroCopy(html, copy) {
  const values = Array.isArray(copy) ? copy : [];
  return String(html)
    .replace('id="kicker">Independent discovery', `id="kicker">${escapeHtml(values[0] || "")}`)
    .replace('id="page-title">Discover live cams right now', `id="page-title">${escapeHtml(values[1] || "")}`)
    .replace('id="page-intro">Explore live rooms, compare viewer counts, and open a room on Chaturbate or BongaCams. NightCamFinds does not stream video itself.', `id="page-intro">${escapeHtml(values[2] || "")}`)
    .replace("<title>NightCamFinds — Live cam directory</title>", `<title>${escapeHtml(values[3] || "")}</title>`)
    .replace('content="Browse live rooms by country from Chaturbate and BongaCams. NightCamFinds does not stream video."', `content="${escapeHtml(values[2] || "")}"`);
}

function safeImage(value) {
  try {
    const parsed = new URL(String(value || ""));
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function card(room, category = "all", pagePath = "/") {
  const isBonga = room.platform === "bongacams";
  const redirect = isBonga ? "/bgo/" : "/go/";
  const placement = pagePath === "/" ? "home" : category === "all" ? "live" : category;
  const params = new URLSearchParams({
    src: placement,
    cat: room.gender || category,
    source: "direct",
    medium: "unknown",
    campaign: "organic",
    content: "",
    placement,
    lp: pagePath
  });
  const href = redirect + encodeURIComponent(room.id) + "?" + params.toString();
  const image = safeImage(room.image);
  const badges = [
    [isBonga ? "BongaCams" : "Chaturbate", isBonga ? "platform bongacams" : "platform chaturbate"],
    ["Live", "live"],
    room.isHd ? ["HD", ""] : null,
    room.isNew ? ["New", ""] : null,
    [Number(room.viewerCount || 0).toLocaleString() + " watching", ""],
    room.country ? [room.countryName || room.country, ""] : null
  ].filter(Boolean).map(([label, extra]) => `<span class="badge${extra ? " " + extra : ""}">${escapeHtml(label)}</span>`).join("");
  const tag = "a";
  const linkAttrs = ` href="${escapeHtml(href)}" rel="sponsored nofollow noopener"`;
  const cardClass = "card";
  const action = isBonga ? "Watch on BongaCams" : "Watch on Chaturbate";
  return `<${tag} class="${cardClass}"${linkAttrs}>${image ? `<img class="thumb" src="${escapeHtml(image)}" alt="${escapeHtml(room.displayName || room.username)} live room preview" loading="lazy" decoding="async">` : '<div class="thumb" aria-hidden="true"></div>'}<div class="meta"><div class="badges">${badges}</div><strong>${escapeHtml(room.displayName || room.username)}</strong><p class="muted subject">${escapeHtml(room.roomSubject || "Live room")}</p><span class="btn">${action}</span></div></${tag}>`;
}

function renderRoomCards(rooms, options = {}) {
  const list = Array.isArray(rooms) ? rooms : [];
  const category = options.category || "all";
  const pagePath = options.pagePath || "/";
  if (!list.length) return '<p class="empty-state">No live rooms are available in this directory right now. Please check again soon.</p>';
  if (options.home) {
    const groups = [["female", "Top female"], ["male", "Top male"], ["trans", "Top trans"], ["couples", "Top couples"]];
    return groups.map(([gender, label]) => {
      const matches = list.filter((room) => room.gender === gender);
      const selected = [];
      const bonga = matches.filter((room) => room.platform === "bongacams");
      const chaturbate = matches.filter((room) => room.platform === "chaturbate");
      for (let i = 0; i < 2; i++) {
        if (bonga[i]) selected.push(bonga[i]);
        if (chaturbate[i]) selected.push(chaturbate[i]);
      }
      for (const room of matches) {
        if (selected.length >= 4) break;
        if (!selected.some((item) => item.id === room.id)) selected.push(room);
      }
      return selected.length ? `<section class="home-group"><h2>${label}</h2><div class="grid">${selected.slice(0, 4).map((room) => card(room, gender, pagePath)).join("")}</div></section>` : "";
    }).join("") || '<p class="empty-state">No live rooms are available in this directory right now. Please check again soon.</p>';
  }
  const bonga = list.filter((room) => room.platform === "bongacams");
  const chaturbate = list.filter((room) => room.platform === "chaturbate");
  const balanced = [];
  for (let i = 0; i < Math.max(bonga.length, chaturbate.length); i++) {
    if (bonga[i]) balanced.push(bonga[i]);
    if (chaturbate[i]) balanced.push(chaturbate[i]);
  }
  return balanced.map((room) => card(room, category, pagePath)).join("");
}

module.exports = { escapeHtml, plainText, renderHeroCopy, renderRoomCards };
