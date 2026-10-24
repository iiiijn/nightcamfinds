const test = require("node:test");
const assert = require("node:assert/strict");
const revshare = require("../affiliate/chaturbate-revshare");

test("recognizes the documented Chaturbate revenue event classes", () => {
  assert.equal(revshare.revenueClass("revshare_purchase"), "revshare");
  assert.equal(revshare.revenueClass("revshare_signup-referral"), "broadcaster_referral");
  assert.equal(revshare.revenueClass("revshare_payout-adjustment"), "revshare_adjustment");
  assert.equal(revshare.revenueClass("mystery"), "other");
});

test("normalizes the dynamic postback parameters and preserves the transaction ID", () => {
  const params = new URLSearchParams({ transaction_id:"cb-001", click_id:"ncf-001", type:"revshare_purchase", payout:"2.45", amount:"12.25", currency:"usd", country:"us", track:"x-male-home", source:"x", timestamp:"2026-10-24T19:00:00Z" });
  const c = revshare.normalize(params);
  assert.equal(c.transactionId,"cb-001"); assert.equal(c.clickId,"ncf-001");
  assert.equal(c.conversionType,"revshare_purchase"); assert.equal(c.payout,2.45);
  assert.equal(c.amount,12.25); assert.equal(c.currency,"USD"); assert.equal(c.country,"US");
});

test("uses a deterministic fallback transaction key only when the partner omits one", () => {
  const a = revshare.normalize(new URLSearchParams({type:"revshare_purchase",click_id:"c",timestamp:"2026-10-24",payout:"1"}));
  const b = revshare.normalize(new URLSearchParams({type:"revshare_purchase",click_id:"c",timestamp:"2026-10-24",payout:"1"}));
  assert.equal(a.transactionId,b.transactionId); assert.ok(a.transactionId.length > 10);
});

test("rejects malformed revenue values instead of silently treating them as zero", () => {
  assert.throws(() => revshare.normalize(new URLSearchParams({transaction_id:"t",type:"revshare_purchase",payout:"NaN"})), { statusCode: 400 });
});