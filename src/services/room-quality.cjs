"use strict";

const UNSAFE_ROOM_TEXT = /\\b(?:underage|preteen|teen(?:age)?|child(?:ren)?|kids?|lolita|barely\\s*legal|18\\s*yo|19\\s*yo)\\b/i;

function isDisplayableRoom(room, rawText = "") {
  if (!room || typeof room !== "object") return false;
  const platform = String(room.platform || "").toLowerCase();
  if (!["chaturbate", "bongacams"].includes(platform)) return false;
  const username = String(room.username || "").trim();
  const id = String(room.id || "");
  if (!username || id !== platform + ":" + username) return false;
  if (!String(room.displayName || "").trim()) return false;

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
    ? /(^|\\.)chaturbate\\.com$/.test(host)
    : /(^|\\.)bongacams4?\\.com$/.test(host);
  if (!validHost) return false;

  const displayText = [rawText, room.displayName, room.roomSubject].join(" ");
  if (UNSAFE_ROOM_TEXT.test(displayText)) return false;
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

module.exports = { isDisplayableRoom, filterDisplayableRooms };
