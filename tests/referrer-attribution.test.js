import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appSource = fs.readFileSync(path.join(process.cwd(), "public/app.js"), "utf8");

test("external referrers are captured as referral attribution", () => {
  assert.match(appSource, /document\.referrer\s*\?\s*new URL\(document\.referrer\)/);
  assert.match(appSource, /referrer\.hostname\s*!==\s*location\.hostname/);
  assert.match(appSource, /medium:\s*incomingAttribution\.medium\s*\|\|\s*\(hasReferralAttribution\s*\?\s*"referral"/);
  assert.match(appSource, /campaign:\s*incomingAttribution\.campaign\s*\|\|\s*\(hasReferralAttribution\s*\?\s*"referral"/);
});

test("explicit campaign parameters take precedence over referrer attribution", () => {
  assert.match(appSource, /const hasReferralAttribution\s*=\s*Boolean\(referralSource\)\s*&&\s*!hasExplicitAttribution/);
  assert.match(appSource, /source:\s*incomingAttribution\.source\s*\|\|\s*\(hasReferralAttribution\s*\?\s*referralSource/);
});

test("same-site referrers are not recorded as external referral sources", () => {
  assert.match(appSource, /referrer\.hostname\s*!==\s*location\.hostname/);
});
