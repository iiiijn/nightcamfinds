const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const start = fs.readFileSync(path.join(__dirname, "../start.js"), "utf8");
const helper = fs.readFileSync(path.join(__dirname, "../src/services/chaturbate-revshare.cjs"), "utf8");
const migration = fs.readFileSync(path.join(__dirname, "../sql/008_chaturbate_conversion_metadata.sql"), "utf8");
const { removePostbackSecrets, hasUnresolvedChaturbateMacros } = require("../src/services/chaturbate-revshare.cjs");

const { normalizeChaturbatePostback } = require("../src/services/chaturbate-revshare.cjs");

test("normalizer preserves all documented Chaturbate conversion metadata", () => {
  const result = normalizeChaturbatePostback({
    click_id: "ncf_test_click_12345678",
    transaction_id: "tx-2026-001",
    type: "revshare_purchase",
    payout: "1.25",
    currency: "USD",
    amount: "5.00",
    time: "12:00:00",
    token: "25",
    program_name: "RevShare",
    device: "mobile",
    language: "en",
    referral: "https://example.test/source",
    attempt: "1",
    region: "California"
  });
  assert.equal(result.ok, true);
  assert.deepEqual({
    time: result.event.time,
    token: result.event.token,
    programName: result.event.programName,
    device: result.event.device,
    language: result.event.language,
    referral: result.event.referral,
    attempt: result.event.attempt,
    region: result.event.region
  }, {
    time: "12:00:00",
    token: "25",
    programName: "RevShare",
    device: "mobile",
    language: "en",
    referral: "https://example.test/source",
    attempt: "1",
    region: "California"
  });
});

test("runtime persists documented metadata columns instead of retaining them only in raw payload", () => {
  for (const column of ["program_name", "event_time", "device", "language", "token", "referral", "attempt", "region"]) {
    assert.ok(start.includes(column), "missing persisted field: " + column);
  }
  assert.ok(start.includes('clean(params.referral, "", 2048)'));
  assert.ok(start.includes("JSON.stringify(params), matchedClick"));
});



test("Chaturbate metadata migration is additive and safe when the conversion ledger is absent", () => {
  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS cb_conversions"));
  assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS event_time"));
  assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS program_name"));
  assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS token"));
  assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS referral"));
  assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS attempt"));
  assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS region"));
  assert.ok(!migration.includes("UPDATE cb_conversions"));
});

test("the production request chain loads the Chaturbate postback handler", () => {
  const route = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
  assert.ok(route.includes('require("./start.js")'));
  assert.ok(start.includes('require("./server.js")'));
  assert.ok(start.includes('incoming.pathname === "/api/chaturbate/postback"'));
});

test("Chaturbate postbacks accept GET and POST form or JSON payloads", () => {
  assert.ok(start.includes('req.method !== "GET" && req.method !== "POST"'));
  assert.ok(start.includes("application/x-www-form-urlencoded"));
  assert.ok(start.includes("application/json"));
  assert.ok(start.includes("normalizeChaturbatePostback(params)"));
});

test("real Chaturbate conversion postbacks require a configured shared secret", () => {
  assert.ok(start.includes('if (!configuredSecret)'));
  assert.ok(start.includes('const suppliedSecret = String(params.secret || "")')); 
  assert.ok(start.includes('if (!safeEqual(suppliedSecret, configuredSecret))'));
});

test("macro test callbacks are acknowledged without recording conversions", () => {
  assert.ok(start.includes("hasUnresolvedChaturbateMacros(params)"));
  assert.ok(start.includes("no conversion recorded"));
});

test("normalizer rejects unsupported events and missing transaction data", () => {
  assert.ok(helper.includes("unsupported_event_type"));
  assert.ok(helper.includes("missing_click_id"));
  assert.ok(helper.includes("missing_transaction_id"));
  assert.ok(helper.includes("missing_or_invalid_payout"));
});

test("postback authentication secrets are removed before conversion persistence", () => {
  const safe = removePostbackSecrets({
    click_id: "ncf_test",
    transaction_id: "tx-1",
    secret: "do-not-store",
    Secret: "also-do-not-store",
    payout: "1.25"
  });
  assert.deepEqual(safe, {
    click_id: "ncf_test",
    transaction_id: "tx-1",
    payout: "1.25"
  });
  assert.ok(!start.includes("        await saveConversion(removePostbackSecrets(params))"));
  assert.ok(start.includes("const saved = await saveConversion(removePostbackSecrets(params))"));
  assert.ok(start.includes("matchedClick: saved.matchedClick"));
  assert.ok(start.includes("duplicate: !saved.inserted"));
});

test("Chaturbate currency is not silently assumed to be USD", () => {
  assert.ok(helper.includes("currency,"));
  assert.ok(!helper.includes('currency: currency || "USD"'));
});

test("conversion persistence records whether a click matched and ignores duplicate transaction IDs", () => {
  assert.ok(start.includes("SELECT EXISTS(SELECT 1 FROM cb_clicks WHERE click_id = $1::varchar(128) UNION ALL SELECT 1 FROM affiliate_clicks WHERE click_id = $1::varchar(128) AND platform = 'chaturbate') AS matched"));
  assert.ok(start.includes("ON CONFLICT (transaction_id) DO NOTHING"));
  assert.ok(start.includes("RETURNING id"));
  assert.ok(start.includes("return { matchedClick, inserted: inserted.rowCount === 1 }"));
});

test("dashboard verified revenue includes only matched supported Chaturbate event types", () => {
  assert.ok(start.includes("WHERE matched_click IS TRUE"));
  assert.ok(start.includes("tokens_signup-referral"));
  assert.ok(start.includes("ppr_signup-referral"));
  assert.ok(start.includes("revshare_broadcaster-referral"));
  assert.ok(start.includes("revshare_webmaster-commission"));
  assert.ok(start.includes("revshare_payout-adjustment"));
  assert.ok(start.includes("AND cc.matched_click IS TRUE"));
});

test("dashboard keeps matched Chaturbate earnings separated by currency", () => {
  const dashboard = fs.readFileSync(path.join(__dirname, "../public/dashboard.html"), "utf8");
  assert.ok(start.includes("GROUP BY 1"));
  assert.ok(start.includes("earningsByCurrency"));
  assert.ok(start.includes("const cbUsdEarnings = Number(earningsByCurrency.USD?.earnings || 0)"));
  assert.ok(dashboard.includes("currencyBreakdown(j.earningsByCurrency)"));
  assert.ok(dashboard.includes("Matched payout by currency"));
});


test("postback authentication diagnostics distinguish missing and invalid secrets without logging secret values", () => {
  assert.ok(start.includes('Chaturbate postback rejected: missing secret'));
  assert.ok(start.includes('Chaturbate postback rejected: invalid secret'));
  assert.ok(start.includes('hasTokenField: Boolean(params.token || params.validation || params.validation_token)'));
  assert.ok(start.includes('hasClickId: Boolean(params.click_id)'));
  assert.ok(!start.includes('console.warn("Chaturbate postback rejected: invalid secret", params.secret'));
  assert.ok(!start.includes('console.warn("Chaturbate postback rejected: missing secret", params.secret'));
});

test("conversion matching checks both the provider click ledger and primary Chaturbate click records", () => {
  assert.ok(start.includes("FROM cb_clicks WHERE click_id = $1::varchar(128) UNION ALL SELECT 1 FROM affiliate_clicks"));
  assert.ok(start.includes("AND platform = 'chaturbate') AS matched"));
});

test("any unresolved documented Chaturbate macro is acknowledged as a test and never treated as a conversion", () => {
  const fields = [
    "click_id", "transaction_id", "type", "payout", "currency", "amount",
    "country", "track", "source", "campaign_id", "program_id", "program_name",
    "user_id", "token", "timestamp", "date", "time", "device", "language",
    "referral", "attempt", "region"
  ];
  for (const field of fields) {
    assert.equal(hasUnresolvedChaturbateMacros({ [field]: "{"+field+"}" }), true, field);
  }
  assert.equal(hasUnresolvedChaturbateMacros({
    click_id: "ncf_test_click_12345678",
    transaction_id: "tx-2026-001",
    type: "revshare_purchase",
    payout: "1.25",
    currency: "USD",
    amount: "5.00",
    country: "US",
    track: "homepage",
    source: "organic",
    campaign_id: "campaign-1",
    program_id: "program-1",
    program_name: "RevShare",
    user_id: "user-1",
    token: "25",
    timestamp: "2026-11-11T00:00:00Z",
    date: "2026-11-11",
    time: "00:00:00",
    device: "desktop",
    language: "en",
    referral: "https://nightcamfinds.com/",
    attempt: "1",
    region: "California"
  }), false);
});

test("postback route checks all documented macro fields before normalization or persistence", () => {
  assert.ok(start.includes("hasUnresolvedChaturbateMacros(params)"));
  assert.ok(start.indexOf("hasUnresolvedChaturbateMacros(params)") < start.indexOf("normalizeChaturbatePostback(params)"));
});
