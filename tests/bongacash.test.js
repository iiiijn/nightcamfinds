import test from "node:test";
import assert from "node:assert/strict";
import { normalizePostback, normalizeType } from "../bongacash.js";

test("normalizes BongaCash purchase postbacks", () => {
  const params = new URLSearchParams({
    click_id: "ncf_bonga_123",
    transaction_id: "tx-100",
    type: "revshare",
    payout: "2.50",
    amount: "12.50",
    currency: "USD",
    country: "US",
    source: "x",
    track: "home-card"
  });
  const result = normalizePostback(params);
  assert.equal(result.ok, true);
  assert.equal(result.event.type, "purchase");
  assert.equal(result.event.payout, 2.5);
  assert.equal(result.event.amount, 12.5);
  assert.equal(result.event.clickId, "ncf_bonga_123");
});

test("normalizes refunds as negative net revenue", () => {
  const result = normalizePostback(new URLSearchParams({
    click_id: "ncf_bonga_123",
    transaction_id: "tx-refund",
    type: "chargeback",
    payout: "1.75",
    amount: "8.00"
  }));
  assert.equal(result.ok, true);
  assert.equal(result.event.type, "refund");
  assert.equal(result.event.payout, -1.75);
  assert.equal(result.event.amount, -8);
});

test("requires a real click and transaction id", () => {
  assert.equal(normalizePostback(new URLSearchParams({ type: "purchase", payout: "2", transaction_id: "tx" })).reason, "missing_click_id");
  assert.equal(normalizePostback(new URLSearchParams({ type: "purchase", payout: "2", click_id: "click" })).reason, "missing_transaction_id");
  assert.equal(normalizePostback(new URLSearchParams({ type: "purchase", click_id: "click", transaction_id: "tx" })).reason, "missing_payout");
});

test("keeps the BongaCash event taxonomy small and predictable", () => {
  assert.equal(normalizeType("revshare"), "purchase");
  assert.equal(normalizeType("registration"), "registration");
  assert.equal(normalizeType("chargeback"), "refund");
  assert.equal(normalizeType("something-else"), "something_else");
});

test("rejects malformed or partially numeric payout values instead of recording zero revenue", () => {
  for (const payout of ["abc", "2abc", "1.2.3", "--4"]) {
    const result = normalizePostback(new URLSearchParams({
      click_id: "ncf_bonga_123",
      transaction_id: "tx-invalid-" + encodeURIComponent(payout),
      type: "purchase",
      payout
    }));
    assert.equal(result.ok, false, payout);
    assert.equal(result.reason, "invalid_payout", payout);
  }
});

test("accepts formatted numeric payouts but rejects malformed optional amounts", () => {
  const valid = normalizePostback(new URLSearchParams({
    click_id: "ncf_bonga_123",
    transaction_id: "tx-formatted",
    type: "purchase",
    payout: "$1,234.50",
    amount: "12.50"
  }));
  assert.equal(valid.ok, true);
  assert.equal(valid.event.payout, 1234.5);
  assert.equal(valid.event.amount, 12.5);

  const invalidAmount = normalizePostback(new URLSearchParams({
    click_id: "ncf_bonga_123",
    transaction_id: "tx-invalid-amount",
    type: "purchase",
    payout: "2.50",
    amount: "12abc"
  }));
  assert.equal(invalidAmount.ok, false);
  assert.equal(invalidAmount.reason, "invalid_amount");
});

test("allows registration callbacks without payout while preserving zero as the payout placeholder", () => {
  const result = normalizePostback(new URLSearchParams({
    click_id: "ncf_bonga_123",
    transaction_id: "tx-registration",
    type: "registration"
  }));
  assert.equal(result.ok, true);
  assert.equal(result.event.payout, 0);
});

test("normalizes confirmed BongaCash initial and rebill transaction types as purchases", () => {
  assert.equal(normalizeType("initial"), "purchase");
  assert.equal(normalizeType("rebill"), "purchase");
});

test("accepts the documented BongaCash transaction, member and campaign identifiers", () => {
  const result = normalizePostback(new URLSearchParams({
    subid: "ncf_bonga_456",
    unique_transaction_id: "bonga-tx-456",
    unique_member_id: "member-789",
    cid: "840970",
    type: "initial",
    commission: "3.25",
    currency: "USD",
    country: "GB",
    date: "2026-11-22"
  }));
  assert.equal(result.ok, true);
  assert.equal(result.event.clickId, "ncf_bonga_456");
  assert.equal(result.event.transactionId, "bonga-tx-456");
  assert.equal(result.event.userId, "member-789");
  assert.equal(result.event.campaignId, "840970");
  assert.equal(result.event.type, "purchase");
  assert.equal(result.event.payout, 3.25);
  assert.equal(result.event.timestamp, "2026-11-22");
});

test("does not silently classify BongaCash ban events as purchases or refunds", () => {
  const result = normalizePostback(new URLSearchParams({
    subid: "ncf_bonga_456",
    unique_transaction_id: "bonga-ban-456",
    type: "ban"
  }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unsupported_event_type");
});
