"use strict";

const SUPPORTED_PLATFORMS = new Set(["chaturbate", "bongacams"]);
const CATEGORIES = new Set(["female", "male", "trans", "couples"]);

function roomQualityScore(room) {
  if (!room || typeof room !== "object") return 0;
  const viewers = Math.max(0, Number(room.viewerCount) || 0);
  let score = Math.log1p(viewers) * 5;
  if (room.isLive === true) score += 20;
  if (typeof room.image === "string" && /^https:\/\//i.test(room.image)) score += 12;
  if (typeof room.roomSubject === "string" && room.roomSubject.trim()) score += 8;
  if (CATEGORIES.has(String(room.gender || "").toLowerCase())) score += 6;
  if (room.isHd === true) score += 3;
  if (room.freshness === "FRESH") score += 6;
  if (room.isNew === true) score += 2;
  return score;
}

function rankRoomsByPreferredPlatform(rooms, preferredPlatform, sort = "recommended") {
  const list = Array.isArray(rooms) ? rooms.map((room, index) => ({ room, index })) : [];
  const preferred = SUPPORTED_PLATFORMS.has(String(preferredPlatform || "").toLowerCase())
    ? String(preferredPlatform).toLowerCase()
    : null;
  list.sort((left, right) => {
    const a = left.room || {};
    const b = right.room || {};
    if (sort === "newest") {
      return Number(b.isNew) - Number(a.isNew)
        || Number(b.viewerCount || 0) - Number(a.viewerCount || 0)
        || left.index - right.index;
    }
    if (sort === "viewers" || sort === "popular") {
      return Number(b.viewerCount || 0) - Number(a.viewerCount || 0)
        || left.index - right.index;
    }
    const scoreA = roomQualityScore(a) + (preferred && a.platform === preferred ? 2 : 0);
    const scoreB = roomQualityScore(b) + (preferred && b.platform === preferred ? 2 : 0);
    return scoreB - scoreA || left.index - right.index;
  });
  return list.map(({ room }) => room);
}

module.exports = { roomQualityScore, rankRoomsByPreferredPlatform };
