import { chaturbateDestination } from "../adapters/chaturbate.js";
import { bongaCashDestination } from "../adapters/bongacash.js";
import crypto from "node:crypto";

const ALLOWED_DOMAINS = new Set(["chaturbate.com", "www.chaturbate.com", "bongacams.com", "www.bongacams.com"]);

export function newClickId() {
  return crypto.randomBytes(16).toString("hex");
}

export function resolveDestination(room, link) {
  if (!room) return { ok: false, reason: "room not found" };
  if (link && (link.status === "Disabled" || link.status === "Expired" || link.status === "Archived")) {
    return { ok: false, reason: "link disabled or expired" };
  }
  if (link && link.verificationStatus !== "Verified" && room.provider !== "chaturbate") {
    return { ok: false, reason: "destination not verified" };
  }
  if (room.provider === "chaturbate") return chaturbateDestination(room, null);
  if (room.provider === "bongacash") return bongaCashDestination(room);
  return { ok: false, reason: "unknown provider" };
}

export function buildRedirect(room, clickId, link) {
  const dest = resolveDestination(room, link);
  if (!dest.ok) return dest;
  if (!ALLOWED_DOMAINS.has(dest.domain)) return { ok: false, reason: "domain not allowlisted" };
  const url = new URL(dest.url);
  url.searchParams.set("click_id", clickId);
  if ([...url.searchParams.keys()].some((k) => !["click_id", "tour", "campaign", "room", "track", "c", "csurl"].includes(k) && k.startsWith("redirect"))) {
    return { ok: false, reason: "unexpected redirect parameter" };
  }
  return { ok: true, url: url.toString(), domain: dest.domain };
}

export function isOpenRedirect(input) {
  if (!input) return true;
  try {
    const url = new URL(input);
    return !ALLOWED_DOMAINS.has(url.hostname);
  } catch {
    return true;
  }
}
