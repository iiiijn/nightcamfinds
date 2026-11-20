'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const dashboard=fs.readFileSync(path.join(__dirname,'../public/dashboard.html'),'utf8');
const business=fs.readFileSync(path.join(__dirname,'../public/dashboard-business.js'),'utf8');

test('business dashboard presents simple decision-focused metrics and readable country names',()=>{
  assert.match(dashboard,/Total affiliate clicks/);
  assert.match(dashboard,/Tier 1 country clicks/);
  assert.match(dashboard,/Tier 1 member signup events/);
  assert.match(dashboard,/All matched member signup events/);
  assert.match(dashboard,/Matched broadcaster referral events/);
  assert.match(dashboard,/Countries bringing the most clicks/);
  assert.match(dashboard,/Countries bringing member signups/);
  assert.match(dashboard,/United States/);
  assert.match(dashboard,/United Kingdom/);
  assert.match(dashboard,/Germany/);
});

test('dashboard restores five sections and retains monthly business reporting in Overview',()=>{
  assert.match(dashboard,/dashboard-business\.js/);
  for(const [tab,label] of [['overview','Overview'],['traffic','Traffic Intelligence'],['investigation','Click Investigation'],['revenue','Revenue & Conversions'],['health','Tracking & System Health']]){
    assert.ok(business.includes("['"+tab+"','"+label+"']"), 'missing '+label+' navigation');
  }
  assert.match(business,/monthlyPanel.*navGroup='overview'/);
  assert.match(business,/nativeMonthlyLoader.*monthly/);
  assert.match(business,/setDashboardTab.*overview/);
});

test('Tier 1 signup KPI only counts matched non-test member signup events by postback country',()=>{
  assert.match(dashboard,/real=events\.filter\(x=>!x\.isTest/);
  assert.match(dashboard,/matchedRows=real\.filter\(x=>x\.matchStatus==='matched'\)/);
  assert.ok(dashboard.includes("tier1SignupEvents=signupRows.filter(x=>tier1.has(String(x.country||'').toUpperCase())"));
  assert.match(dashboard,/member signup events/);
  assert.match(dashboard,/Redirects are not unique visitors/);
});
