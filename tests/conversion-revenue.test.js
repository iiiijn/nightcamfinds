'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const conversionRevenue=require('../src/services/conversion-revenue.cjs');
const {summarizeConversions}=require('../public/revenue-summary.js');
test('groups provider payouts and member spend by event type and currency',()=>{
const built=conversionRevenue.buildQuery({from:'2026-11-01',to:'2026-11-07'});
assert.deepEqual(built.params,['2026-11-01','2026-11-07']);
assert.match(built.text,/AS event_class/);assert.match(built.text,/AS reported_payout/);assert.match(built.text,/AS reported_spend/);
assert.match(built.text,/SUM\(cc\.payout\)/);assert.match(built.text,/SUM\(cc\.amount\).*revshare_purchase/);assert.match(built.text,/GROUP BY 1,2,3,4,5,6,7,8,9/);
assert.match(built.text,/jsonb_each_text/);assert.match(built.text,/cc\.matched_click IS TRUE/);assert.match(built.text,/missing_click_id/);assert.match(built.text,/click_id_not_found/);assert.equal(built.dateBasis,'callback_received_at_utc');
});
test('rejects invalid dates and reversed date ranges',()=>{assert.match(conversionRevenue.buildQuery({from:'2026-02-31'}).error,/calendar dates/);assert.match(conversionRevenue.buildQuery({from:'2026-11-08',to:'2026-11-07'}).error,/on or before/);});
test('uses parameterized UTC date filters',()=>{const built=conversionRevenue.buildQuery({from:'2026-11-01',to:'2026-11-07'});assert.doesNotMatch(built.text,/2026-11/);assert.match(built.text,/received_at >= \(\$1::date AT TIME ZONE 'UTC'\)/);assert.match(built.text,/received_at < \(\(\$2::date \+ INTERVAL '1 day'\) AT TIME ZONE 'UTC'\)/);});
test('detects macro placeholders in typed callback columns as well as raw payload',()=>{const built=conversionRevenue.buildQuery({});assert.ok(built.text.includes("COALESCE(cc.conversion_type, '') ~"));assert.ok(built.text.includes("COALESCE(cc.currency, '') ~"));assert.ok(built.text.includes("COALESCE(cc.click_id, '') ~"));});
test('separates actual payouts, pending payouts, member spend and illustrative estimate',()=>{
const result=summarizeConversions([
{conversions:2,isTest:false,matchStatus:'matched',conversionType:'revshare_purchase',eventClass:'member_purchase_revshare',currency:'USD',matchedConversions:2,unmatchedConversions:0,reportedPayout:'7.50',reportedSpend:'37.50'},
{conversions:1,isTest:false,matchStatus:'click_id_not_found',conversionType:'revshare_purchase',eventClass:'member_purchase_revshare',currency:'USD',matchedConversions:0,unmatchedConversions:1,reportedPayout:'2.00',reportedSpend:'10.00'},
{conversions:1,isTest:false,matchStatus:'matched',conversionType:'revshare_webmaster-commission',eventClass:'webmaster_commission',currency:'EUR',matchedConversions:1,unmatchedConversions:0,reportedPayout:'3.00',reportedSpend:'0'},
{conversions:1,isTest:true,matchStatus:'invalid_callback',conversionType:'unknown',eventClass:'other',currency:'USD',matchedConversions:0,unmatchedConversions:0,reportedPayout:'99.00',reportedSpend:'0'}
]);
assert.deepEqual(result.attributedPayoutsByCurrency,{USD:7.5,EUR:3});assert.deepEqual(result.pendingPayoutsByCurrency,{USD:2});
assert.deepEqual(result.matchedPurchaseSpendByCurrency,{USD:37.5});assert.deepEqual(result.illustrative20PercentByCurrency,{USD:7.5});
assert.equal(result.matchedConversions,3);assert.equal(result.unmatchedConversions,1);assert.equal(result.invalidCallbacks,1);
assert.equal(result.eventBreakdownByType.member_purchase_revshare.matchedConversions,2);assert.equal(result.eventBreakdownByType.member_purchase_revshare.unmatchedConversions,1);
assert.deepEqual(result.eventBreakdownByType.member_purchase_revshare.matchedMemberSpendByCurrency,{USD:37.5});
assert.deepEqual(result.eventBreakdownByType.webmaster_commission.matchedPayoutsByCurrency,{EUR:3});
});
test('keeps negative payout adjustments signed and currencies separate',()=>{
const result=summarizeConversions([
{conversions:1,isTest:false,matchStatus:'matched',conversionType:'revshare_payout-adjustment',eventClass:'payout_adjustment',currency:'USD',matchedConversions:1,reportedPayout:'-2.25'},
{conversions:1,isTest:false,matchStatus:'matched',conversionType:'revshare_purchase',eventClass:'member_purchase_revshare',currency:'EUR',matchedConversions:1,reportedPayout:'3.20',reportedSpend:'16.00'}
]);
assert.deepEqual(result.attributedPayoutsByCurrency,{USD:-2.25,EUR:3.2});assert.deepEqual(result.illustrative20PercentByCurrency,{EUR:3.2});
});
