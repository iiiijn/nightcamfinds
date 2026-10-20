const http = require("http");
const crypto = require("crypto");

const originalCreateServer = http.createServer;
const databaseUrl = process.env.DATABASE_URL;
let pool = null;
try {
  if (databaseUrl) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: 5
    });
  }
} catch (err) {
  console.warn("Chaturbate postback database unavailable:", err.message);
}

async function ensurePostbackTables() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cb_clicks (
      click_id VARCHAR(128) PRIMARY KEY,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      country VARCHAR(2) NOT NULL,
      category VARCHAR(40) NOT NULL,
      source VARCHAR(40) NOT NULL,
      campaign VARCHAR(80) NOT NULL,
      placement VARCHAR(80) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cb_conversions (
      id BIGSERIAL PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      click_id VARCHAR(128),
      transaction_id VARCHAR(255),
      conversion_type VARCHAR(100),
      payout NUMERIC(18,6) DEFAULT 0,
      currency VARCHAR(16),
      amount NUMERIC(18,6),
      country VARCHAR(2),
      track VARCHAR(255),
      source VARCHAR(255),
      campaign_id VARCHAR(255),
      program_id VARCHAR(255),
      user_id VARCHAR(255),
      event_timestamp VARCHAR(100),
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE(transaction_id)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS cb_clicks_clicked_at_idx ON cb_clicks(clicked_at)");
  await pool.query("CREATE INDEX IF NOT EXISTS cb_conversions_click_id_idx ON cb_conversions(click_id)");
}

function clean(value, fallback = "unknown", max = 255) {
  const v = String(value || "").trim().slice(0, max);
  return v || fallback;
}

function country(req) {
  for (const value of [req.headers["cf-ipcountry"], req.headers["x-vercel-ip-country"], req.headers["cloudfront-viewer-country"], req.headers["x-country-code"]]) {
    const iso = String(value || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(iso) && iso !== "XX") return iso;
  }
  return "UNKNOWN";
}

function makeClickId() {
  return `ncf_${Date.now().toString(36)}_${crypto.randomBytes(9).toString("hex")}`;
}

async function saveClick(click) {
  if (!pool) return;
  try {
    await ensurePostbackTables();
    await pool.query(
      `INSERT INTO cb_clicks (click_id,country,category,source,campaign,placement) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (click_id) DO NOTHING`,
      [click.clickId, click.country, click.category, click.source, click.campaign, click.placement]
    );
  } catch (err) {
    console.error("Chaturbate click mapping failed:", err.message);
  }
}

async function saveConversion(params) {
  if (!pool) return;
  try {
    await ensurePostbackTables();
    const payout = Number.parseFloat(params.payout);
    const amount = Number.parseFloat(params.amount);
    await pool.query(
      `INSERT INTO cb_conversions
       (click_id,transaction_id,conversion_type,payout,currency,amount,country,track,source,campaign_id,program_id,user_id,event_timestamp,raw_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
       ON CONFLICT (transaction_id) DO NOTHING`,
      [
        clean(params.click_id, "", 128),
        clean(params.transaction_id, "", 255),
        clean(params.type, "unknown", 100),
        Number.isFinite(payout) ? payout : 0,
        clean(params.currency, "", 16),
        Number.isFinite(amount) ? amount : null,
        clean(params.country, "UNKNOWN", 2).toUpperCase(),
        clean(params.track, "", 255),
        clean(params.source, "", 255),
        clean(params.campaign_id, "", 255),
        clean(params.program_id, "", 255),
        clean(params.user_id, "", 255),
        clean(params.timestamp, "", 100),
        JSON.stringify(params)
      ]
    );
  } catch (err) {
    console.error("Chaturbate postback save failed:", err.message);
  }
}

http.createServer = function wrappedCreateServer(handler) {
  return originalCreateServer.call(http, async (req, res) => {
    const incoming = new URL(req.url, "http://localhost");

    if (incoming.pathname === "/cb/postback") {
      await saveConversion(Object.fromEntries(incoming.searchParams.entries()));
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      return res.end("OK");
    }

    let click = null;
    if (incoming.pathname.startsWith("/go/")) {
      click = {
        clickId: makeClickId(),
        country: country(req),
        category: clean(incoming.searchParams.get("cat"), "unknown", 40),
        source: clean(incoming.searchParams.get("utm_source") || incoming.searchParams.get("source"), "direct", 40),
        campaign: clean(incoming.searchParams.get("utm_campaign") || incoming.searchParams.get("campaign"), "unknown", 80),
        placement: clean(incoming.searchParams.get("src"), "card", 80)
      };
      await saveClick(click);
    }

    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = function(statusCode, headers, ...rest) {
      if (click && headers && headers.Location) {
        try {
          const target = new URL(headers.Location);
          target.searchParams.set("click_id", click.clickId);
          if (!target.searchParams.get("source") && click.source !== "direct") target.searchParams.set("source", click.source);
          headers = { ...headers, Location: target.toString() };
        } catch (_) {}
      }
      return originalWriteHead(statusCode, headers, ...rest);
    };

    return handler(req, res);
  });
};

require("./server.js");
