const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const revshare = require('./affiliate/chaturbate-revshare');

let Pool = null;
try { ({ Pool } = require('pg')); } catch (_) {}
const pool = Pool && process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 5
    })
  : null;

const STATS_KEY = process.env.STATS_KEY || '';
const originalCreateServer = http.createServer;

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function authorized(url) {
  return Boolean(STATS_KEY && url.searchParams.get('key') === STATS_KEY);
}

async function revenueSummary(url) {
  if (!pool) throw new Error('Database is not configured');
  await revshare.ensureTables(pool);

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const params = [];
  const where = ["platform = 'chaturbate'", "revenue_class = 'revshare'"];
  if (from) { params.push(`${from}T00:00:00.000Z`); where.push(`COALESCE(event_timestamp, received_at) >= $${params.length}`); }
  if (to) { params.push(`${to}T23:59:59.999Z`); where.push(`COALESCE(event_timestamp, received_at) <= $${params.length}`); }
  const clause = where.join(' AND ');

  const total = await pool.query(`
    SELECT
      COUNT(*)::int AS events,
      COALESCE(SUM(payout),0)::numeric AS revenue,
      COUNT(DISTINCT click_id)::int AS attributed_clicks,
      COUNT(*) FILTER (WHERE matched_click)::int AS matched_events
    FROM affiliate_conversions
    WHERE ${clause}
  `, params);

  const byCountry = await pool.query(`
    SELECT country,
      COUNT(*)::int AS events,
      COALESCE(SUM(payout),0)::numeric AS revenue
    FROM affiliate_conversions
    WHERE ${clause}
    GROUP BY country
    ORDER BY revenue DESC
  `, params);

  const bySource = await pool.query(`
    SELECT c.source, c.medium, c.campaign,
      COUNT(DISTINCT c.click_id)::int AS clicks,
      COUNT(DISTINCT v.transaction_id)::int AS conversions,
      COALESCE(SUM(v.payout),0)::numeric AS revenue
    FROM affiliate_conversions v
    JOIN affiliate_clicks c ON c.click_id = v.click_id
    WHERE ${clause}
    GROUP BY c.source, c.medium, c.campaign
    ORDER BY revenue DESC
  `, params);

  const row = total.rows[0] || {};
  const revenue = Number(row.revenue || 0);
  const clicks = Number(row.attributed_clicks || 0);
  return {
    primaryMetric: 'chaturbate_revshare',
    events: Number(row.events || 0),
    revenue,
    attributedClicks: clicks,
    matchedEvents: Number(row.matched_events || 0),
    epc: clicks ? revenue / clicks : 0,
    byCountry: byCountry.rows.map(r => ({ country: r.country, events: Number(r.events), revenue: Number(r.revenue) })),
    bySource: bySource.rows.map(r => ({ source: r.source, medium: r.medium, campaign: r.campaign, clicks: Number(r.clicks), conversions: Number(r.conversions), revenue: Number(r.revenue), epc: Number(r.clicks) ? Number(r.revenue) / Number(r.clicks) : 0 }))
  };
}

http.createServer = function wrappedCreateServer(requestListener) {
  return originalCreateServer.call(http, async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/cb/postback') {
      try {
        if (!pool) return send(res, 503, JSON.stringify({ ok: false, error: 'database_not_configured' }));
        const result = await revshare.handle(pool, url.searchParams);
        console.log('Chaturbate postback', result);
        return send(res, 200, JSON.stringify({ ok: true, ...result }));
      } catch (err) {
        console.error('Chaturbate postback failed:', err);
        return send(res, 500, JSON.stringify({ ok: false, error: 'postback_processing_failed' }));
      }
    }

    if (url.pathname === '/api/revenue') {
      if (!authorized(url)) return send(res, 404, JSON.stringify({ error: 'not_found' }));
      try {
        return send(res, 200, JSON.stringify(await revenueSummary(url)));
      } catch (err) {
        console.error('Revenue API failed:', err);
        return send(res, 500, JSON.stringify({ error: 'revenue_query_failed' }));
      }
    }

    return requestListener(req, res);
  });
};

require('./server-v2');
