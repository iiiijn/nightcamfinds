import test from "node:test";
import assert from "node:assert/strict";
import {
  countryTier,
  normalizeChaturbatePostback,
  buildChaturbateUrl
} from "../src/services/chaturbate-revshare.cjs";

test("maps Chaturbate signup tiers using current affiliate appendix country codes", () => {
  assert.equal(countryTier("US").tier, 1);
  assert.equal(countryTier("BR").tier, 2);
  assert.equal(countryTier("PL").tier, 3);
  assert.equal(countryTier("KE").tier, null);
});

test("accepts a documented RevShare purchase and preserves its actual payout", () => {
  const result = normalizeChaturbatePostback({
    click_id: "ncf_abc123",
    transaction_id: "tx-100",
    type: "revshare_purchase",
    payout: "2.50",
    amount: "12.50",
    currency: "USD",
    country: "US"
  });
  assert.equal(result.ok, true);
  assert.equal(result.event.type, "revshare_purchase");
  assert.equal(result.event.payout, 2.5);
  assert.equal(result.event.amount, 12.5);
});

test("accepts negative payout adjustment and rejects unsupported or unidentifiable events", () => {
  const adjustment = normalizeChaturbatePostback({
    click_id: "ncf_abc123",
    transaction_id: "tx-adjust",
    type: "revshare_payout-adjustment",
    payout: "-1.25"
  });
  assert.equal(adjustment.ok, true);
  assert.equal(adjustment.event.payout, -1.25);
  assert.equal(normalizeChaturbatePostback({ click_id: "c", type: "purchase", payout: "2" }).reason, "unsupported_event_type");
  assert.equal(normalizeChaturbatePostback({ transaction_id: "tx", type: "revshare_purchase", payout: "2" }).reason, "missing_click_id");
  assert.equal(normalizeChaturbatePostback({ click_id: "c", type: "revshare_purchase", payout: "2" }).reason, "missing_transaction_id");
  assert.equal(normalizeChaturbatePostback({ click_id: "c", transaction_id: "tx", type: "revshare_purchase", payout: "NaN" }).reason, "missing_or_invalid_payout");
});

test("affiliate URLs preserve the campaign ID and pass a stable track plus unique click ID", () => {
  const result = buildChaturbateUrl({
    roomUrl: "https://chaturbate.com/in/?tour=uhEc&campaign=WRONG",
    campaign: "C6yxN",
    tour: "uhEc",
    track: "female-room-card",
    clickId: "ncf_unique_123",
    source: "x",
    utmCampaign: "october-test"
  });
  assert.equal(result.ok, true);
  const url = new URL(result.url);
  assert.equal(url.searchParams.get("campaign"), "C6yxN");
  assert.equal(url.searchParams.get("tour"), "uhEc");
  assert.equal(url.searchParams.get("track"), "female-room-card");
  assert.equal(url.searchParams.get("click_id"), "ncf_unique_123");
  assert.equal(url.searchParams.get("sid"), "ncf_unique_123");
  assert.equal(url.searchParams.get("source"), "x");
  assert.equal(url.searchParams.get("utm_campaign"), "october-test");
});

test("affiliate destination helper rejects untrusted room URLs and missing click IDs", () => {
  assert.equal(buildChaturbateUrl({
    roomUrl: "https://evil.example/in/",
    campaign: "C6yxN",
    tour: "uhEc",
    clickId: "x"
  }).ok, false);
  assert.equal(buildChaturbateUrl({ campaign: "C6yxN", tour: "uhEc" }).ok, false);
});
