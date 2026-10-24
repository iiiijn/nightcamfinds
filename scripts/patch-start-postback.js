const fs = require('fs');
const path = 'start.js';
let s = fs.readFileSync(path, 'utf8');
const marker = 'NIGHTCAMFINDS_CB_POSTBACK_RUNTIME_V2';
if (s.includes(marker)) process.exit(0);

const replacement = `async function saveConversion(params) {
  if (!pool) throw new Error("Database unavailable");
  await ensurePostbackTables();
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS matched_click BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS device VARCHAR(32)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS language VARCHAR(32)");

  const clean = (value, fallback = "", max = 255) => String(value ?? "").trim().slice(0, max) || fallback;
  const number = (value) => {
    const n = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const clickId = clean(params.click_id, "", 128);
  if (!clickId) throw new Error("Missing click_id");
  const click = await pool.query("SELECT click_id FROM cb_clicks WHERE click_id = $1 LIMIT 1", [clickId]);
  const matched = click.rows.length > 0;

  const rawType = clean(params.type, "unknown", 100).toLowerCase();
  const signupTypes = new Set(["revshare_signup-referral", "ppr_signup-referral", "tokens_signup-referral"]);
  const purchaseTypes = new Set(["revshare_purchase"]);
  const normalizedType = signupTypes.has(rawType)
    ? "revshare_signup-referral"
    : purchaseTypes.has(rawType)
      ? "revshare_purchase"
      : rawType;

  const transactionId = clean(params.transaction_id, String(Date.now()) + "-" + Math.random().toString(16).slice(2), 255);
  const payout = number(params.payout);
  const amount = number(params.amount);

  await pool.query(
    `INSERT INTO cb_conversions
      (click_id,transaction_id,conversion_type,payout,currency,amount,country,track,source,campaign_id,program_id,user_id,event_timestamp,device,language,matched_click,raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
     ON CONFLICT (transaction_id) DO UPDATE SET
       click_id=EXCLUDED.click_id,
       conversion_type=EXCLUDED.conversion_type,
       payout=EXCLUDED.payout,
       currency=EXCLUDED.currency,
       amount=EXCLUDED.amount,
       country=EXCLUDED.country,
       track=EXCLUDED.track,
       source=EXCLUDED.source,
       campaign_id=EXCLUDED.campaign_id,
       program_id=EXCLUDED.program_id,
       user_id=EXCLUDED.user_id,
       event_timestamp=EXCLUDED.event_timestamp,
       device=EXCLUDED.device,
       language=EXCLUDED.language,
       matched_click=EXCLUDED.matched_click,
       raw_payload=EXCLUDED.raw_payload`,
    [
      clickId,
      transactionId,
      normalizedType,
      payout,
      clean(params.currency, "USD", 16),
      amount,
      clean(params.country, "UNKNOWN", 16).toUpperCase(),
      clean(params.track, "", 255),
      clean(params.source, "", 255),
      clean(params.campaign_id, "", 255),
      clean(params.program_id, "", 255),
      clean(params.user_id, "", 255),
      clean(params.timestamp, "", 100),
      clean(params.device, "", 32),
      clean(params.language, "", 32),
      matched,
      JSON.stringify(params)
    ]
  );
  return { ok: true, transactionId, clickId, type: normalizedType, matched };
}
`;

const re = /async function saveConversion\(params\) \{[\s\S]*?\n\}\n\nasync function dashboardStats/;
if (!re.test(s)) throw new Error('start.js saveConversion anchor not found');
s = s.replace(re, replacement + '\nasync function dashboardStats');
fs.writeFileSync(path, s);
console.log('NightCamFinds Chaturbate postback runtime patch applied');
