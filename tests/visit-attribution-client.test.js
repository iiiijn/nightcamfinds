'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const helper = fs.readFileSync(path.join(__dirname, '../public/visit-tracking.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const country = fs.readFileSync(path.join(__dirname, '../country-pages.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

test('visit identifier helper falls back to a same-origin session cookie when sessionStorage is unavailable', () => {
  assert.match(helper, /sessionStorage\.getItem\('ncf_visit_id'\)/);
  assert.match(helper, /readCookie\('ncf_visit_id'\)/);
  assert.match(helper, /writeCookie\('ncf_visit_id', id\)/);
  assert.match(helper, /Path=\/; SameSite=Lax/);
  assert.match(helper, /; Secure/);
  assert.match(helper, /getRandomValues/);
  assert.match(helper, /\[a-f0-9\]\{32\}/);
});

test('main directory loads shared tracking helper before its application script', () => {
  assert.ok(index.indexOf('/visit-tracking.js') < index.indexOf('/app.js'));
  assert.match(app, /NCFVisitTracking\.getVisitId\(\)/);
  assert.match(app, /NCFVisitTracking\.getLandingPath\(location\.pathname\)/);
  assert.match(app, /vid: visitId/);
});

test('country pages load shared tracking helper before applying visit IDs to affiliate links', () => {
  assert.ok(country.indexOf('<script src="/visit-tracking.js"></script>') < country.indexOf('const countrySlug'));
  assert.match(country, /NCFVisitTracking\.getVisitId\(\)/);
  assert.match(country, /NCFVisitTracking\.getLandingPath\(location\.pathname\)/);
  assert.match(country, /vid: visitId/);
});

test('redirect handler validates and persists the visit ID supplied by directory links', () => {
  assert.match(server, /url\.searchParams\.get\("vid"\)/);
  assert.match(server, /visitId, visitIdSource, visitIdConflict, landingPath/);
});

test('privacy notice discloses the temporary analytics session cookie', () => {
  assert.match(server, /temporary first-party session cookie containing a random visit identifier/);
});
