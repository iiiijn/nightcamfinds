"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeConversion } = require("../providers/revenue-ledger");

test("classifies RevShare purchase and adjustments separately", () => {
 assert.equal(normalizeConversion({transaction_id:"tx1",type:"revshare_purchase",payout:"2.1"}).revenueClass,"revshare");
 assert.equal(normalizeConversion({transaction_id:"tx2",type:"revshare_payout-adjustment",payout:"-0.2"}).revenueClass,"revshare_adjustment");
});
test("separates broadcaster and affiliate referral revenue", () => {
 assert.equal(normalizeConversion({transaction_id:"tx3",type:"revshare_signup-referral",payout:"50"}).revenueClass,"broadcaster_referral");
 assert.equal(normalizeConversion({transaction_id:"tx4",type:"affiliate_referral_income",payout:"1"}).revenueClass,"affiliate_referral");
});
test("requires a partner transaction ID for safe deduplication", () => {
 assert.throws(() => normalizeConversion({type:"revshare_purchase"}),{statusCode:400});
});