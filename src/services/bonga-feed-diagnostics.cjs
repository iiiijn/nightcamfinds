"use strict";

const SAFE_FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const VALUE_FIELDS = ["gender", "sex", "homecountry", "country", "country_code"];
function valueType(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? typeof value : "other";
}
function summarizeBongaRawFields(rows, sampleLimit = 25) {
  const sample = Array.isArray(rows) ? rows.slice(0, Math.max(0, Math.min(100, sampleLimit))) : [];
  const fields = new Map();
  for (const row of sample) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    for (const [name, value] of Object.entries(row)) {
      if (!SAFE_FIELD_NAME.test(name)) continue;
      if (!fields.has(name)) fields.set(name, { name, presentCount: 0, types: {} });
      const entry = fields.get(name);
      entry.presentCount += 1;
      const type = valueType(value);
      entry.types[type] = (entry.types[type] || 0) + 1;
    }
  }
  return {
    basis: "raw_bongacams_payload_field_schema_only",
    sampledRows: sample.length,
    fields: [...fields.values()].sort((a, b) => a.name.localeCompare(b.name))
  };
}
function safeAggregateValue(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return null;
  return normalized.slice(0, 40);
}
function summarizeBongaFieldValues(rows, sampleLimit = 25, minCount = 2) {
  const sample = Array.isArray(rows) ? rows.slice(0, Math.max(0, Math.min(100, sampleLimit))) : [];
  const summaries = VALUE_FIELDS.map((field) => {
    const counts = new Map();
    let emptyOrNonScalar = 0;
    for (const row of sample) {
      if (!row || typeof row !== "object" || Array.isArray(row) || !Object.prototype.hasOwnProperty.call(row, field)) continue;
      const value = safeAggregateValue(row[field]);
      if (!value) { emptyOrNonScalar += 1; continue; }
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    const common = [...counts.entries()].filter(([, count]) => count >= minCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12).map(([value, count]) => ({ value, count }));
    const rareCount = [...counts.values()].filter((count) => count < minCount).reduce((sum, count) => sum + count, 0);
    return {
      field,
      presentCount: [...sample].filter((row) => row && typeof row === "object" && !Array.isArray(row) && Object.prototype.hasOwnProperty.call(row, field)).length,
      commonValues: common,
      suppressedRareValueCount: rareCount,
      emptyOrNonScalarCount: emptyOrNonScalar
    };
  }).filter((entry) => entry.presentCount > 0);
  return {
    basis: "aggregate_values_for_country_and_gender_fields_only",
    sampledRows: sample.length,
    minimumCountForValue: minCount,
    fields: summaries
  };
}

function summarizeBongaCountryCoverage(rows, normalizeCountry, minCount = 2) {
  const source = Array.isArray(rows) ? rows : [];
  const countries = new Map();
  const rawValues = new Map();
  let classifiedCount = 0;
  for (const row of source) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const code = typeof normalizeCountry === "function" ? normalizeCountry(row) : "";
    if (code) { classifiedCount += 1; countries.set(code, (countries.get(code) || 0) + 1); }
    for (const field of ["homecountry", "country", "country_code", "hometown"]) {
      const value = safeAggregateValue(row[field]);
      if (!value) continue;
      const key = field + ":" + value;
      rawValues.set(key, (rawValues.get(key) || 0) + 1);
    }
  }
  const commonRawCountryValues = [...rawValues.entries()].filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20)
    .map(([key, count]) => { const separator = key.indexOf(":"); return { field: key.slice(0, separator), value: key.slice(separator + 1), count }; });
  const suppressedRareValueCount = [...rawValues.values()].filter(count => count < minCount).reduce((sum, count) => sum + count, 0);
  return {
    basis: "full_raw_bongacams_feed_snapshot", totalRows: source.length, classifiedCount,
    unclassifiedCount: Math.max(0, source.length - classifiedCount),
    countryCounts: [...countries.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([country, count]) => ({ country, count })),
    commonRawCountryValues, suppressedRareValueCount, minimumCountForRawValue: minCount
  };
}

module.exports = { summarizeBongaRawFields, summarizeBongaFieldValues, summarizeBongaCountryCoverage };
