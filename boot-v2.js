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
const CB_POSTBACK_SECRET = process.env.CB_POSTBACK_SECRET || '';
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
  const from=url.searchParams.get('from'), to=url.searchParams.get('to'), platform=url.searchParams.get('platform');
  const params=[], clauses=["platform='chaturbate'"];
  const add=(v,sql)=>{params.push(v);clauses.push(sql.replace("?", "$"+params.length));};
  if(from && /^\d{4}-\d{2}-\d{2}$/.test(from)) add(from,"COALESCE(event_timestamp,received_at) >= ?::date");
  if(to && /^\d{4}-\d{2}-\d{2}$/.test(to)) add(to,"COALESCE(event_timestamp,received_at) < (?::date + INTERVAL '1 day')");
  if(platform && platform!=="chaturbate") return {primaryMetric:'chaturbate_revshare',events:0,revenue:0,trackedClicks:0,matchedEvents:0,unmatchedEvents:0,epc:0,byCountry:[],bySource:[]};
  const where=clauses.join(' AND ');
  const total=await pool.query(\`SELECT COUNT(*)::int events,
    COALESCE(SUM(payout) FILTER (WHERE revenue_class IN ('revshare','revshare_adjustment')),0)::numeric revenue,
    COUNT(*) FILTER (WHERE matched_click)::int matched_events
    FROM affiliate_conversions WHERE \${where}\`,params);
  const byCountry=await pool.query(\`SELECT country,COUNT(*)::int events,
    COALESCE(SUM(payout) FILTER (WHERE revenue_class IN ('revshare','revshare_adjustment')),0)::numeric revenue
    FROM affiliate_conversions WHERE \${where} GROUP BY country ORDER BY revenue DESC\`,params);
  const bySource=await pool.query(\`SELECT COALESCE(NULLIF(c.source,''),'unknown') source,
    COUNT(DISTINCT v.transaction_id)::int conversions,COALESCE(SUM(v.payout) FILTER (WHERE v.revenue_class IN ('revshare','revshare_adjustment')),0)::numeric revenue
    FROM affiliate_conversions v LEFT JOIN affiliate_clicks c ON c.click_id=v.click_id
    WHERE \${where.replaceAll('platform=', 'v.platform=')} GROUP BY c.source ORDER BY revenue DESC\`,params);
  const clickParams=[], clickWhere=["platform='chaturbate'"];
  const cadd=(v,sql)=>{clickParams.push(v);clickWhere.push(sql.replace("?", "$"+clickParams.length));};
  if(from && /^\d{4}-\d{2}-\d{2}$/.test(from)) cadd(from,"clicked_at >= ?::date");
  if(to && /^\d{4}-\d{2}-\d{2}$/.test(to)) cadd(to,"clicked_at < (?::date + INTERVAL '1 day')");
  const clicks=Number((await pool.query(\`SELECT COUNT(*)::int n FROM affiliate_clicks WHERE \${clickWhere.join(' AND ')}\`,clickParams)).rows[0]?.n||0);
  const row=total.rows[0]||{}, revenue=Number(row.revenue||0);
  return {primaryMetric:'chaturbate_revshare',events:Number(row.events||0),revenue,trackedClicks:clicks,matchedEvents:Number(row.matched_events||0),
    unmatchedEvents:Number(row.events||0)-Number(row.matched_events||0),epc:clicks?revenue/clicks:0,
    byCountry:byCountry.rows.map(r=>({country:r.country,events:Number(r.events),revenue:Number(r.revenue)})),
    bySource:bySource.rows.map(r=>({source:r.source,conversions:Number(r.conversions),revenue:Number(r.revenue)}))};
}

http.createServer = function wrappedCreateServer(requestListener) {
  return originalCreateServer.call(http, async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/cb/postback') {
      try {
        if (CB_POSTBACK_SECRET && url.searchParams.get('secret') !== CB_POSTBACK_SECRET) return send(res, 403, JSON.stringify({ ok: false, error: 'invalid_postback_secret' }));
        if (!CB_POSTBACK_SECRET && process.env.NODE_ENV === 'production') return send(res, 503, JSON.stringify({ ok: false, error: 'postback_secret_not_configured' }));
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
