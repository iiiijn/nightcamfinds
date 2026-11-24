'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Cloudflare origin Worker overwrites visitor-supplied authentication headers', () => {
  const worker = fs.readFileSync(path.join(__dirname, '../cloudflare/nightcamfinds-origin-auth.js'), 'utf8');
  assert.match(worker, /headers\.delete\("x-ncf-origin-auth"\)/);
  assert.match(worker, /headers\.set\("x-ncf-origin-auth", bongaSecret\)/);
  assert.match(worker, /headers\.delete\("x-ncf-cloudflare-auth"\)/);
  assert.match(worker, /headers\.set\("x-ncf-cloudflare-auth", cloudflareOriginSecret\)/);
  assert.match(worker, /cloudflareOriginSecret\.length >= 32/);
  assert.match(worker, /new Request\(request, \{ headers \}\)/);
  assert.doesNotMatch(worker, /NCF_CLOUDFLARE_ORIGIN_SECRET\s*[:=]\s*["'][^"']/);
});

test('redirect limiter and Cloudflare Worker use the same independent origin-auth header', () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const worker = fs.readFileSync(path.join(__dirname, '../cloudflare/nightcamfinds-origin-auth.js'), 'utf8');
  assert.match(server, /req\.headers\["x-ncf-cloudflare-auth"\]/);
  assert.match(server, /NCF_CLOUDFLARE_ORIGIN_SECRET/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /normalizeClientIp\(req\.headers\["cf-connecting-ip"\]\)/);
  assert.match(worker, /x-ncf-cloudflare-auth/);
  assert.match(worker, /NCF_CLOUDFLARE_ORIGIN_SECRET/);
});

test('Cloudflare Worker keeps BongaCash V2 authentication independent', () => {
  const worker = fs.readFileSync(path.join(__dirname, '../cloudflare/nightcamfinds-origin-auth.js'), 'utf8');
  const bonga = fs.readFileSync(path.join(__dirname, '../src/services/bongacash-api-v2.cjs'), 'utf8');
  assert.match(worker, /NCF_ORIGIN_AUTH_SECRET/);
  assert.match(worker, /x-ncf-origin-auth/);
  assert.match(bonga, /ORIGIN_AUTH_HEADER = "x-ncf-origin-auth"/);
  assert.match(bonga, /hasAuthenticatedOrigin/);
});
