"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeConversion } = require("../providers/revenue-ledger");

test("classifies Chaturbate RevShare purchase as primary revenue", () => {
  const c = normalizeConversion({ transaction_id:"tx-1", type:"revshare_purchase", payout:"3.25", currency:"usd", click_id:"ncf_click" });
  assert.equal(c.revenueClass, "revshare"); assert.equal(c.payout, 3.25); assert.equal(c.currency, "USD");
});
test("keeps broadcaster and affiliate referral income separate", () => {
  assert.equal(normalizeConversion({transaction_id:"tx-2",type:"broadcaster_signup",payout:"50"}).revenueClass,"broadcaster_referral");
  assert.equal(normalizeConversion({transaction_id:"tx-3",type:"affiliate_referral_income",payout:"1"}).revenueClass,"affiliate_referral");
});
test("requires transaction id for safe deduplication", () => {
  assert.throws(() => normalizeConversion({type:"revshare_purchase"}), {statusCode:400});
});