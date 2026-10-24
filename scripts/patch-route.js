const fs = require('fs');
const path = 'route.js';
let s = fs.readFileSync(path, 'utf8');
const marker = 'NIGHTCAMFINDs_CB_POSTBACK_PATCH_V4';
if (s.includes(marker)) process.exit(0);

const helper = `
// ${marker}
async function saveChaturbatePostback(params){
  if(!pool) throw new Error('Database is not configured');
  await pool.query("CREATE TABLE IF NOT EXISTS cb_conversions (id BIGSERIAL PRIMARY KEY, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), click_id VARCHAR(128), transaction_id VARCHAR(255) UNIQUE, conversion_type VARCHAR(100), payout NUMERIC(18,6) DEFAULT 0, currency VARCHAR(16), amount NUMERIC(18,6), country VARCHAR(16), track VARCHAR(255), source VARCHAR(255), campaign_id VARCHAR(255), program_id VARCHAR(255), user_id VARCHAR(255), event_timestamp VARCHAR(100), raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb)");
  await pool.query("CREATE INDEX IF NOT EXISTS cb_conversions_click_id_idx ON cb_conversions(click_id)");
  const first=(names,fallback='')=>{for(const n of names){const v=params.get(n);if(v!==null&&String(v).trim()!=='')return String(v).trim()}return fallback};
  const num=v=>{const n=Number.parseFloat(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
  const clickId=first(['click_id','clickid','subid','sub_id','sid','s1','ref','track_id']);
  if(!clickId) throw new Error('missing click_id');
  const matched=await pool.query('SELECT 1 FROM cb_clicks WHERE click_id=$1 LIMIT 1',[clickId]);
  if(!matched.rows.length) throw new Error('unmatched click_id');

  const rawType=first(['type','event','conversion_type','action'],'unknown').toLowerCase();
  const signupTypes=new Set(['revshare_signup-referral','ppr_signup-referral','tokens_signup-referral','signup','registration','register','lead']);
  const purchaseTypes=new Set(['revshare_purchase','ppr_purchase','purchase','sale','deposit','ftd']);
  const normalized=signupTypes.has(rawType)
    ? 'revshare_signup-referral'
    : purchaseTypes.has(rawType)
      ? 'revshare_purchase'
      : rawType.replace(/[^a-z0-9_-]+/g,'_');

  const tx=first(['transaction_id','transactionid','txid','tid','action_id'],Date.now()+'-'+Math.random().toString(16).slice(2));
  await pool.query("INSERT INTO cb_conversions (click_id,transaction_id,conversion_type,payout,currency,amount,country,track,source,campaign_id,program_id,user_id,event_timestamp,raw_payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) ON CONFLICT(transaction_id) DO UPDATE SET payout=EXCLUDED.payout,conversion_type=EXCLUDED.conversion_type,currency=EXCLUDED.currency,amount=EXCLUDED.amount,country=EXCLUDED.country,track=EXCLUDED.track,source=EXCLUDED.source,raw_payload=EXCLUDED.raw_payload",[clickId,tx,normalized,num(first(['payout','commission','earnings','revenue','profit'])),first(['currency','currency_code'],'USD'),num(first(['amount','purchase_amount','sale_amount','spend'])),first(['country','country_code','geo'],'UNKNOWN').toUpperCase(),first(['track','tracking','placement','subid2']),first(['source','traffic_source','utm_source','subid1']),first(['campaign_id','campaign','subid3']),first(['program_id']),first(['user_id','userid','member_id','customer_id']),first(['timestamp','event_timestamp','date','datetime']),JSON.stringify(Object.fromEntries(params.entries()))]);
  return {ok:true,type:normalized,transactionId:tx,clickId};
}
`;
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
