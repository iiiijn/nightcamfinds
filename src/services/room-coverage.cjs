"use strict";

const { getDiscoveryRegion, normalizePartnerCountry } = require("./regional-discovery.cjs");
const { MARKET_PRIORITY_CODES } = require("../config/market-countries.cjs");

const CATEGORIES = Object.freeze(["female", "male", "trans", "couples"]);

function summarizeRoomCoverage(rooms, priorityCodes = MARKET_PRIORITY_CODES) {
  const rows = Array.isArray(rooms) ? rooms : [];
  const countries = new Map();
  const regions = new Map();
  const categories = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  let missingCountryRooms = 0;
  let uncategorizedRooms = 0;

  for (const room of rows) {
    const country = normalizePartnerCountry(room && room.country);
    const region = getDiscoveryRegion({
      country,
      partnerRegion: room && room.partnerRegion,
      apiRegion: room && room.apiRegion
    });
    const category = String(room && room.gender || "").trim().toLowerCase();
    const validCategory = CATEGORIES.includes(category) ? category : "";

    if (!country) missingCountryRooms += 1;
    if (!validCategory) uncategorizedRooms += 1;
    else categories[validCategory] += 1;

    if (!regions.has(region)) regions.set(region, { region, roomCount: 0, categories: Object.fromEntries(CATEGORIES.map((key) => [key, 0])) });
    const regionRow = regions.get(region);
    regionRow.roomCount += 1;
    if (validCategory) regionRow.categories[validCategory] += 1;

    if (country) {
      if (!countries.has(country)) countries.set(country, { country, roomCount: 0, categories: Object.fromEntries(CATEGORIES.map((key) => [key, 0])) });
      const countryRow = countries.get(country);
      countryRow.roomCount += 1;
      if (validCategory) countryRow.categories[validCategory] += 1;
    }
  }

  const sortRows = (a, b) => b.roomCount - a.roomCount || a.country.localeCompare(b.country);
  const countryRows = [...countries.values()].sort(sortRows);
  const priority = [...new Set((Array.isArray(priorityCodes) ? priorityCodes : []).map(normalizePartnerCountry).filter(Boolean))];
  const priorityMarkets = priority.map((country) => countries.get(country) || {
    country, roomCount: 0, categories: Object.fromEntries(CATEGORIES.map((key) => [key, 0]))
  });

  return {
    totalRooms: rows.length,
    countryReportedRooms: rows.length - missingCountryRooms,
    missingCountryRooms,
    uncategorizedRooms,
    categories,
    regions: [...regions.values()].sort((a, b) => b.roomCount - a.roomCount || a.region.localeCompare(b.region)),
    countries: countryRows,
    priorityMarkets: priorityMarkets.sort(sortRows)
  };
}

module.exports = { CATEGORIES, summarizeRoomCoverage };
