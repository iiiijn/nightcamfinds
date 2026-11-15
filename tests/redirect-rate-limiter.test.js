'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPostgresRedirectRateLimiter, normalizeClientIp } = require('../src/services/redirect-rate-limiter.cjs');

function makePool() {
  const events = new Map();
  const calls = [];
  return {
    events,
    calls,
    async connect() {
      return {
        async query(sql, params = []) {
          calls.push({ sql, params });
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' ||
              sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [], rowCount: 0 };
          if (sql.includes('COUNT(*) FILTER')) {
            const rows = events.get(params[0]) || [];
            return { rows: [{ minute_count: rows.length, hour_count: rows.length }], rowCount: 1 };
          }
          if (sql.startsWith('INSERT INTO affiliate_redirect_rate_limits')) {
            const rows = events.get(params[0]) || [];
            rows.push(Date.now());
            events.set(params[0], rows);
            return { rows: [], rowCount: 1 };
          }
          if (sql.startsWith('DELETE FROM affiliate_redirect_rate_limits')) return { rows: [], rowCount: 0 };
          throw new Error('Unexpected SQL in rate limiter test: ' + sql);
        },
        release() {}
      };
    }
  };
}

test('normalizes IPv4, IPv6 and IPv4-mapped addresses while rejecting spoofed lists', () => {
  assert.equal(normalizeClientIp('203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeClientIp('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeClientIp('2001:db8::1'), '2001:db8::1');
  assert.equal(normalizeClientIp('203.0.113.7, 198.51.100.2'), null);
  assert.equal(normalizeClientIp('not-an-ip'), null);
});

test('persists per-visit limits and does not trust query-string IDs unless caller validates cookie origin', async () => {
  const pool = makePool();
  const limit = createPostgresRedirectRateLimiter({ pool, secret: 's'.repeat(48), perMinuteVisit: 2, perHourVisit: 3 });
  const visitId = 'a'.repeat(32);
  assert.deepEqual(await limit({ visitId }), { allowed: true, limitedScopes: [] });
  assert.deepEqual(await limit({ visitId }), { allowed: true, limitedScopes: [] });
  assert.deepEqual(await limit({ visitId }), { allowed: false, limitedScopes: ['visit'] });
  assert.equal(pool.events.size, 1);
  const inserted = pool.calls.filter(call => call.sql.startsWith('INSERT INTO affiliate_redirect_rate_limits'));
  assert.equal(inserted.length, 2);
  assert.match(inserted[0].params[0], /^[a-f0-9]{64}$/);
  assert.equal(inserted[0].params[0].includes(visitId), false);
});

test('enforces IP and visit limits together and reports only the limited scope', async () => {
  const pool = makePool();
  const limit = createPostgresRedirectRateLimiter({ pool, secret: 's'.repeat(48), perMinuteIp: 1, perHourIp: 2 });
  assert.deepEqual(await limit({ ip: '203.0.113.10', visitId: 'b'.repeat(32) }), { allowed: true, limitedScopes: [] });
  assert.deepEqual(await limit({ ip: '203.0.113.10', visitId: 'c'.repeat(32) }), { allowed: false, limitedScopes: ['ip'] });
  assert.ok(pool.calls.some(call => call.sql.startsWith('SELECT pg_advisory_xact_lock')));
});

test('requires PostgreSQL and a stable secret; storage errors propagate for fail-closed redirects', async () => {
  assert.throws(() => createPostgresRedirectRateLimiter({ pool: null, secret: 's'.repeat(48) }), /PostgreSQL pool/);
  assert.throws(() => createPostgresRedirectRateLimiter({ pool: makePool(), secret: 'short' }), /32 characters/);
  const broken = { async connect() { throw new Error('database unavailable'); } };
  const limit = createPostgresRedirectRateLimiter({ pool: broken, secret: 's'.repeat(48) });
  await assert.rejects(limit({ ip: '203.0.113.10' }), /database unavailable/);
});

test('redirect handler rate-limits only trusted Cloudflare IPs and established first-party visit cookies', () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(server, /NCF_CLOUDFLARE_ORIGIN_SECRET/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /normalizeClientIp\(req\.headers\["cf-connecting-ip"\]\)/);
  assert.match(server, /visitId: visitIdOrigin === "cookie" \? visitId : null/);
  assert.match(server, /affiliate_redirect_rate_limit_storage_error/);
  assert.match(server, /Retry-After/);
  assert.match(server, /affiliate_redirect_rate_limits/);
  const migration = fs.readFileSync(path.join(__dirname, '../sql/012_redirect_rate_limits.sql'), 'utf8');
  assert.match(migration, /key_hash CHAR\(64\) NOT NULL/);
  assert.doesNotMatch(migration, /CREATE TABLE[^;]*(ip_address|visit_id)/i);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});
