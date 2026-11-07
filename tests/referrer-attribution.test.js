import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appSource = fs.readFileSync(path.join(process.cwd(), "public/app.js"), "utf8");

test("external referrers are captured as referral attribution", () => {
  assert.match(appSource, /document\.referrer\s*\?\s*new URL\(document\.referrer\)/);
  assert.match(appSource, /normalizeReferralHost\(referrer\.hostname\)/);
  assert.match(appSource, /referrerHost\s*!==\s*currentHost/);
  assert.match(appSource, /medium:\s*incomingAttribution\.medium\s*\|\|\s*\(hasReferralAttribution\s*\?\s*"referral"/);
  assert.match(appSource, /campaign:\s*incomingAttribution\.campaign\s*\|\|\s*\(hasReferralAttribution\s*\?\s*"referral"/);
});

test("explicit source parameters take precedence while partial UTM tags retain referrer attribution", () => {
  assert.match(appSource, /const hasReferralAttribution\s*=\s*Boolean\(referralSource\)\s*&&\s*!incomingAttribution\.source\.trim\(\)/);
  assert.match(appSource, /source:\s*incomingAttribution\.source\s*\|\|\s*\(hasReferralAttribution\s*\?\s*referralSource/);
  assert.match(appSource, /hasReferralAttribution\s*=\s*Boolean\(referralSource\)\s*&&\s*!incomingAttribution\.source\.trim\(\)/);
});

test("same-site referrers are not recorded as external referral sources", () => {
  assert.match(appSource, /normalizeReferralHost\(referrer\.hostname\)/);
  assert.match(appSource, /normalizeReferralHost\(location\.hostname\)/);
  assert.match(appSource, /referrerHost\s*!==\s*currentHost/);
});

test("www and non-www versions of the same site are treated as same-site", () => {
  assert.match(appSource, /normalizeReferralHost\s*=\s*\(hostname\)\s*=>/);
  assert.match(appSource, /replace\(\/\^www\\\.\/\s*,\s*""\)/);
  assert.match(appSource, /normalizeReferralHost\(referrer\.hostname\)/);
  assert.match(appSource, /normalizeReferralHost\(location\.hostname\)/);
  assert.match(appSource, /referrerHost\s*!==\s*currentHost/);
});

test("external referral source stores the normalized hostname", () => {
  assert.match(appSource, /referralSource\s*=\s*referrerHost\.slice\(0,\s*30\)/);
});
