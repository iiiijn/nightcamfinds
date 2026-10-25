const fs = require('fs');
const path = 'start.js';
let s = fs.readFileSync(path, 'utf8');
const marker = 'NIGHTCAMFINDS_CB_POSTBACK_RUNTIME_V3';
if (s.includes(marker)) process.exit(0);

const replacement = `async function saveConversion(params) {
  if (!pool) throw new Error("Database unavailable");
  await ensurePostbackTables();
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS matched_click BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS device VARCHAR(32)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS language VARCHAR(32)");

  const clean = (value, fallback = "", max = 255) => String(value ?? "").trim().slice(0, max) || fallback;
  const strictNumber = value => {
    if (value == null || String(value).trim() === "") return null;
    const n = Number(String(value).trim());
    return Number.isFinite(n) ? n : null;
  };
  const placeholder = value => {
    const v = String(value ?? "").trim();
    return !v || /^\\{[^}]+\\}$/.test(v) || /^(test|testing|example|placeholder)$/i.test(v);
  };

  const clickId = clean(params.click_id, "", 128);
  const transactionId = clean(params.transaction_id, "", 255);
  const rawType = clean(params.type, "", 100).toLowerCase();
  const payout = strictNumber(params.payout);
  const amount = strictNumber(params.amount);
  const currency = clean(params.currency, "", 16).toUpperCase();
  const country = clean(params.country, "UNKNOWN", 16).toUpperCase();

  // Chaturbate's dashboard test can send placeholder/unresolved macros or values
  // that cannot correspond to a real click. Return a successful test response,
  // but never write that request into the conversion ledger.
  const testRequest = placeholder(clickId) || placeholder(transactionId) || placeholder(rawType) ||
    payout === null || amount === null || !/^[A-Z]{3}$/.test(currency);
  if (testRequest) {
    console.log("Chaturbate postback test accepted", JSON.stringify({
      clickIdPresent: Boolean(clickId),
      matched: false
    }));
    return { ok: true, test: true, matched: false };
  }

  if (!/^ncf_[a-z0-9_-]{8,120}$/i.test(clickId)) throw new Error("Invalid click_id");
  if (!transactionId || /^\\{.*\\}$/.test(transactionId)) throw new Error("Missing or unresolved transaction_id");
  if (!rawType || /^\\{.*\\}$/.test(rawType)) throw new Error("Missing or unresolved conversion type");
  if (payout === null || amount === null || amount < 0) throw new Error("Missing payout or invalid amount");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Missing or invalid currency");

  const click = await pool.query("SELECT click_id FROM cb_clicks WHERE click_id = $1 LIMIT 1", [clickId]);
  if (!click.rows.length) throw new Error("Unmatched click_id");

  const allowedTypes = new Set([
    "revshare_signup-referral",
    "revshare_broadcaster-referral",
    "revshare_purchase",
    "revshare_webmaster-commission",
    "revshare_payout-adjustment"
  ]);
  const normalizedType = rawType;
  if (!allowedTypes.has(normalizedType)) throw new Error("Unsupported conversion type");

  await pool.query(
    \`INSERT INTO cb_conversions
      (click_id,transaction_id,conversion_type,payout,currency,amount,country,track,source,campaign_id,program_id,user_id,event_timestamp,device,language,matched_click,raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
     ON CONFLICT (transaction_id) DO UPDATE SET
       payout=EXCLUDED.payout, conversion_type=EXCLUDED.conversion_type,
       currency=EXCLUDED.currency, amount=EXCLUDED.amount, country=EXCLUDED.country,
       track=EXCLUDED.track, source=EXCLUDED.source, campaign_id=EXCLUDED.campaign_id,
       program_id=EXCLUDED.program_id, user_id=EXCLUDED.user_id,
       event_timestamp=EXCLUDED.event_timestamp, device=EXCLUDED.device,
       language=EXCLUDED.language, matched_click=EXCLUDED.matched_click,
       raw_payload=EXCLUDED.raw_payload
     WHERE cb_conversions.click_id = EXCLUDED.click_id\`,
    [
      clickId, transactionId, normalizedType, payout, currency, amount, /^[A-Z]{2}$/.test(country) ? country : "UNKNOWN",
      clean(params.track, "", 255), clean(params.source, "", 255),
      clean(params.campaign_id || params.campaign, "", 255), clean(params.program_id, "", 255),
      clean(params.user_id, "", 255), clean(params.timestamp, "", 100),
      clean(params.device, "", 32), clean(params.language, "", 32), true, JSON.stringify(params)
    ]
  );
  return { ok: true, transactionId, clickId, type: normalizedType, matched: true };
}`;

const re = /async function saveConversion\(params\) \{[\s\S]*?\n\}\n\nasync function dashboardStats/;
if (!re.test(s)) throw new Error('start.js saveConversion anchor not found');
s = s.replace(re, replacement + '\nasync function dashboardStats');
// The Chaturbate route is patched directly in start.js. Do not rewrite that route here.
const routeMarker = 'NIGHTCAMFINDS_CB_POSTBACK_ROUTE_V6';
if (!s.includes(routeMarker)) {
  const routeStart = s.indexOf('if (incoming.pathname === "/api/chaturbate/postback"');
  if (routeStart >= 0) {
    s = s.slice(0, routeStart) + '// ' + routeMarker + '\n    ' + s.slice(routeStart);
  }
}
fs.writeFileSync(path, s);
console.log('NightCamFinds Chaturbate postback runtime patch applied');
