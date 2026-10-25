const fs = require("fs");
const path = "start.js";
let s = fs.readFileSync(path, "utf8");
const marker = "NIGHTCAMFINDS_CB_POSTBACK_HARDENING_V1";
if (s.includes(marker)) process.exit(0);

const newHandler = `async function saveConversion(params) {
  if (!pool) throw new Error("Database unavailable");
  await ensurePostbackTables();
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS matched_click BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS device VARCHAR(32)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS language VARCHAR(32)");

  const clean = (value, max = 255) => String(value ?? "").trim().slice(0, max);
  const numberOrNull = (value) => {
    if (value == null || String(value).trim() === "") return null;
    const n = Number(String(value).trim());
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const clickId = clean(params.click_id, 128);
  const transactionId = clean(params.transaction_id, 255);
  const rawType = clean(params.type, 100).toLowerCase();
  if (!/^ncf_[a-z0-9_-]{8,120}$/i.test(clickId)) throw new Error("Invalid click_id");
  if (!transactionId || /^\{.*\}$/.test(transactionId)) throw new Error("Missing or unresolved transaction_id");
  if (!rawType || /^\{.*\}$/.test(rawType)) throw new Error("Missing or unresolved conversion type");

  const foundClick = await pool.query("SELECT click_id FROM cb_clicks WHERE click_id = $1 LIMIT 1", [clickId]);
  if (!foundClick.rows.length) throw new Error("Unmatched click_id");

  const signupTypes = new Set(["revshare_signup-referral", "ppr_signup-referral", "tokens_signup-referral"]);
  const purchaseTypes = new Set(["revshare_purchase"]);
  const payoutAdjustTypes = new Set(["revshare_payout-adjustment"]);
  const normalizedType = signupTypes.has(rawType) ? "revshare_signup-referral"
    : purchaseTypes.has(rawType) ? "revshare_purchase"
    : payoutAdjustTypes.has(rawType) ? "revshare_payout-adjustment"
    : rawType;
  const payout = numberOrNull(params.payout);
  const amount = numberOrNull(params.amount);
  const countryCode = clean(params.country, 16).toUpperCase();
  const currency = clean(params.currency, 16).toUpperCase();
  if (payout == null) throw new Error("Missing or invalid payout");
  if (amount == null) throw new Error("Missing or invalid amount");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Missing or invalid currency");

  const values = [
    clickId, transactionId, normalizedType, payout, currency, amount,
    /^[A-Z]{2}$/.test(countryCode) ? countryCode : "UNKNOWN",
    clean(params.track, 255), clean(params.source, 255),
    clean(params.campaign_id || params.campaign, 255), clean(params.program_id, 255),
    clean(params.user_id, 255), clean(params.timestamp, 100),
    clean(params.device, 32), clean(params.language, 32), true, JSON.stringify(params)
  ];
  await pool.query(
    `INSERT INTO cb_conversions
      (click_id,transaction_id,conversion_type,payout,currency,amount,country,track,source,campaign_id,program_id,user_id,event_timestamp,device,language,matched_click,raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
     ON CONFLICT (transaction_id) DO UPDATE SET
       click_id=EXCLUDED.click_id, conversion_type=EXCLUDED.conversion_type,
       payout=EXCLUDED.payout, currency=EXCLUDED.currency, amount=EXCLUDED.amount,
       country=EXCLUDED.country, track=EXCLUDED.track, source=EXCLUDED.source,
       campaign_id=EXCLUDED.campaign_id, program_id=EXCLUDED.program_id,
       user_id=EXCLUDED.user_id, event_timestamp=EXCLUDED.event_timestamp,
       device=EXCLUDED.device, language=EXCLUDED.language,
       matched_click=EXCLUDED.matched_click, raw_payload=EXCLUDED.raw_payload
     WHERE cb_conversions.click_id = EXCLUDED.click_id`,
    values
  );
  return { ok: true, transactionId, clickId, type: normalizedType, matched: true };
}
`;

const start = s.indexOf("async function saveConversion(params) {");
const end = s.indexOf("\nasync function dashboardStats", start);
if (start < 0 || end < 0) throw new Error("Could not locate saveConversion function boundaries.");
s = s.slice(0, start) + newHandler + s.slice(end);

const routeOld = `if(incoming.pathname === "/cb/postback") {
      try{await saveConversion(Object.fromEntries(incoming.searchParams.entries()));res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"});return res.end("OK")}catch{return json(res,503,{error:"Postback storage unavailable."})}
    }`;
const routeNew = `// ${marker}
    if (incoming.pathname === "/cb/postback") {
      try {
        const event = await saveConversion(Object.fromEntries(incoming.searchParams.entries()));
        return json(res, 200, event);
      } catch (err) {
        console.error("Chaturbate postback rejected:", err.message);
        return json(res, 400, { ok: false, error: "Postback event rejected." });
      }
    }`;
if (!s.includes(routeOld)) throw new Error("Could not locate /cb/postback route.");
s = s.replace(routeOld, routeNew);
fs.writeFileSync(path, s);
console.log("Applied safe Chaturbate postback validation and matched-click guard.");
