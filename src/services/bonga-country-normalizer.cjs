"use strict";

const { normalizeCountryCode } = require("./country-directory.cjs");

function normalizeBongaCountry(room) {
  if (!room || typeof room !== "object" || Array.isArray(room)) return "";

  // Prefer provider fields that explicitly represent a country.
  for (const field of ["homecountry", "country", "country_code"]) {
    const code = normalizeCountryCode(room[field]);
    if (code) return code;
  }

  // Some Bonga rows provide a hometown instead of a country. Accept only an
  // exact country name/code, or an explicit final comma-delimited country
  // component such as "Nairobi, Kenya". Never infer a country from a city.
  const hometown = typeof room.hometown === "string" ? room.hometown.trim() : "";
  if (!hometown) return "";
  const exact = normalizeCountryCode(hometown);
  if (exact) return exact;

  const components = hometown.split(",").map((part) => part.trim()).filter(Boolean);
  if (components.length < 2) return "";
  return normalizeCountryCode(components[components.length - 1]);
}

module.exports = { normalizeBongaCountry };
