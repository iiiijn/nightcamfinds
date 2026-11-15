'use strict';

const crypto = require('node:crypto');
const net = require('node:net');

function normalizeClientIp(value) {
  const ip = String(value || '').trim().replace(/^\[|\]$/g, '');
  if (net.isIP(ip) === 4) return ip;
  if (net.isIP(ip) === 6 && ip.toLowerCase().startsWith('::ffff:')) {
    const mapped = ip.slice(7);
    return net.isIP(mapped) === 4 ? mapped : null;
  }
  return net.isIP(ip) === 6 ? ip.toLowerCase() : null;
}

function createPostgresRedirectRateLimiter({
  pool,
  secret,
  perMinuteIp = 20,
  perHourIp = 120,
  perMinuteVisit = 8,
  perHourVisit = 40,
  cleanupEvery = 1000
} = {}) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('A PostgreSQL pool is required');
  if (typeof secret !== 'string' || secret.length < 32) throw new TypeError('A stable secret of at least 32 characters is required');

  let checksSinceCleanup = 0;
  const hashKey = (scope, value) => crypto
    .createHmac('sha256', secret)
    .update(scope + ':' + value)
    .digest('hex');

  return async function checkRedirectRateLimit({ ip, visitId } = {}) {
    const entries = [];
    const normalizedIp = normalizeClientIp(ip);
    if (normalizedIp) entries.push({
      scope: 'ip',
      hash: hashKey('ip', normalizedIp),
      perMinute: perMinuteIp,
      perHour: perHourIp
    });
    const normalizedVisitId = String(visitId || '').trim().toLowerCase();
    if (/^[a-f0-9]{32}$/.test(normalizedVisitId)) entries.push({
      scope: 'visit',
      hash: hashKey('visit', normalizedVisitId),
      perMinute: perMinuteVisit,
      perHour: perHourVisit
    });
    if (!entries.length) return { allowed: true, limitedScopes: [] };

    // Lock in deterministic order to avoid deadlocks when a request has both
    // an IP and visit key. PostgreSQL advisory locks coordinate all instances.
    entries.sort((a, b) => a.hash.localeCompare(b.hash));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const entry of entries) {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [entry.hash]);
      }

      const limitedScopes = [];
      for (const entry of entries) {
        const result = await client.query(
          `SELECT
             COUNT(*) FILTER (WHERE requested_at >= NOW() - INTERVAL '1 minute')::int AS minute_count,
             COUNT(*)::int AS hour_count
           FROM affiliate_redirect_rate_limits
           WHERE key_hash = $1 AND requested_at >= NOW() - INTERVAL '1 hour'`,
          [entry.hash]
        );
        const counts = result.rows[0] || {};
        if (Number(counts.minute_count || 0) >= entry.perMinute ||
            Number(counts.hour_count || 0) >= entry.perHour) {
          limitedScopes.push(entry.scope);
        }
      }

      if (limitedScopes.length) {
        await client.query('COMMIT');
        return { allowed: false, limitedScopes };
      }

      for (const entry of entries) {
        await client.query(
          'INSERT INTO affiliate_redirect_rate_limits (key_hash) VALUES ($1)',
          [entry.hash]
        );
      }

      checksSinceCleanup += 1;
      if (checksSinceCleanup >= cleanupEvery) {
        checksSinceCleanup = 0;
        await client.query(
          "DELETE FROM affiliate_redirect_rate_limits WHERE requested_at < NOW() - INTERVAL '2 hours'"
        );
      }
      await client.query('COMMIT');
      return { allowed: true, limitedScopes: [] };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      client.release();
    }
  };
}

module.exports = { createPostgresRedirectRateLimiter, normalizeClientIp };
