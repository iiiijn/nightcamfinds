"use strict";

const UNSAFE_ROOM_TEXT = /\b(?:underage|preteen|teen(?:age)?|child(?:ren)?|kids?|lolita|barely\s*legal|18\s*yo|19\s*yo)\b/i;
const VALID_GENDERS = new Set(["female", "male", "trans", "couples"]);
const URL_OR_LINK = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|me|io|tv)\b)/i;
const PROMO_SPAM = /\b(?:telegram|whatsapp|snapchat|kik|cashapp|venmo|click\s+here|join\s+my\s+(?:group|channel)|free\s+(?:tokens|shows)|promo\s+code)\b/i;

function normalizeRoomGender(value) {
  const key = String(value == null ? "" : value).normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const categories = {
    f: "female", female: "female", woman: "female", women: "female", weiblich: "female",
    m: "male", male: "male", man: "male", men: "male",
    t: "trans", s: "trans", trans: "trans", transgender: "trans",
    c: "couples", couple: "couples", couples: "couples",
    "paar weiblich + männlich": "couples", "paar weiblich + weiblich": "couples"
  };
  return categories[key] || "";
}

function cleanRoomTitle(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function hasSpamTitle(value) {
  const title = cleanRoomTitle(value);
  if (!title) return false;
  if (URL_OR_LINK.test(title) || PROMO_SPAM.test(title)) return true;

  const words = title.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
  if (words.length >= 8) {
    const counts = new Map();
    for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
    if ([...counts.values()].some((count) => count >= 5)) return true;
  }
  return false;
}

function isDisplayableRoom(room, rawText = "") {
  if (!room || typeof room !== "object") return false;
  const platform = String(room.platform || "").toLowerCase();
  if (!["chaturbate", "bongacams"].includes(platform)) return false;
  const username = String(room.username || "").trim();
  const id = String(room.id || "");
  if (!username || id !== platform + ":" + username) return false;
  if (!cleanRoomTitle(room.displayName)) return false;

  const gender = String(room.gender || "").trim().toLowerCase();
  if (gender && !VALID_GENDERS.has(gender)) return false;

  const viewerCount = Number(room.viewerCount);
  if (!Number.isFinite(viewerCount) || viewerCount < 0) return false;

  let destination;
  try {
    destination = new URL(String(room.href || ""));
  } catch {
    return false;
  }
  if (destination.protocol !== "https:") return false;
  const host = destination.hostname.toLowerCase();
  const validHost = platform === "chaturbate"
    ? /(^|\.)chaturbate\.com$/.test(host)
    : /(^|\.)bongacams4?\.com$/.test(host);
  if (!validHost) return false;

  const title = cleanRoomTitle(room.roomSubject);
  if (hasSpamTitle(title) || hasSpamTitle(room.displayName)) return false;
  const sourceText = cleanRoomTitle(rawText);
  if (UNSAFE_ROOM_TEXT.test([sourceText, room.displayName, title].join(" "))) return false;
  if (hasSpamTitle(sourceText)) return false;
  return true;
}

function filterDisplayableRooms(entries) {
  const seen = new Set();
  const accepted = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const wrapped = entry && Object.prototype.hasOwnProperty.call(entry, "normalized");
    const room = wrapped ? entry.normalized : entry;
    const rawText = wrapped ? entry.rawText || "" : "";
    if (!isDisplayableRoom(room, rawText) || seen.has(room.id)) continue;
    seen.add(room.id);
    accepted.push(room);
  }
  return accepted;
}

module.exports = { cleanRoomTitle, normalizeRoomGender, hasSpamTitle, isDisplayableRoom, filterDisplayableRooms };
