'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const homepage = fs.readFileSync('public/index.html', 'utf8');
const homepageCss = fs.readFileSync('public/homepage-refinement.css', 'utf8');
const app = fs.readFileSync('public/app.js', 'utf8');
const broadcast = fs.readFileSync('public/broadcast.html', 'utf8');

test('homepage presents live discovery first with separate viewer and adult-creator actions', () => {
  assert.ok(homepage.includes('<section class="directory-section" aria-label="Live room directory">'));
  assert.ok(homepage.includes('href="#category-rows" data-ncf-path="viewer"'));
  assert.ok(homepage.includes('href="/broadcast/" data-ncf-path="model"'));
  assert.ok(homepage.includes('Browse live rooms'));
  assert.ok(homepage.includes('Become a broadcaster'));
  assert.ok(!homepage.includes('<section class="hero" aria-label="Choose how to use NightCamFinds">'));
});

test('client-side homepage copy does not require a removed hero section', () => {
  assert.ok(app.includes('const pageIntro = document.querySelector("#page-intro");'));
  assert.ok(app.includes('if (pageIntro) pageIntro.textContent = page[2];'));
});

test('homepage refinement keeps the directory-first layout responsive', () => {
  assert.ok(homepageCss.includes('Directory-first homepage:'));
  assert.ok(homepageCss.includes('.directory-section'));
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

test('homepage broadcaster banner has one clear model CTA and preserves truthful eligibility disclosure', () => {
  const banner = homepage.match(/<section class="broadcaster-sidebar"[\\s\\S]*?<\\/section>/)?.[0] || '';
  assert.ok(banner.includes('Ready to become a model?'));
  assert.ok(banner.includes('href="/broadcast/" data-ncf-path="model" data-ncf-placement="home-broadcaster-banner"'));
  assert.ok(banner.includes('Become a Model'));
  assert.ok(banner.includes('Compare Chaturbate and BongaCams'));
  assert.ok(banner.includes('Earnings vary and are not guaranteed.'));
  assert.equal((banner.match(/class="[^"]*creator-primary-cta/g) || []).length, 1);
});
