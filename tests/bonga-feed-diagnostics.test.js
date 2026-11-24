"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeBongaRawFields, summarizeBongaFieldValues, summarizeBongaCountryCoverage } = require("../src/services/bonga-feed-diagnostics.cjs");
const { normalizeBongaCountry } = require("../src/services/bonga-country-normalizer.cjs");

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

test("Bonga value diagnostics aggregate only country and gender fields", () => {
  const rows = [
    { username: "private-one", gender: "Female", homecountry: "United States", chat_topic: "private topic" },
    { username: "private-two", gender: "female", homecountry: "United States", chat_topic: "another private topic" },
    { username: "private-three", gender: "male", homecountry: "US", chat_topic: "hidden" },
    { username: "private-four", gender: "male", homecountry: "US", chat_topic: "hidden" },
    { username: "private-five", gender: "rare-value", homecountry: "Rareland", chat_topic: "hidden" }
  ];
  const result = summarizeBongaFieldValues(rows);
  const fields = Object.fromEntries(result.fields.map(field => [field.field, field]));
  assert.deepEqual(fields.gender.commonValues, [{ value: "female", count: 2 }, { value: "male", count: 2 }]);
  assert.deepEqual(fields.homecountry.commonValues, [{ value: "united states", count: 2 }, { value: "us", count: 2 }]);
  assert.equal(fields.gender.suppressedRareValueCount, 1);
  assert.equal(fields.homecountry.suppressedRareValueCount, 1);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("private-one"));
  assert.ok(!serialized.includes("private topic"));
  assert.ok(!serialized.includes("rareland"));
  assert.ok(!serialized.includes("rare-value"));
  assert.ok(!serialized.includes("username"));
  assert.ok(!serialized.includes("chat_topic"));
});


test("Bonga country coverage counts the full feed and suppresses rare raw values", () => {
  const rows = [
    { homecountry: "US", username: "private-a" }, { homecountry: "US", username: "private-b" },
    { hometown: "Nairobi, Kenya", username: "private-c" }, { hometown: "Nairobi, Kenya", username: "private-d" },
    { hometown: "Nairobi", username: "private-e" }, { homecountry: "Rareland", username: "private-f" }
  ];
  const result = summarizeBongaCountryCoverage(rows, normalizeBongaCountry);
  assert.equal(result.totalRows, 6);
  assert.equal(result.classifiedCount, 4);
  assert.equal(result.unclassifiedCount, 2);
  assert.deepEqual(result.countryCounts, [{ country: "KE", count: 2 }, { country: "US", count: 2 }]);
  assert.deepEqual(result.commonRawCountryValues, [
    { field: "homecountry", value: "us", count: 2 },
    { field: "hometown", value: "kenya", count: 2 }
  ]);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("private-a"));
  assert.ok(!serialized.includes("rareland"));
  assert.ok(!serialized.includes("nairobi"));
});
