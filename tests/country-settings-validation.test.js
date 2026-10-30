const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCountryPlatformPayload } = require("../src/services/country-settings-validation.cjs");

const valid = {
  country: "de",
  preferredPlatform: "BongaCams",
  hypothesis: "Unverified hypothesis: visitors may prefer this platform."
};

test("normalizes supported country and platform input", () => {
  const result = validateCountryPlatformPayload(valid);
  assert.deepEqual(result.value, {
    country: "DE",
    platform: "bongacams",
    action: "save_hypothesis",
    hypothesis: valid.hypothesis,
    status: "hypothesis"
  });
});

test("rejects unsupported countries and platforms", () => {
  assert.equal(validateCountryPlatformPayload({ ...valid, country: "KE" }).error, "Unsupported country.");
  assert.equal(validateCountryPlatformPayload({ ...valid, preferredPlatform: "unknown" }).error, "Choose a supported platform.");
});

test("rejects empty hypotheses and unsupported actions", () => {
  assert.equal(validateCountryPlatformPayload({ ...valid, hypothesis: "  " }).error, "Add a clearly labelled hypothesis before saving.");
  assert.equal(validateCountryPlatformPayload({ ...valid, action: "delete" }).error, "Unsupported settings action.");
});

test("requires explicit approval confirmation", () => {
  assert.equal(validateCountryPlatformPayload({ ...valid, action: "approve" }).error, "Explicit approval confirmation is required.");
  const approved = validateCountryPlatformPayload({ ...valid, action: "approve", confirmApproval: true });
  assert.equal(approved.value.status, "approved");
  assert.equal(approved.value.action, "approve");
});

test("caps the stored hypothesis length", () => {
  const result = validateCountryPlatformPayload({ ...valid, hypothesis: "x".repeat(1500) });
  assert.equal(result.value.hypothesis.length, 1200);
});
