import test from "node:test";
import assert from "node:assert/strict";
import { productionGuard } from "../src/security.js";
import { createProviderCache } from "../src/services/cache.js";
import { classifyPostback } from "../src/services/postbacks.js";
import { buildRedirect, isOpenRedirect } from "../src/services/affiliate.js";
import { validateChaturbatePayload } from "../src/adapters/chaturbate.js";

test("production refuses insecure defaults and json store", () => {
  const errors = productionGuard({
    NODE_ENV: "production",
    DATABASE_PROVIDER: "json",
    ADMIN_PASSWORD: "change-me",
    SESSION_SECRET: "short",
    BONGACASH_POSTBACKS: "true",
    OWNER_MFA_SECRET: ""
  });
  assert.ok(errors.length >= 3);
});

test("provider caches stay isolated and expire", () => {
  const cache = createProviderCache();
  const now = Date.now();
  cache.put("chaturbate", [{ id: "c", provider: "chaturbate", isLive: true }], now);
  cache.put("bongacash", [{ id: "b", provider: "bongacash", isLive: true }], now - 11 * 60 * 1000);
  const live = cache.live();
  assert.deepEqual(live.map((r) => r.id), ["c"]);
  assert.equal(cache.get("bongacash", now).state, "EXPIRED");
});

test("postback cases do not double-confirm", () => {
  assert.equal(classifyPostback({ provider: "chaturbate", known: { transaction_id: "t", click_id: "c", payout: "2", type: "purchase" }, clickExists: true }).state, "Confirmed");
  assert.equal(classifyPostback({ provider: "chaturbate", known: { transaction_id: "t", click_id: "c", payout: "2" }, duplicate: true }).status, "duplicate");
  assert.equal(classifyPostback({ provider: "chaturbate", known: { type: "mystery" } }).status, "rejected");
  assert.equal(classifyPostback({ provider: "chaturbate", known: { transaction_id: "x" }, clickExists: false }).status, "unmatched");
  assert.equal(classifyPostback({ provider: "bongacash", known: { click_id: "1" } }).status, "rejected");
});

test("open redirect and disabled link are rejected", () => {
  assert.equal(isOpenRedirect("https://evil.example/go"), true);
  const blocked = buildRedirect({ provider: "chaturbate", roomUrl: "https://chaturbate.com/in/?tour=x" }, "abc", { status: "Disabled", verificationStatus: "Verified" });
  assert.equal(blocked.ok, false);
  assert.equal(validateChaturbatePayload({ nope: true }).ok, false);
});
