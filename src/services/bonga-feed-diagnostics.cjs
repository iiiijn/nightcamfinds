"use strict";

const SAFE_FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
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
module.exports = { summarizeBongaRawFields };
