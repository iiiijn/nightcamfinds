'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const homepage = fs.readFileSync('public/index.html', 'utf8');
const styles = fs.readFileSync('public/homepage-refinement.css', 'utf8');
const broadcast = fs.readFileSync('public/broadcast.html', 'utf8');
const route = fs.readFileSync('route.js', 'utf8');

test('creator acquisition CTA is placed before the room directory', () => {
  const heading = homepage.indexOf('class="section-heading"');
  const cta = homepage.indexOf('class="creator-entry-cta"');
  const directory = homepage.indexOf('class="directory-layout"');
  assert.ok(heading >= 0 && cta > heading && directory > cta);
  assert.match(homepage, /href="\/broadcast\/" data-ncf-path="model" data-ncf-placement="home-top-cta"/);
  assert.match(homepage, />Become a Model/);
});

test('creator acquisition CTA remains full-width and visible on mobile', () => {
  assert.match(styles, /\.directory-section \.creator-entry-cta[\s\S]*?width: fit-content/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.directory-section \.creator-entry-cta[\s\S]*?width: 100%/);
  assert.match(styles, /focus-visible/);
});

test('provider-reported earnings and BongaCash manual reconciliation remain explicit', () => {
  assert.match(route, /Automatic BongaCash postbacks are disabled/);
  assert.match(route, /reconciliation: "manual"/);
  assert.match(route, /Payouts remain separated by currency and are provider-reported, not verified cash received/);
});

test('model registration referrals remain separate from viewer room referrals', () => {
  assert.match(broadcast, /data-ncf-referral-type="model"/);
  assert.match(broadcast, /data-ncf-platform="chaturbate"/);
  assert.match(broadcast, /data-ncf-platform="bongacams"/);
  assert.match(broadcast, /These are model-recruitment links, not viewer room links/);
});
