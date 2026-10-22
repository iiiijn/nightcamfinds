const fs = require('fs');
const path = 'route.js';
let s = fs.readFileSync(path, 'utf8');
const marker = 'NIGHTCAMFINDs_CB_POSTBACK_PATCH';
if (s.includes(marker)) process.exit(0);
const helper = `
// ${marker}
async function saveChaturbatePostback(params){
  if(!pool) throw new Error('Database is not configured');
  await pool.query(\`CREATE TABLE IF NOT EXISTS cb_conversions (id BIGSERIAL PRIMARY KEY, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), click_id VARCHAR(128), transaction_id VARCHAR(255) UNIQUE, conversion_type VARCHAR(100), payout NUMERIC(18,6) DEFAULT 0, currency VARCHAR(16), amount NUMERIC(18,6), country VARCHAR(16), track VARCHAR(255), source VARCHAR(255), campaign_id VARCHAR(255), program_id VARCHAR(255), user_id VARCHAR(255), event_timestamp VARCHAR(100), raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb)\`);
  const first=(names,fallback='')=>{for(const n of names){const v=params.get(n);if(v!==null&&String(v).trim()!=='')return String(v).trim()}return fallback};
  const num=v=>{const n=Number.parseFloat(String(v||'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
  const type=first(['type','event','conversion_type','action'],'unknown').toLowerCase().replace(/[\\s-]+/g,'_');
  const normalized=/(signup|registration|register|lead)/.test(type)?'revshare_signup-referral':/(purchase|sale|deposit|revshare|ftd)/.test(type)?'revshare_purchase':type;
  const tx=first(['transaction_id','transactionid','txid','tid','action_id','id'],Date.now()+'-'+Math.random().toString(16).slice(2));
  await pool.query(\`INSERT INTO cb_conversions (click_id,transaction_id,conversion_type,payout,currency,amount,country,track,source,campaign_id,program_id,user_id,event_timestamp,raw_payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) ON CONFLICT(transaction_id) DO UPDATE SET payout=EXCLUDED.payout,conversion_type=EXCLUDED.conversion_type,raw_payload=EXCLUDED.raw_payload\`,[first(['click_id','clickid','subid','sub_id','sid','s1','ref','track_id']),tx,normalized,num(first(['payout','commission','earnings','revenue','profit'])),first(['currency','currency_code'],'USD'),num(first(['amount','purchase_amount','sale_amount','spend'])),first(['country','country_code','geo'],'UNKNOWN').toUpperCase(),first(['track','tracking','placement','subid2']),first(['source','traffic_source','utm_source','subid1']),first(['campaign_id','campaign','subid3']),first(['program_id']),first(['user_id','userid','member_id','customer_id']),first(['timestamp','event_timestamp','date','datetime']),JSON.stringify(Object.fromEntries(params.entries()))]);
  return {ok:true,type:normalized,transactionId:tx};
}
`;
const anchor = 'function rangeClause(incoming, column = "received_at") {';
if (!s.includes(anchor)) throw new Error('route.js anchor not found');
s = s.replace(anchor, helper + '\n' + anchor);
const routeAnchor = 'if (incoming.pathname === "/api/bongacash/postback") {';
if (!s.includes(routeAnchor)) throw new Error('BongaCash route anchor not found');
const cbRoute = `if (incoming.pathname === "/api/chaturbate/postback" || incoming.pathname === "/cb/postback") {
      if (!process.env.CB_POSTBACK_SECRET) return sendJson(res, 503, { error: "Chaturbate postback secret is not configured." });
      const supplied = incoming.searchParams.get("key") || incoming.searchParams.get("token") || incoming.searchParams.get("secret") || "";
      if (!safeEqual(supplied, process.env.CB_POSTBACK_SECRET)) return sendJson(res, 403, { error: "Invalid Chaturbate postback secret." });
      try { return sendJson(res, 200, await saveChaturbatePostback(incoming.searchParams)); }
      catch (err) { console.error("Chaturbate postback failed:", err.message); return sendJson(res, 500, { error: "Could not save Chaturbate conversion." }); }
    }
    `;
s = s.replace(routeAnchor, cbRoute + routeAnchor);
fs.writeFileSync(path, s);
console.log('NightCamFinds Chaturbate postback patch applied');
