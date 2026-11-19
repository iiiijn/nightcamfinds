'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const homepage = fs.readFileSync('public/index.html', 'utf8');
const homepageCss = fs.readFileSync('public/homepage-refinement.css', 'utf8');
const broadcast = fs.readFileSync('public/broadcast.html', 'utf8');

test('homepage presents separate viewer and adult-creator journeys', () => {
  assert.match(homepage, /<section class="hero" aria-label="Choose how to use NightCamFinds">/);
  assert.match(homepage, /href="#category-rows" data-ncf-path="viewer"/);
  assert.match(homepage, /href="\\/broadcast\\/" data-ncf-path="model"/);
  assert.match(homepage, /Browse live rooms/);
  assert.match(homepage, /Become a broadcaster/);
});

test('homepage hero is visible and responsive rather than hidden by refinement CSS', () => {
  assert.doesNotMatch(homepageCss, /#top>\\.hero\\s*\\{\\s*display\\s*:\\s*none\\s*!important/);
  assert.match(homepageCss, /#top > \\.hero\\s*\\{[\\s\\S]*?display:\\s*grid/);
  assert.match(homepageCss, /@media \\(max-width: 760px\\)/);
  assert.match(homepageCss, /@media \\(max-width: 460px\\)/);
});

test('model recruitment page explains the process and preserves both official referral URLs', () => {
  assert.match(broadcast, /Choose your platform\\. Build your creator business\\./);
  assert.match(broadcast, /Complete the official registration and verification/);
  assert.match(broadcast, /data-ncf-referral-type="model" data-ncf-platform="chaturbate"/);
  assert.match(broadcast, /https:\\/\\/chaturbate\\.com\\/in\\/\\?tour=LQps&amp;campaign=C6yxN&amp;track=broadcast/);
  assert.match(broadcast, /data-ncf-referral-type="model" data-ncf-platform="bongacams"/);
  assert.match(broadcast, /https:\\/\\/bongacash\\.com\\/model-ref\\?c=840974/);
  assert.match(broadcast, /Separate referral paths/);
});
