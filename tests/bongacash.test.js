import test from "node:test";
import assert from "node:assert/strict";
import { ensureTable, normalizePostback, normalizeType } from "../bongacash.js";

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

test("allows signup callbacks without transaction ID or payout", () => {
  const result = normalizePostback(new URLSearchParams({
    click_id: "ncf_bonga_123",
    event: "registration"
  }));
  assert.equal(result.ok, true);
  assert.equal(result.event.payout, 0);
  assert.equal(result.event.transactionId, null);
  assert.match(result.event.eventKey, /^registration:ncf_bonga_123:/);
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



test("records a reversal sharing a transaction ID while deduplicating repeat delivery", async () => {
  const { save } = await import("../bongacash.js");
  const seen = new Set();
  const insertStatements = [];
  const pool = {
    async query(sql, values = []) {
      if (sql.includes("SELECT click_id FROM bonga_clicks")) return { rows: [{ click_id: values[0] }] };
      if (sql.includes("INSERT INTO bonga_conversions")) {
        insertStatements.push(sql);
        const key = values[2];
        if (seen.has(key)) return { rowCount: 0, rows: [] };
        seen.add(key);
        return { rowCount: 1, rows: [{ transaction_id: values[1] }] };
      }
      return { rows: [], rowCount: 0 };
    }
  };
  const purchase = new URLSearchParams({ click_id: "click-1", transaction_id: "tx-1", type: "initial", payout: "4.00" });
  const refund = new URLSearchParams({ click_id: "click-1", transaction_id: "tx-1", type: "refund", payout: "4.00" });

  const firstPurchase = await save(pool, purchase);
  const firstRefund = await save(pool, refund);
  const repeatedRefund = await save(pool, refund);

  assert.equal(firstPurchase.duplicate, false);
  assert.equal(firstRefund.duplicate, false);
  assert.equal(firstRefund.type, "refund");
  assert.equal(repeatedRefund.duplicate, true);
  assert.equal(seen.size, 2);
  assert.ok(insertStatements.every(sql => sql.includes("ON CONFLICT (event_key) DO NOTHING")));
});


test("maps documented subid2 to source attribution, not placement", () => {
  const result = normalizePostback(new URLSearchParams({
    subid: "ncf_bonga_789", subid2: "telegram-post-4", event: "registration"
  }));
  assert.equal(result.ok, true);
  assert.equal(result.event.source, "telegram-post-4");
  assert.equal(result.event.track, "");
});

test("deduplicates identical signup deliveries using a stable event key", () => {
  const first = normalizePostback(new URLSearchParams({
    subid: "click-1", event: "registration", unique_member_id: "member-1"
  }));
  const retry = normalizePostback(new URLSearchParams({
    subid: "click-1", event: "registration", unique_member_id: "member-1"
  }));
  assert.equal(first.ok, true);
  assert.equal(first.event.eventKey, retry.event.eventKey);
});

test("accepts source_id from the configured BongaCash signup and purchase callback URLs", () => {
  const signup = normalizePostback(new URLSearchParams({
    event: "registration",
    click_id: "ncf_bonga_signup_1",
    source_id: "telegram-source-1",
    payout: "0"
  }));
  assert.equal(signup.ok, true);
  assert.equal(signup.event.source, "telegram-source-1");

  const purchase = normalizePostback(new URLSearchParams({
    event: "purchase",
    click_id: "ncf_bonga_purchase_1",
    source_id: "x-campaign-2",
    transaction_id: "bonga-tx-1",
    payout: "2.75"
  }));
  assert.equal(purchase.ok, true);
  assert.equal(purchase.event.source, "x-campaign-2");
  assert.equal(purchase.event.transactionId, "bonga-tx-1");
  assert.equal(purchase.event.payout, 2.75);
});

test("adds event_key to an existing BongaCash conversions table before indexing it", async () => {
  const statements = [];
  const pool = {
    async query(sql) {
      statements.push(sql);
      return { rows: [], rowCount: 0 };
    }
  };

  await ensureTable(pool);

  const addColumnIndex = statements.findIndex(sql =>
    sql.includes("ALTER TABLE bonga_conversions ADD COLUMN IF NOT EXISTS event_key VARCHAR(320)")
  );
  const createIndexIndex = statements.findIndex(sql =>
    sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS bonga_conversions_event_key_uidx")
  );

  assert.notEqual(addColumnIndex, -1);
  assert.notEqual(createIndexIndex, -1);
  assert.ok(addColumnIndex < createIndexIndex);
});
