import test from "node:test";
import assert from "node:assert/strict";
import {
  countryTier,
  normalizeChaturbatePostback,
  buildChaturbateUrl,
  removePostbackSecrets,
  sameChaturbateTransaction
} from "../src/services/chaturbate-revshare.cjs";

test("maps affiliate country tiers without treating Kenya as a paid tier", () => {
  assert.equal(countryTier("US").tier, 1);
  assert.equal(countryTier("BR").tier, 2);
  assert.equal(countryTier("PL").tier, 3);
  assert.equal(countryTier("KE").tier, null);
});

test("accepts a RevShare purchase and preserves the actual payout", () => {
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

test("accepts the campaign macro used by Chaturbate dynamic postbacks", () => {
  const result = normalizeChaturbatePostback({
    click_id: "ncf_abc123",
    transaction_id: "tx-campaign",
    type: "revshare_purchase",
    payout: "2.50",
    amount: "12.50",
    currency: "USD",
    country: "US",
    campaign: "nightcam-tier-one",
    source: "x",
    track: "nightcamfinds"
  });
  assert.equal(result.ok, true);
  assert.equal(result.event.campaignId, "nightcam-tier-one");
  assert.equal(result.event.source, "x");
  assert.equal(result.event.track, "nightcamfinds");
});

test("prefers campaign_id when both campaign fields are present", () => {
  const result = normalizeChaturbatePostback({
    click_id: "ncf_abc123",
    transaction_id: "tx-campaign-precedence",
    type: "revshare_purchase",
    payout: "1",
    campaign_id: "canonical-id",
    campaign: "fallback-name"
  });
  assert.equal(result.ok, true);
  assert.equal(result.event.campaignId, "canonical-id");
});

test("accepts negative payout adjustments and rejects malformed events", () => {
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

test("affiliate URLs preserve campaign, stable track and unique click ID", () => {
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

test("accepts every documented Chaturbate conversion type with an explicit payout and currency", () => {
  const types = [
    "tokens_signup-referral",
    "tokens_broadcaster-referral",
    "ppr_signup-referral",
    "ppr_broadcaster-referral",
    "revshare_signup-referral",
    "revshare_broadcaster-referral",
    "revshare_purchase",
    "revshare_webmaster-commission",
    "revshare_payout-adjustment"
  ];
  for (const [index, type] of types.entries()) {
    const result = normalizeChaturbatePostback({
      click_id: `ncf_click_${index}`,
      transaction_id: `tx_${index}`,
      type,
      payout: index === 8 ? "-0.25" : "0.75",
      currency: "USD"
    });
    assert.equal(result.ok, true, type);
    assert.equal(result.event.type, type);
    assert.equal(result.event.currency, "USD");
    assert.equal(result.event.payout, index === 8 ? -0.25 : 0.75);
  }
});

test("rejects identifiers that would be truncated into ambiguous database keys", () => {
  const base = { click_id: "click", transaction_id: "tx", type: "revshare_purchase", payout: "1.25" };
  assert.equal(normalizeChaturbatePostback({ ...base, click_id: "x".repeat(129) }).reason, "click_id_too_long");
  assert.equal(normalizeChaturbatePostback({ ...base, transaction_id: "x".repeat(256) }).reason, "transaction_id_too_long");
  assert.equal(normalizeChaturbatePostback({ ...base, click_id: "bad\nclick" }).reason, "invalid_click_id");
});

test("removes callback authentication material before storing raw payloads", () => {
  const cleaned = removePostbackSecrets({ click_id: "c", secret: "private", checksum: "sig", validation_token: "token", payout: "1" });
  assert.deepEqual(cleaned, { click_id: "c", payout: "1" });
});

test("treats exact transaction retries as idempotent but rejects conflicting reuse", () => {
  const stored = { click_id: "click-1", conversion_type: "revshare_purchase", payout: "1.250000", currency: "USD" };
  assert.equal(sameChaturbateTransaction(stored, { click_id: "click-1", type: "revshare_purchase", payout: 1.25, currency: "usd" }), true);
  assert.equal(sameChaturbateTransaction(stored, { click_id: "click-2", type: "revshare_purchase", payout: 1.25, currency: "USD" }), false);
  assert.equal(sameChaturbateTransaction(stored, { click_id: "click-1", type: "revshare_purchase", payout: 2, currency: "USD" }), false);
});
