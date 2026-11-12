'use strict';
(function(root){
'use strict';
const CREDITED_EVENT_TYPES=new Set(['tokens_signup-referral','tokens_broadcaster-referral','ppr_signup-referral','ppr_broadcaster-referral','revshare_signup-referral','revshare_broadcaster-referral','revshare_purchase','revshare_webmaster-commission','revshare_payout-adjustment']);
const EVENT_CLASS_LABELS={member_purchase_revshare:'Member purchase RevShare',signup_referral:'Signup referral',broadcaster_referral:'Broadcaster referral',webmaster_commission:'Webmaster commission',payout_adjustment:'Payout adjustment',other:'Other / unsupported'};
function addMoney(target,currency,amount){const code=String(currency||'UNSPECIFIED').trim().toUpperCase()||'UNSPECIFIED',value=Number(amount||0);if(Number.isFinite(value)&&value!==0)target[code]=(target[code]||0)+value;}
function summarizeConversions(rows=[]){
const out={matchedConversions:0,unmatchedConversions:0,invalidCallbacks:0,testEvents:0,excludedEvents:0,attributedPayoutsByCurrency:{},pendingPayoutsByCurrency:{},matchedPurchaseSpendByCurrency:{},illustrative20PercentByCurrency:{},eventBreakdownByType:{}};
for(const row of rows){
const count=Math.max(0,Number(row.conversions||0)),type=String(row.conversionType||'').toLowerCase(),eventClass=String(row.eventClass||'other');
if(row.matchStatus==='invalid_callback'||row.isTest){if(row.matchStatus==='invalid_callback')out.invalidCallbacks+=count;if(row.isTest)out.testEvents+=count;continue;}
if(!CREDITED_EVENT_TYPES.has(type)){out.excludedEvents+=count;continue;}
const matched=Math.max(0,Number(row.matchedConversions||0)),unmatched=Math.max(0,Number(row.unmatchedConversions||0)),currency=String(row.currency||'UNSPECIFIED').trim().toUpperCase()||'UNSPECIFIED',payout=Number(row.reportedPayout||0),spend=Number(row.reportedSpend||0);
out.matchedConversions+=matched;out.unmatchedConversions+=unmatched;
if(Number.isFinite(payout)&&payout!==0)addMoney(row.matchStatus==='matched'?out.attributedPayoutsByCurrency:out.pendingPayoutsByCurrency,currency,payout);
const item=out.eventBreakdownByType[eventClass]||{label:EVENT_CLASS_LABELS[eventClass]||EVENT_CLASS_LABELS.other,matchedConversions:0,unmatchedConversions:0,matchedPayoutsByCurrency:{},pendingPayoutsByCurrency:{},matchedMemberSpendByCurrency:{},illustrative20PercentByCurrency:{}};
item.matchedConversions+=matched;item.unmatchedConversions+=unmatched;
if(Number.isFinite(payout)&&payout!==0)addMoney(row.matchStatus==='matched'?item.matchedPayoutsByCurrency:item.pendingPayoutsByCurrency,currency,payout);
if(type==='revshare_purchase'&&Number.isFinite(spend)&&spend!==0&&row.matchStatus==='matched'){addMoney(item.matchedMemberSpendByCurrency,currency,spend);addMoney(item.illustrative20PercentByCurrency,currency,spend*0.20);addMoney(out.matchedPurchaseSpendByCurrency,currency,spend);addMoney(out.illustrative20PercentByCurrency,currency,spend*0.20);}
out.eventBreakdownByType[eventClass]=item;
}
return out;
}
function summarizeTraffic(rows=[]){
const countries=new Map(),campaigns=new Map();
for(const row of rows){const clicks=Math.max(0,Number(row.clicks||0)),visits=Math.max(0,Number(row.visits||0)),engagedVisits=Math.max(0,Number(row.engagedVisits||0)),visitsWithAffiliateClick=Math.max(0,Number(row.visitsWithAffiliateClick||0)),clicksWithVisitId=Math.max(0,Number(row.clicksWithVisitId||0)),clicksWithoutVisitId=Math.max(0,Number(row.clicksWithoutVisitId||0)),conversions=Math.max(0,Number(row.matchedConversions||0)),payouts=row.reportedPayoutsByCurrency&&typeof row.reportedPayoutsByCurrency==='object'?row.reportedPayoutsByCurrency:{};
const add=(map,key)=>{const item=map.get(key)||{clicks:0,clicksWithVisitId:0,clicksWithoutVisitId:0,visits:0,engagedVisits:0,visitsWithAffiliateClick:0,matchedConversions:0,payoutsByCurrency:{}};item.clicks+=clicks;item.clicksWithVisitId+=clicksWithVisitId;item.clicksWithoutVisitId+=clicksWithoutVisitId;item.visits+=visits;item.engagedVisits+=engagedVisits;item.visitsWithAffiliateClick+=visitsWithAffiliateClick;item.matchedConversions+=conversions;for(const[currency,amount]of Object.entries(payouts)){const code=String(currency||'UNSPECIFIED').toUpperCase(),value=Number(amount||0);if(Number.isFinite(value))item.payoutsByCurrency[code]=(item.payoutsByCurrency[code]||0)+value;}map.set(key,item);};
add(countries,String(row.country||'UNKNOWN').toUpperCase());add(campaigns,[row.platform||'unknown',row.source||'unknown',row.campaign||'unknown'].join(' · '));
}
const format=map=>[...map.entries()].map(([name,item])=>({name,...item,engagementRate:item.visits?item.engagedVisits/item.visits:0,visitToClickRate:item.visits?item.visitsWithAffiliateClick/item.visits:0,conversionRate:item.clicks?item.matchedConversions/item.clicks:0})).sort((a,b)=>b.visits-a.visits||b.clicks-a.clicks||a.name.localeCompare(b.name));
return{countries:format(countries),campaigns:format(campaigns)};
}
const api={CREDITED_EVENT_TYPES,EVENT_CLASS_LABELS,summarizeConversions,summarizeTraffic};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.NCFRevenueSummary=api;
})(typeof window!=='undefined'?window:globalThis);
