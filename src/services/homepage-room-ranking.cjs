"use strict";

const { rankRoomsByPreferredPlatform } = require("./platform-ranking.cjs");

const DEFAULT_CATEGORIES = ["female", "male", "trans", "couples"];
const DEFAULT_LIMIT = 8;

function buildTopRoomsByProviderCategory(rooms, options = {}) {
  const categories = Array.isArray(options.categories) ? options.categories : DEFAULT_CATEGORIES;
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : DEFAULT_LIMIT;
  const providers = ["chaturbate", "bongacams"];
  const result = Object.fromEntries(providers.map(provider => [provider, {}]));
  const source = Array.isArray(rooms) ? rooms : [];

  for (const provider of providers) {
    for (const category of categories) {
      const eligible = source.filter(room =>
        room &&
        room.isLive === true &&
        room.platform === provider &&
        String(room.gender || "").toLowerCase() === category &&
        Number.isFinite(Number(room.viewerCount)) &&
        Number(room.viewerCount) >= 0
      );
      result[provider][category] = rankRoomsByPreferredPlatform(eligible, null, "recommended").slice(0, limit);
    }
  }
  return result;
}

module.exports = { buildTopRoomsByProviderCategory, DEFAULT_CATEGORIES, DEFAULT_LIMIT };
