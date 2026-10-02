import { productionMfaError } from "./mfa.js";

const STEP = 30;
const DIGITS = 6;

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(input || "").toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  let bits = "";
  for (const ch of clean) {
    const val = alphabet.indexOf(ch);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function generateMfaSecret() {
  return crypto.randomBytes(20).toString("hex");
}

export function totp(secret, at = Date.now()) {
  const counter = Math.floor(at / 1000 / STEP);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = Buffer.isBuffer(secret) ? secret : Buffer.from(String(secret), "hex");
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(code).padStart(DIGITS, "0");
}

export function verifyTotp(secret, code, at = Date.now()) {
  const given = String(code || "").trim();
  if (!/^\d{6}$/.test(given)) return false;
  return [-1, 0, 1].some((skew) => totp(secret, at + skew * STEP * 1000) === given);
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [algo, salt, hash] = String(stored || "").split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 32).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(next, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function productionGuard(env = process.env) {
  const errors = [];
  if (env.NODE_ENV !== "production") return errors;
  if ((env.DATABASE_PROVIDER || "postgres") !== "postgres") errors.push("production requires DATABASE_PROVIDER=postgres");
  if (!env.DATABASE_URL) errors.push("DATABASE_URL is required in production");
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 24 || env.SESSION_SECRET.includes("change-this")) {
    errors.push("SESSION_SECRET must be a non-default value of at least 24 characters");
  }
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD === "change-me" || env.ADMIN_PASSWORD.length < 12) {
    errors.push("ADMIN_PASSWORD must be changed from the development default and be at least 12 characters");
  }
  if (env.BONGACASH_ENABLED === "true" && !env.BONGACASH_API_BASE) {
    errors.push("BongaCash cannot be enabled without a verified API base");
  }
  if (env.BONGACASH_POSTBACKS === "true") {
    errors.push("BongaCash postbacks are REQUIRES_VERIFICATION and cannot be enabled");
  }
  if (env.CHATURBATE_ENABLED !== "false" && !env.CHATURBATE_WM) {
    errors.push("Chaturbate is enabled without CHATURBATE_WM");
  }
  if (!env.OWNER_MFA_SECRET || productionMfaError(env.OWNER_MFA_SECRET)) {
    errors.push(productionMfaError(env.OWNER_MFA_SECRET) || "OWNER_MFA_SECRET is required before production start");
  }
  return errors;
}

export { base32Decode };
