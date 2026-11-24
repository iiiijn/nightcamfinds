import crypto from "node:crypto";
import { createRequire } from "node:module";
import * as OTPAuth from "../vendor/otpauth/dist/otpauth.esm.js";

const require = createRequire(import.meta.url);
const QRCore = require("../vendor/qrcode/lib/core/qrcode.js");
const svgRenderer = require("../vendor/qrcode/lib/renderer/svg-tag.js");

const BASE32 = /^[A-Z2-7]{16,}$/;

export function isValidBase32Secret(value) {
  return BASE32.test(String(value || "").replace(/=+$/g, "").toUpperCase());
}

export function totpClient(secret, label = "owner") {
  return new OTPAuth.TOTP({
    issuer: "NightCamFinds",
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  });
}

export function currentTotp(secret, at = Date.now()) {
  return totpClient(secret).generate({ timestamp: at });
}

export function verifyTotpCode(secret, code, at = Date.now(), lastStep = null) {
  if (!isValidBase32Secret(secret)) return { ok: false, reason: "invalid configuration" };
  const token = String(code || "").trim();
  if (!/^\d{6}$/.test(token)) return { ok: false, reason: "invalid" };
  const delta = totpClient(secret).validate({ token, timestamp: at, window: 1 });
  if (delta === null) return { ok: false, reason: "invalid" };
  const step = Math.floor(at / 1000 / 30) + delta;
  if (lastStep != null && step <= Number(lastStep)) return { ok: false, reason: "replay" };
  return { ok: true, step };
}

export async function provisioning(secret, label = "owner") {
  const uri = totpClient(secret, label).toString();
  const svg = svgRenderer.render(QRCore.create(uri, { errorCorrectionLevel: "M" }));
  const qr = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return { uri, qr };
}

export function recoveryCodes(count = 8) {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString("hex"));
}

export function hashRecoveryCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

export function mfaRateLimited(failures) {
  return failures >= 5;
}

export function canChangeMfa({ session, passwordOk }) {
  if (!session) return { ok: false, status: 401, error: "unauthorized" };
  if (session.role !== "owner") return { ok: false, status: 403, error: "forbidden" };
  if (!passwordOk) return { ok: false, status: 401, error: "password required" };
  return { ok: true };
}

export function productionMfaError(secret) {
  if (!secret) return "OWNER_MFA_SECRET is required before production start";
  if (!isValidBase32Secret(secret)) return "OWNER_MFA_SECRET must be a Base32 TOTP secret of at least 16 characters";
  return null;
}
