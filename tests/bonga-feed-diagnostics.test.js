"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeBongaRawFields } = require("../src/services/bonga-feed-diagnostics.cjs");

test("Bonga diagnostics expose field names and value types without raw values", () => {
  const result = summarizeBongaRawFields([
    { homecountry: "US", gender: "male", members_count: 12, profile_images: { profile_image: "https://private.example/image" }, username: "private-model" },
    { homecountry: "Germany", gender: null, members_count: "8", secret_value: true }
  ]);
  assert.equal(result.basis, "raw_bongacams_payload_field_schema_only");
  assert.equal(result.sampledRows, 2);
  const fields = Object.fromEntries(result.fields.map(field => [field.name, field]));
  assert.deepEqual(fields.homecountry.types, { string: 2 });
  assert.deepEqual(fields.gender.types, { string: 1, null: 1 });
  assert.deepEqual(fields.members_count.types, { number: 1, string: 1 });
  assert.ok(!JSON.stringify(result).includes("private-model"));
  assert.ok(!JSON.stringify(result).includes("private.example"));
  assert.ok(!JSON.stringify(result).includes("Germany"));
});

test("Bonga diagnostics cap samples and reject unsafe field names", () => {
  const rows = Array.from({ length: 120 }, () => ({ safe_field: "value", "unsafe-field": "hidden" }));
  const result = summarizeBongaRawFields(rows);
  assert.equal(result.sampledRows, 25);
  assert.deepEqual(result.fields.map(field => field.name), ["safe_field"]);
});
