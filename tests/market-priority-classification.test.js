'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MARKET_PRIORITY_CODES, isPriorityMarket } = require('../src/config/market-countries.cjs');

test('the canonical priority market list contains exactly the approved 18 markets', () => {
  assert.deepEqual(MARKET_PRIORITY_CODES, ['US','GB','NO','CH','SE','DK','AU','CA','DE','NL','FR','IE','FI','AT','BE','NZ','IS','LU']);
  assert.equal(new Set(MARKET_PRIORITY_CODES).size, 18);
});

test('priority market classification is case-insensitive and excludes the former JP/SG entries', () => {
  for (const code of MARKET_PRIORITY_CODES) assert.equal(isPriorityMarket(code.toLowerCase()), true, code);
  assert.equal(isPriorityMarket('JP'), false);
  assert.equal(isPriorityMarket('SG'), false);
  assert.equal(isPriorityMarket('KE'), false);
  assert.equal(isPriorityMarket(''), false);
});

test('both public room API and admin Tier 1 totals use the canonical helper', () => {
  const root = path.join(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const route = fs.readFileSync(path.join(root, 'route.js'), 'utf8');
  assert.match(server, /tier1:isPriorityMarket\(visitorCountry\(req\)\)/);
  assert.match(route, /if \(!isPriorityMarket\(row\.country\)\) continue;/);
});
