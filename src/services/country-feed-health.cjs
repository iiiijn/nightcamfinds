"use strict";

const { isValidCountryRoom } = require("./country-directory.cjs");

const PROVIDERS = ["chaturbate", "bongacams"];

function normalizeProviderHealth(providerHealth = {}) {
  return Object.fromEntries(PROVIDERS.map((provider) => {
    const value = String(providerHealth[provider] || "unknown").toLowerCase();
    return [provider, ["available", "unavailable", "disabled"].includes(value) ? value : "unknown"];
  }));
}

function summarizeCountryFeedHealth({
  countries = [],
  providerHealth = {},
  rooms = [],
  refreshedAt = null,
  minimumRooms = 10
} = {}) {
  const providers = normalizeProviderHealth(providerHealth);
  const states = Object.values(providers);
  const available = states.filter((state) => state === "available").length;
  const unavailable = states.filter((state) => state === "unavailable").length;
  const enabled = states.filter((state) => state !== "disabled").length;
  const feedHealth = available === enabled && enabled > 0
    ? "healthy"
    : available > 0
      ? "partial"
      : unavailable > 0
        ? "unavailable"
        : "unknown";

  const countryDefinitions = Array.isArray(countries) ? countries : [];
  const sourceRooms = Array.isArray(rooms) ? rooms : [];
  const rows = countryDefinitions.map((country) => {
    const code = String(country.code || "").trim().toUpperCase();
    const name = String(country.name || code || country.slug || "Unknown").trim();
    const matching = sourceRooms.filter((room) => String(room.country || "").toUpperCase() === code);
    const unique = new Map();
    for (const room of matching) {
      if (isValidCountryRoom(room)) unique.set(String(room.id).trim(), room);
    }
    const qualifyingRoomCount = unique.size;
    const platformCounts = Object.fromEntries(PROVIDERS.map((provider) => [
      provider,
      [...unique.values()].filter((room) => room.platform === provider).length
    ]));
    const supplyStatus = qualifyingRoomCount === 0
      ? "empty"
      : qualifyingRoomCount < minimumRooms
        ? "thin"
        : "adequate";
    return {
      code,
      name,
      slug: String(country.slug || "").trim(),
      feedHealth,
      supplyStatus,
      roomCount: matching.length,
      qualifyingRoomCount,
      platformCounts,
      indexable: qualifyingRoomCount >= minimumRooms
    };
  }).filter((country) => country.code).sort((a, b) => a.name.localeCompare(b.name));

  return {
    feedHealth,
    providers,
    refreshedAt: Number.isFinite(Number(refreshedAt)) && Number(refreshedAt) > 0
      ? new Date(Number(refreshedAt)).toISOString()
      : null,
    minimumRooms,
    totalCountries: rows.length,
    indexableCountries: rows.filter((country) => country.indexable).length,
    thinCountries: rows.filter((country) => country.supplyStatus === "thin").length,
    emptyCountries: rows.filter((country) => country.supplyStatus === "empty").length,
    countries: rows
  };
}

module.exports = { summarizeCountryFeedHealth, normalizeProviderHealth };
