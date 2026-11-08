'use strict';
// Regression coverage for campaign-driven promotion targeting.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const promo = fs.readFileSync(path.join(__dirname, '../public/promo.js'), 'utf8');
const campaignCenter = fs.readFileSync(path.join(__dirname, '../public/campaign-center.html'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/promo-config.json'), 'utf8'));
const index = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

test('campaign links carry platform, audience country, room category and placement', () => {
  for (const key of ['ncf_platform', 'ncf_country', 'ncf_category', 'ncf_placement']) {
    assert.ok(campaignCenter.includes(`set('${key}'`), `campaign URL missing ${key}`);
    assert.ok(promo.includes(`get('${key}'`), `promo loader ignores ${key}`);
  }
  assert.match(campaignCenter, /utm_content/);
});

test('promotion loader applies the selected room category to partner feed requests', () => {
  assert.match(promo, /params\.set\('category', safeTargetCategory\)/);
  assert.match(promo, /new URLSearchParams\(\{ platform, sort: 'viewers', limit: '60' \}\)/);
});

test('promotion loader respects selected platform and audience country', () => {
  assert.match(promo, /safeTargetPlatform === 'bongacams'/);
  assert.match(promo, /safeTargetPlatform === 'chaturbate'/);
  assert.match(promo, /targetCountry === metaCountry/);
  assert.match(promo, /config\?\.enabled === false/);
});

test('outbound promo cards retain tracked redirects and campaign placement labels', () => {
  assert.match(promo, /content: campaignPlacement \? `\$\{campaignPlacement\}:\$\{placement\}` : placement/);
  assert.match(promo, /\/bgo\/\$\{encodeURIComponent\(room\.id\)\}/);
  assert.match(promo, /\/go\/\$\{encodeURIComponent\(room\.id\)\}/);
});

test('official banner assets are optional for both partners and a banner slot exists', () => {
  assert.equal(config.version, 2);
  assert.equal(config.chaturbate.bannerUrl, '');
  assert.equal(config.bongacams.bannerUrl, '');
  assert.match(index, /id="cb-banner-promo"/);
  for (const country of ['us','gb','no','ch','se','dk','au','ca','de','nl','fr','ie','fi','at','be','nz','is','lu']) assert.match(campaignCenter, new RegExp(`value="${country}"`));
});
