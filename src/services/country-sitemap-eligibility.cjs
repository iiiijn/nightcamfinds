"use strict";

const { isValidCountryRoom, normalizeCountryCode } = require("./country-directory.cjs");

const MINIMUM_INDEXABLE_COUNTRY_ROOMS = 10;
const MIN_WORDS_BY_TIER = Object.freeze({
  "Tier 1": 100,
  "Tier 2": 100,
  "Tier 3": 180
});

function countCountryContentWords(country) {
  if (!country || typeof country !== "object") return 0;
  const parts = [country.name, country.intro];
  if (Array.isArray(country.paragraphs)) parts.push(...country.paragraphs);
  if (Array.isArray(country.faqs)) {
    for (const faq of country.faqs) {
      if (Array.isArray(faq)) parts.push(...faq);
    }
  }
  return parts.filter((part) => typeof part === "string")
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function countIndexableCountryRooms(rooms = []) {
  const uniqueByCountry = new Map();
  for (const room of Array.isArray(rooms) ? rooms : []) {
    if (!isValidCountryRoom(room)) continue;
    const countryCode = normalizeCountryCode(room.country).toLowerCase();
    if (!countryCode) continue;
    if (!uniqueByCountry.has(countryCode)) uniqueByCountry.set(countryCode, new Set());
    uniqueByCountry.get(countryCode).add(String(room.id).trim());
  }
  return uniqueByCountry;
}

function getEligibleCountrySitemapSlugs({ marketMeta = {}, countryContent = {}, rooms = [] } = {}) {
  const roomIdsByCountry = countIndexableCountryRooms(rooms);
  return Object.keys(marketMeta)
    .map((slug) => String(slug).toLowerCase())
    .filter((slug) => {
      if (!/^[a-z]{2}$/.test(slug)) return false;
      const priority = marketMeta[slug] && marketMeta[slug].priority;
      const minimumWords = MIN_WORDS_BY_TIER[priority];
      if (!minimumWords) return false;
      const qualifyingRoomCount = roomIdsByCountry.get(slug)?.size || 0;
      if (qualifyingRoomCount < MINIMUM_INDEXABLE_COUNTRY_ROOMS) return false;
      return countCountryContentWords(countryContent[slug]) >= minimumWords;
    })
    .sort();
}

module.exports = {
  countCountryContentWords,
  countIndexableCountryRooms,
  getEligibleCountrySitemapSlugs,
  MINIMUM_INDEXABLE_COUNTRY_ROOMS,
  MIN_WORDS_BY_TIER
};
