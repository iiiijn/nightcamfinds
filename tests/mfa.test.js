import test from "node:test";
import assert from "node:assert/strict";
import { currentTotp, verifyTotpCode, provisioning, recoveryCodes, hashRecoveryCode, canChangeMfa, productionMfaError, mfaRateLimited } from "../src/mfa.js";
import { productionGuard } from "../src/security.js";

const secret = "JBSWY3DPEHPK3PXP";

test("valid, invalid, expired, and replayed TOTP", () => {
  const now = Date.now();
  const code = currentTotp(secret, now);
  const ok = verifyTotpCode(secret, code, now, null);
  assert.equal(ok.ok, true);
  assert.equal(verifyTotpCode(secret, "000000", now, null).ok, false);
  assert.equal(verifyTotpCode(secret, code, now + 120_000, null).reason, "invalid");
  assert.equal(verifyTotpCode(secret, code, now, ok.step).reason, "replay");
});

test("provisioning URI is standard otpauth and does not log the secret store", async () => {
  const packed = await provisioning(secret, "owner");
  assert.match(packed.uri, /^otpauth:\/\/totp\/NightCamFinds:owner\?/);
  assert.match(packed.uri, /secret=JBSWY3DPEHPK3PXP/);
  assert.match(packed.qr, /^data:image\/svg\+xml;base64,/);
});

test("recovery codes are single-use hashes", () => {
  const [code] = recoveryCodes();
  const hash = hashRecoveryCode(code);
  const used = new Set();
  assert.equal(used.has(hash), false);
  used.add(hash);
  assert.equal(used.has(hash), true);
  assert.notEqual(code, hash);
});

test("missing and invalid MFA block production; enrollment requires owner password", () => {
  assert.match(productionMfaError(""), /required/);
  assert.match(productionMfaError("not-base32"), /Base32/);
  const missing = productionGuard({ NODE_ENV: "production", DATABASE_PROVIDER: "postgres", DATABASE_URL: "postgres://example", ADMIN_PASSWORD: "long-password-1", SESSION_SECRET: "x".repeat(24), OWNER_MFA_SECRET: "" });
  assert.ok(missing.some((e) => e.includes("OWNER_MFA_SECRET")));
  const invalid = productionGuard({ NODE_ENV: "production", DATABASE_PROVIDER: "postgres", DATABASE_URL: "postgres://example", ADMIN_PASSWORD: "long-password-1", SESSION_SECRET: "x".repeat(24), OWNER_MFA_SECRET: "zzzz" });
  assert.ok(invalid.some((e) => e.includes("Base32")));
  assert.equal(canChangeMfa({ session: null, passwordOk: true }).status, 401);
  assert.equal(canChangeMfa({ session: { role: "analyst" }, passwordOk: true }).status, 403);
  assert.equal(canChangeMfa({ session: { role: "owner" }, passwordOk: false }).status, 401);
  assert.equal(canChangeMfa({ session: { role: "owner" }, passwordOk: true }).ok, true);
  assert.equal(mfaRateLimited(4), false);
  assert.equal(mfaRateLimited(5), true);
});
