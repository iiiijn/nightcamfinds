"use strict";

const CATEGORIES = Object.freeze(["female", "male", "trans", "couples"]);
const PROVIDERS = Object.freeze(["chaturbate", "bongacams"]);

function summarizeProviderFeedQuality(rooms) {
  const rows = Array.isArray(rooms) ? rooms : [];
  return PROVIDERS.map((provider) => {
    const providerRooms = rows.filter((room) => room && room.platform === provider);
    const categories = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
    const countries = {};
    const regions = {};
    let missingCountry = 0;
    let missingCategory = 0;

    for (const room of providerRooms) {
      const country = String(room.country || "").trim().toUpperCase();
      const category = String(room.gender || "").trim().toLowerCase();
      const region = String(room.region || room.apiRegion || "unassigned").trim() || "unassigned";

      if (/^[A-Z]{2}$/.test(country)) countries[country] = (countries[country] || 0) + 1;
      else missingCountry += 1;

      if (CATEGORIES.includes(category)) categories[category] += 1;
      else missingCategory += 1;

      regions[region] = (regions[region] || 0) + 1;
    }

    const totalRooms = providerRooms.length;
    return {
      provider,
      totalRooms,
      missingCountry,
      missingCountryPercent: totalRooms ? Number((missingCountry / totalRooms * 100).toFixed(1)) : 0,
      missingCategory,
      missingCategoryPercent: totalRooms ? Number((missingCategory / totalRooms * 100).toFixed(1)) : 0,
      categories,
      countries: Object.entries(countries).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([country, roomCount]) => ({ country, roomCount })),
      regions: Object.entries(regions).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([region, roomCount]) => ({ region, roomCount }))
    };
  });
}


/**
 * Summarize feed ingestion without retaining or logging raw room payloads.
 * Entries are the normalization results paired with their raw feed rows.
 */
function summarizeFeedIngestion({ provider, rawRows, entries, pagination } = {}) {
  const raw = Array.isArray(rawRows) ? rawRows : [];
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const rooms = normalizedEntries.map((entry) => entry && entry.normalized).filter(Boolean);
  const countMissing = (field) => rooms.filter((room) => !String(room && room[field] || "").trim()).length;
  const safePagination = pagination && typeof pagination === "object" ? {
    pagesFetched: Number.isFinite(pagination.pagesFetched) ? pagination.pagesFetched : null,
    receivedCount: Number.isFinite(pagination.receivedCount) ? pagination.receivedCount : raw.length,
    uniqueCount: Number.isFinite(pagination.uniqueCount) ? pagination.uniqueCount : null,
    duplicateCount: Number.isFinite(pagination.duplicateCount) ? pagination.duplicateCount : null,
    truncated: Boolean(pagination.truncated),
    stopReason: typeof pagination.stopReason === "string" ? pagination.stopReason.slice(0, 40) : "unknown",
    pageSize: Number.isFinite(pagination.pageSize) ? pagination.pageSize : null,
    maxPages: Number.isFinite(pagination.maxPages) ? pagination.maxPages : null
  } : null;
  return {
    provider: PROVIDERS.includes(provider) ? provider : "unknown",
    rawCount: raw.length,
    normalizedCount: rooms.length,
    rejectedCount: Math.max(0, raw.length - rooms.length),
    missingCountry: countMissing("country"),
    missingCategory: countMissing("gender"),
    pagination: safePagination
  };
}

module.exports = { CATEGORIES, PROVIDERS, summarizeProviderFeedQuality, summarizeFeedIngestion };
