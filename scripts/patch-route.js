const fs = require('fs');
const path = 'route.js';
let s = fs.readFileSync(path, 'utf8');
const marker = 'NIGHTCAMFINDS_CB_POSTBACK_PATCH_V5';
if (s.includes(marker)) process.exit(0);

const helper = `
 // NIGHTCAMFINDS_CB_POSTBACK_PATCH_V5: strict Chaturbate GET postback validation.
async function saveChaturbatePostback(params){
  if(!pool) throw new Error("Database unavailable");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS matched_click BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS device VARCHAR(32)");
  await pool.query("ALTER TABLE cb_conversions ADD COLUMN IF NOT EXISTS language VARCHAR(32)");
  const first=(names,fallback="")=>{for(const n of names){const v=params.get(n);if(v!==null&&String(v).trim()!=="")return String(v).trim()}return fallback};
  const strictNumber = v => {
    if (v === "" || v == null) return null;
    const n = Number(String(v).trim());
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const clickId = first(["click_id"]);
  const tx = first(["transaction_id"]);
  const rawType = first(["type"]).toLowerCase();
  const payout = strictNumber(first(["payout"]));
  const amount = strictNumber(first(["amount"]));
  const currency = first(["currency"]).toUpperCase();
  const country = first(["country"]).toUpperCase();
  if (!/^ncf_[a-z0-9_-]{8,120}$/i.test(clickId)) throw new Error("invalid click_id");
  if (!tx || /^\{.*\}$/.test(tx)) throw new Error("missing transaction_id");
  if (!rawType || /^\{.*\}$/.test(rawType)) throw new Error("missing type");
  if (payout === null || amount === null) throw new Error("invalid payout or amount");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("invalid currency");
  const matched = await pool.query("SELECT click_id FROM cb_clicks WHERE click_id=$1 LIMIT 1",[clickId]);
  if (!matched.rows.length) throw new Error("unmatched click_id");
  const typeMap = new Map([
    ["revshare_signup-referral","revshare_signup-referral"],
    ["ppr_signup-referral","revshare_signup-referral"],
    ["tokens_signup-referral","revshare_signup-referral"],
    ["revshare_purchase","revshare_purchase"],
    ["revshare_payout-adjustment","revshare_payout-adjustment"]
  ]);
  const normalized = typeMap.get(rawType) || rawType;
  const values = [
    clickId, tx, normalized, payout, currency, amount,
    /^[A-Z]{2}$/.test(country) ? country : "UNKNOWN",
    first(["track"]), first(["source"]), first(["campaign_id","campaign"]),
    first(["program_id"]), first(["user_id"]), first(["timestamp"]),
    first(["device"]), first(["language"]), true,
    JSON.stringify(Object.fromEntries(params.entries()))
  ];
  await pool.query(
    `INSERT INTO cb_conversions
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
     WHERE cb_conversions.click_id = EXCLUDED.click_id`,
    values
  );
  return {ok:true,type:normalized,transactionId:tx,clickId,matched:true};
}

const anchor = 'function rangeClause(incoming, column = "received_at") {';
if (!s.includes(anchor)) throw new Error('route.js anchor not found');
s = s.replace(anchor, helper + '\n' + anchor);

const routeAnchor = 'if (incoming.pathname === "/api/bongacash/postback") {';
if (!s.includes(routeAnchor)) throw new Error('BongaCash route anchor not found');
const cbRoute = `if (incoming.pathname === "/api/chaturbate/postback" || incoming.pathname === "/cb/postback") {
      // Chaturbate sends conversion data server-to-server to the configured URL.
      // We only accept a conversion when its click_id was issued by NightCamFinds.
      try { return sendJson(res, 200, await saveChaturbatePostback(incoming.searchParams)); }
      catch (err) { console.error("Chaturbate postback failed:", err.message); return sendJson(res, 400, { error: "Could not save Chaturbate conversion." }); }
    }
    `;
s = s.replace(routeAnchor, cbRoute + routeAnchor);
fs.writeFileSync(path, s);
console.log('NightCamFinds Chaturbate postback patch applied');
