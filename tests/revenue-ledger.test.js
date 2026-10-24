"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeConversion } = require("../providers/revenue-ledger");

test("classifies Chaturbate RevShare purchase as primary revenue", () => {
  const c = normalizeConversion({ transaction_id:"tx-1", type:"revshare_purchase", payout:"3.25", currency:"usd", click_id:"ncf_click" });
  assert.equal(c.revenueClass, "revshare"); assert.equal(c.payout, 3.25); assert.equal(c.currency, "USD");
});

test("keeps referral revenue separate from RevShare", () => {
  const broadcaster = normalizeConversion({ transaction_id:"tx-2", type:"broadcaster_signup", payout:"50" });
  const affiliate = normalizeConversion({ transaction_id:"tx-3", type:"affiliate_referral_income", payout:"1.25" });
  assert.equal(broadcaster.revenueClass, "broadcaster_referral"); assert.equal(affiliate.revenueClass, "affiliate_referral");
});

test("requires a transaction id to deduplicate safely", () => {
  assert.throws(() => normalizeConversion({ type:"revshare_purchase", payout:"2" }), { statusCode:400 });
});

test("preserves unmatched click IDs instead of inventing attribution", () => {
  const c = normalizeConversion({ transaction_id:"tx-4", type:"revshare_purchase", click_id:"unknown-click" });
  assert.equal(c.clickId, "unknown-click"); assert.equal(c.revenueClass, "revshare");
});