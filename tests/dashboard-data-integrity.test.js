'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('headline Chaturbate revenue excludes test callbacks and non-USD payouts', () => {
  const source = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  assert.match(source, /NOT EXISTS \(SELECT 1 FROM jsonb_each_text\(COALESCE\(cb_conversions\.raw_payload, '\{\}'::jsonb\)\)/);
  assert.match(source, /UPPER\(COALESCE\(currency,''\)\)='USD'/);
});

test('dashboard country summary contains click geography only', () => {
  const source = fs.readFileSync(path.join(__dirname, '../route.js'), 'utf8');
  assert.match(source, /const combinedCountries = \{ \.\.\.countries \};/);
  assert.doesNotMatch(source, /for \(const row of bonga\.byCountry\) combinedCountries/);
});
