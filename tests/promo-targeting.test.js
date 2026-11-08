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

test('BongaCash banner distinguishes iframe load from a viewable placement', () => {
  assert.match(promo, /bonga_banner_loaded/);
  assert.match(promo, /bonga_banner_viewable/);
  assert.match(promo, /intersectionRatio >= 0\.5/);
  assert.match(promo, /}, 1000\)/);
  assert.match(promo, /visibilityObserver\.disconnect\(\)/);
});

test('official banner assets are optional for both partners and a banner slot exists', () => {
  assert.equal(config.version, 5);
  assert.equal(config.chaturbate.bannerUrl, '');
  assert.equal(config.bongacams.bannerUrl, '');
  assert.equal(config.bongacams.campaignId, '840970');
  assert.equal(config.bongacams.format, 'dynamic_banner');
  assert.equal(new URL(config.bongacams.iframeUrl).hostname, 'bngdin.com');
  assert.equal(new URL(config.bongacams.iframeUrl).searchParams.get('c'), '840970');
  assert.equal(new URL(config.bongacams.iframeUrl).searchParams.get('db[models_by_geo]'), '1');
  assert.equal(config.bongacams.modelsByGeo, true);
  assert.match(promo, /renderBongaDynamicBanner\(config\.bongacams\)/);
  assert.match(promo, /bonga_banner_loaded/);
  assert.match(promo, /source\.hostname !== 'bngdin\.com'/);
  assert.match(index, /id="cb-banner-promo"/);
  assert.match(index, /id="bonga-dynamic-banner"/);
  assert.match(fs.readFileSync(path.join(__dirname, '../public/styles.css'), 'utf8'), /bonga-dynamic-frame/);
  for (const country of ['us','gb','no','ch','se','dk','au','ca','de','nl','fr','ie','fi','at','be','nz','is','lu']) assert.match(campaignCenter, new RegExp(`value="${country}"`));
});

test('BongaCash static banner configuration validates campaign, creative and 300x250 dimensions', () => {
  assert.equal(config.version, 5);
  assert.equal(config.bongacams.staticBanners.length, 3);
  const [general, categoryOne, categoryTwo] = config.bongacams.staticBanners;
  assert.equal(general.enabled, true);
  assert.equal(general.targetCategory, 'all');
  assert.equal(categoryOne.enabled, false);
  assert.equal(categoryTwo.enabled, false);
  for (const item of config.bongacams.staticBanners) {
    const url = new URL(item.iframeUrl);
    assert.equal(url.hostname, 'bngprm.com');
    assert.equal(url.searchParams.get('c'), '840970');
    assert.equal(url.searchParams.get('type'), 'banner');
    assert.equal(url.searchParams.get('size'), '300x250');
    assert.equal(url.searchParams.get('name'), item.id);
    assert.equal(item.width, 300);
    assert.equal(item.height, 250);
  }
  assert.match(promo, /renderBongaStaticBanners\(config\.bongacams\)/);
  assert.match(promo, /bonga_static_banner_loaded/);
  assert.match(promo, /bonga_static_banner_viewable/);
  assert.match(index, /id="bonga-static-banners"/);
});


test('BongaCash category widget uses the exact account-generated campaign URL and safe placement', () => {
  const widget = config.bongacams.categoryWidget;
  assert.equal(config.version, 5);
  assert.equal(widget.enabled, true);
  assert.equal(widget.campaignId, '840970');
  assert.equal(widget.format, 'category_widget');
  assert.equal(widget.language, 'user_ip');
  assert.equal(widget.section, 'straight');
  assert.equal(widget.width, 200);
  assert.equal(widget.layout, 'button1');
  const url = new URL(widget.scriptUrl);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'bngprm.com');
  assert.equal(url.pathname, '/promo.php');
  assert.equal(url.searchParams.get('c'), '840970');
  assert.equal(url.searchParams.get('type'), 'category_widget');
  assert.equal(url.searchParams.get('bg_color'), '#ffffff');
  assert.equal(url.searchParams.get('btn_color'), '#690034');
  assert.equal(url.searchParams.get('font_size'), '14');
  assert.equal(url.searchParams.get('font_color'), '#ccd0d0');
  assert.equal(url.searchParams.get('section'), 'straight');
  assert.match(promo, /renderBongaCategoryWidget\(config\.bongacams\?\.categoryWidget\)/);
  assert.match(promo, /source\.searchParams\.get\('type'\) !== 'category_widget'/);
  assert.match(promo, /bonga_category_widget_loaded/);
  assert.match(promo, /bonga_category_widget_viewable/);
  assert.match(index, /id="bonga-category-widget"/);
});
