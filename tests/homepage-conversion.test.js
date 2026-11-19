'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const homepage = fs.readFileSync('public/index.html', 'utf8');
const homepageCss = fs.readFileSync('public/homepage-refinement.css', 'utf8');
const app = fs.readFileSync('public/app.js', 'utf8');
const broadcast = fs.readFileSync('public/broadcast.html', 'utf8');

test('homepage presents separate viewer and adult-creator journeys', () => {
  assert.ok(homepage.includes('<section class="hero" aria-label="Choose how to use NightCamFinds">'));
  assert.ok(homepage.includes('href="#category-rows" data-ncf-path="viewer"'));
  assert.ok(homepage.includes('href="/broadcast/" data-ncf-path="model"'));
  assert.ok(homepage.includes('Browse live rooms'));
  assert.ok(homepage.includes('Become a broadcaster'));
});

test('client-side homepage copy does not blank the restored hero', () => {
  assert.ok(app.includes('all: ["Independent discovery", "Who\'s live in your country, tonight."'));
});

test('homepage hero is visible and responsive rather than hidden by refinement CSS', () => {
  assert.ok(!homepageCss.includes('#top>.hero{display:none!important}'));
  assert.ok(homepageCss.includes('#top > .hero {\n  display: grid'));
  assert.ok(homepageCss.includes('@media (max-width: 760px)'));
  assert.ok(homepageCss.includes('@media (max-width: 460px)'));
});

test('model recruitment page explains the process and preserves both official referral URLs', () => {
  assert.ok(broadcast.includes('Choose your platform. Build your creator business.'));
  assert.ok(broadcast.includes('Complete the official registration and verification'));
  assert.ok(broadcast.includes('data-ncf-referral-type="model" data-ncf-platform="chaturbate"'));
  assert.ok(broadcast.includes('https://chaturbate.com/in/?tour=LQps&amp;campaign=C6yxN&amp;track=broadcast'));
  assert.ok(broadcast.includes('data-ncf-referral-type="model" data-ncf-platform="bongacams"'));
  assert.ok(broadcast.includes('https://bongacash.com/model-ref?c=840974'));
  assert.ok(broadcast.includes('Separate referral paths'));
});
