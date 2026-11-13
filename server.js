const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { rankRoomsByPreferredPlatform } = require("./src/services/platform-ranking.cjs");
const { getCountryPage } = require("./country-pages.js");
const { renderRoomCards, renderHeroCopy, plainText } = require("./src/services/room-page-renderer.cjs");
const { classifyUserAgent } = require("./src/services/traffic-quality.cjs");
const { buildChaturbateUrl } = require("./src/services/chaturbate-revshare.cjs");
const { resolveVisitIdentity, buildVisitCookieHeaders } = require("./src/services/visit-id-attribution.cjs");
const { isPriorityMarket, MARKET_META, MARKET_PRIORITY_CODES } = require("./src/config/market-countries.cjs");
const { fetchPagedResults } = require("./src/services/paged-feed.cjs");
const { resolveRegionalMaxPages } = require("./src/services/regional-feed-config.cjs");
const { filterDisplayableRooms, normalizeRoomGender } = require("./src/services/room-quality.cjs");
const { CHATURBATE_API_REGIONS, REGION_ORDER, getDiscoveryRegion, buildRegionalRoomGroups } = require("./src/services/regional-discovery.cjs");
const { summarizeRoomCoverage } = require("./src/services/room-coverage.cjs");
const { summarizeProviderFeedQuality } = require("./src/services/feed-quality-diagnostics.cjs");
const { summarizeBongaRawFields, summarizeBongaFieldValues, summarizeBongaCountryCoverage } = require("./src/services/bonga-feed-diagnostics.cjs");
const { normalizeBongaCountry } = require("./src/services/bonga-country-normalizer.cjs");
const { hasAuthenticatedOrigin, resolveTrustedClientIpv4, buildModelsOnlineUrl, parseModelsOnlineResponse, normalizeTags, resolveBongaRoomImage, isBongaHd } = require("./src/services/bongacash-api-v2.cjs");
let latestBongaRawDiagnostics = null;

let pgPool = null;
try {
  if (process.env.DATABASE_URL) {
    const { Pool } = require("pg");
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: 5
    });
  }
} catch (err) {
  console.warn("Postgres tracking unavailable:", err.message);
}

const PORT = process.env.PORT || 3000;
const ORIGIN = (process.env.PUBLIC_ORIGIN || "").replace(/\/$/, "");
const CAMPAIGN = process.env.CB_CAMPAIGN || process.env.CHATURBATE_WM || "C6yxN";
const TOUR = process.env.CB_TOUR || "LQps";
const BONGA_CAMPAIGN = process.env.BONGACAMS_CAMPAIGN || process.env.BONGACASH_CAMPAIGN || "840970";
const BONGA_API_BASE = process.env.BONGACAMS_API_BASE || "https://bngprm.com/promo.php";
// V1 remains the default. V2 requires an explicitly configured trusted proxy header.
const BONGA_API_VERSION = process.env.BONGACAMS_API_VERSION === "2" ? "2" : "1";
const BONGA_TRUSTED_CLIENT_IP_HEADER = String(process.env.BONGACAMS_TRUSTED_CLIENT_IP_HEADER || "").trim().toLowerCase();
const BONGA_ORIGIN_AUTH_SECRET = process.env.BONGACAMS_ORIGIN_AUTH_SECRET || "";
const BONGA_ENABLED = process.env.BONGACAMS_ENABLED !== "false";
const BONGA_LIMIT = Math.max(10, Math.min(500, Number(process.env.BONGACAMS_LIMIT || 100)));
const CHATURBATE_PAGE_SIZE = 500;
const CHATURBATE_MAX_PAGES = Math.max(1, Math.min(20, Number(process.env.CHATURBATE_MAX_PAGES || 10)));
const CHATURBATE_REGION_MAX_PAGES = resolveRegionalMaxPages(process.env.CHATURBATE_REGION_MAX_PAGES, CHATURBATE_MAX_PAGES);
const CONTACT = process.env.CONTACT_EMAIL || "bunnybelle188@gmail.com";
const PUBLIC = path.join(__dirname, "public");

const MARKET_NAMES = Object.freeze({
  US: "United States", GB: "United Kingdom", NO: "Norway", CH: "Switzerland",
  SE: "Sweden", DK: "Denmark", AU: "Australia", CA: "Canada", DE: "Germany",
  NL: "Netherlands", FR: "France", IE: "Ireland", FI: "Finland", AT: "Austria",
  BE: "Belgium", NZ: "New Zealand", IS: "Iceland", LU: "Luxembourg"
});
// Keep the sitemap and country-route priority list aligned with the canonical
// market configuration so Tier 1 additions cannot silently drift.
const MARKETS = MARKET_PRIORITY_CODES.map((code) => [code.toLowerCase(), code, MARKET_NAMES[code]]);

const GENDER = { f: "female", m: "male", t: "trans", c: "couples", s: "trans" };
const BLOCKED = /\b(teen|teens|teenage|underage|preteen|lolita|child|children|kid|kids|young|barely\s*legal|18\s*yo|19\s*yo|#18\b|#19\b)\b/gi;
const NAMES = {
  US:"United States", CA:"Canada", GB:"United Kingdom", IE:"Ireland", AU:"Australia", NZ:"New Zealand",
  DE:"Germany", AT:"Austria", CH:"Switzerland", FR:"France", BE:"Belgium", NL:"Netherlands", LU:"Luxembourg",
  SE:"Sweden", NO:"Norway", DK:"Denmark", FI:"Finland", IS:"Iceland", JP:"Japan", SG:"Singapore",
  BR:"Brazil", CO:"Colombia", MX:"Mexico", AR:"Argentina", CL:"Chile", PE:"Peru", VE:"Venezuela",
  PH:"Philippines", TH:"Thailand", CN:"China", RO:"Romania", UA:"Ukraine", IT:"Italy", ES:"Spain",
  PL:"Poland", CZ:"Czechia", HU:"Hungary", KE:"Kenya", KZ:"Kazakhstan", IN:"India", RU:"Russia", ZA:"South Africa"
};

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const STATS = path.join(DATA_DIR, "clicks.json");
const STATS_KEY = process.env.STATS_KEY || "";
const roomCache = new Map();

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const transport = new URL(url).protocol === "http:" ? http : https;
    transport.get(url, { headers: { "User-Agent": "NightCamFinds/2.0", Accept: "application/json" } }, res => {
      let body = ""; res.on("data", c => { body += c; });
      res.on("end", () => { if (res.statusCode >= 400) return reject(new Error("Feed " + res.statusCode)); try { resolve(JSON.parse(body)); } catch (err) { reject(err); } });
    }).on("error", reject);
  });
}
function clean(value) {
  return plainText(value).replace(/https?:\/\/\S+/gi, "").replace(/\b[\w.-]+\.(com|net|tv|xxx|ai)\b\S*/gi, "").replace(/\(\s*1[89]\s*\)/g, "").replace(BLOCKED, "").replace(/\b(beat|barely)\s*18\b/gi, "").replace(/#[^\s#]+/g, "").replace(/\s{2,}/g, " ").replace(/^[\s\-|#]+|[\s\-|#]+$/g, "").trim();
}
function cleanLabel(value, fallback = "unknown", max = 40) { const cleaned = String(value || "").trim().replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, max); return cleaned || fallback; }
function visitorCountry(req) { for (const value of [req.headers["cf-ipcountry"], req.headers["x-vercel-ip-country"], req.headers["cloudfront-viewer-country"], req.headers["x-country-code"]]) { const iso = String(value || "").trim().toUpperCase(); if (/^[A-Z]{2}$/.test(iso) && iso !== "XX") return iso; } return "UNKNOWN"; }
function writeStats(stats) { fs.mkdirSync(DATA_DIR, { recursive: true }); const tmp = `${STATS}.tmp`; fs.writeFileSync(tmp, JSON.stringify(stats, null, 2)); fs.renameSync(tmp, STATS); }
function readStats() { try { return JSON.parse(fs.readFileSync(STATS, "utf8")); } catch { return { total:0,countries:{},byCategory:{},byCountryCategory:{},bySource:{},byCampaign:{},byCountrySource:{},byCountryCampaign:{},byPlacement:{},byPlatform:{},updatedAt:null }; } }
let trackingReady = false;
async function ensureTrackingTable() {
  if (!pgPool || trackingReady) return;
  await pgPool.query(`CREATE TABLE IF NOT EXISTS affiliate_clicks (id BIGSERIAL PRIMARY KEY, clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), country VARCHAR(16) NOT NULL, category VARCHAR(40) NOT NULL, source VARCHAR(40) NOT NULL, campaign VARCHAR(80) NOT NULL, placement VARCHAR(80) NOT NULL, platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate')`);
  await pgPool.query("ALTER TABLE affiliate_clicks ALTER COLUMN country TYPE VARCHAR(16)");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate'");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS medium VARCHAR(80) NOT NULL DEFAULT 'unknown'");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS content VARCHAR(120) NOT NULL DEFAULT ''");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS device VARCHAR(32) NOT NULL DEFAULT 'unknown'");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS source_evidence VARCHAR(32) NOT NULL DEFAULT 'legacy'");
  await pgPool.query("ALTER TABLE affiliate_clicks ALTER COLUMN source SET DEFAULT 'unknown'");
  const evidenceConstraint = await pgPool.query(
    "SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = to_regclass('public.affiliate_clicks')",
    ["affiliate_clicks_source_evidence_check"]
  );
  if (!evidenceConstraint.rowCount) {
    await pgPool.query("ALTER TABLE affiliate_clicks ADD CONSTRAINT affiliate_clicks_source_evidence_check CHECK (source_evidence IN ('url_parameter', 'browser_referrer', 'stored_attribution', 'unknown', 'legacy'))");
  }
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS click_id VARCHAR(128)");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE");
  await pgPool.query("ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS bot_reason VARCHAR(80)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_click_id_idx ON affiliate_clicks(click_id)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_country_idx ON affiliate_clicks(country)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_clicked_at_idx ON affiliate_clicks(clicked_at)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS affiliate_clicks_platform_idx ON affiliate_clicks(platform)");
  trackingReady = true;
}
async function ensureAffiliateLedgers() {
  if (!pgPool) return;
  await pgPool.query(`CREATE TABLE IF NOT EXISTS cb_clicks (click_id VARCHAR(128) PRIMARY KEY, clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN', category VARCHAR(40) NOT NULL DEFAULT 'unknown', source VARCHAR(80) NOT NULL DEFAULT 'direct', campaign VARCHAR(80) NOT NULL DEFAULT 'unknown', placement VARCHAR(80) NOT NULL DEFAULT 'unknown')`);
  await pgPool.query("ALTER TABLE cb_clicks ALTER COLUMN country TYPE VARCHAR(16)");
  await pgPool.query("ALTER TABLE cb_clicks ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'unknown'");
  await pgPool.query("ALTER TABLE cb_clicks ADD COLUMN IF NOT EXISTS source VARCHAR(80) NOT NULL DEFAULT 'direct'");
  await pgPool.query("ALTER TABLE cb_clicks ADD COLUMN IF NOT EXISTS campaign VARCHAR(80) NOT NULL DEFAULT 'unknown'");
  await pgPool.query("ALTER TABLE cb_clicks ADD COLUMN IF NOT EXISTS placement VARCHAR(80) NOT NULL DEFAULT 'unknown'");
  await pgPool.query(`CREATE TABLE IF NOT EXISTS bonga_clicks (id BIGSERIAL PRIMARY KEY, affiliate_click_id BIGINT, click_id VARCHAR(128) UNIQUE, clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN', category VARCHAR(40) NOT NULL DEFAULT 'unknown', source VARCHAR(80) NOT NULL DEFAULT 'direct', campaign VARCHAR(80) NOT NULL DEFAULT 'unknown', placement VARCHAR(80) NOT NULL DEFAULT 'unknown', medium VARCHAR(80) NOT NULL DEFAULT 'unknown', content VARCHAR(120) NOT NULL DEFAULT '', device VARCHAR(32) NOT NULL DEFAULT 'unknown')`);
  await pgPool.query("CREATE INDEX IF NOT EXISTS cb_clicks_clicked_at_idx ON cb_clicks(clicked_at)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS bonga_clicks_clicked_at_idx ON bonga_clicks(clicked_at)");
}
async function countClick({ src, country, category="unknown", source="unknown", sourceEvidence="unknown", campaign="unknown", medium="unknown", content="", device="unknown", clickId, platform="chaturbate", visitId=null, landingPath="/", trafficClass="unverified" }) {
  if (pgPool) {
    let client = null;
    try {
      await ensureTrackingTable();
      await ensureAffiliateLedgers();
      client = await pgPool.connect();
      await client.query("BEGIN");
      const inserted = await client.query(
        "INSERT INTO affiliate_clicks (country,category,source,campaign,placement,platform,medium,content,device,source_evidence,click_id,visit_id,landing_path,is_bot,bot_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id",
        [country,category,source,campaign,src,platform,medium,content,device,sourceEvidence,clickId||null,visitId,landingPath,trafficClass === "known_bot", trafficClass === "known_bot" ? "known_bot_user_agent" : trafficClass === "suspected_bot" ? "suspected_automation_user_agent" : null]
      );
      if (visitId) {
        await client.query(
          "INSERT INTO traffic_visits (visit_id,country,platform,source,medium,campaign,content,placement,landing_path,traffic_class,last_seen_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT (visit_id) DO UPDATE SET traffic_class = CASE WHEN traffic_visits.traffic_class = 'known_bot' OR EXCLUDED.traffic_class = 'known_bot' THEN 'known_bot' WHEN traffic_visits.traffic_class = 'suspected_bot' OR EXCLUDED.traffic_class = 'suspected_bot' THEN 'suspected_bot' ELSE 'unverified' END, last_seen_at=NOW()",
          [visitId,country,platform,source,medium,campaign,content,src,landingPath,trafficClass]
        );
      }
      if (platform === "chaturbate" && clickId) {
        await client.query(
          "INSERT INTO cb_clicks (click_id,country,category,source,campaign,placement) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (click_id) DO NOTHING",
          [clickId,country,category,source,campaign,src]
        );
      } else if (platform === "bongacams" && clickId) {
        await client.query(
          "INSERT INTO bonga_clicks (affiliate_click_id,click_id,country,category,source,campaign,placement,medium,content,device) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (click_id) DO NOTHING",
          [inserted.rows[0]?.id||null,clickId,country,category,source,campaign,src,medium,content,device]
        );
      }
      await client.query("COMMIT");
      return;
    } catch (err) {
      if (client) {
        try { await client.query("ROLLBACK"); } catch (rollbackError) {
          console.error("Postgres click tracking rollback failed:", rollbackError.message);
        }
      }
      if (client && ["42P01", "42703"].includes(err.code)) {
        // Migration 006 is intentionally separate. Preserve the legacy persistent
        // click ledger until visit/landing columns and traffic tables are approved.
        let fallbackClient = null;
        try {
          fallbackClient = await pgPool.connect();
          await fallbackClient.query("BEGIN");
          const legacy = await fallbackClient.query(
            "INSERT INTO affiliate_clicks (country,category,source,campaign,placement,platform,medium,content,device,source_evidence,click_id,is_bot,bot_reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id",
            [country,category,source,campaign,src,platform,medium,content,device,sourceEvidence,clickId||null,trafficClass === "known_bot", trafficClass === "known_bot" ? "known_bot_user_agent" : trafficClass === "suspected_bot" ? "suspected_automation_user_agent" : null]
          );
          if (platform === "chaturbate" && clickId) {
            await fallbackClient.query(
              "INSERT INTO cb_clicks (click_id,country,category,source,campaign,placement) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (click_id) DO NOTHING",
              [clickId,country,category,source,campaign,src]
            );
          } else if (platform === "bongacams" && clickId) {
            await fallbackClient.query(
              "INSERT INTO bonga_clicks (affiliate_click_id,click_id,country,category,source,campaign,placement,medium,content,device) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (click_id) DO NOTHING",
              [legacy.rows[0]?.id||null,clickId,country,category,source,campaign,src,medium,content,device]
            );
          }
          await fallbackClient.query("COMMIT");
          console.warn("Traffic-quality schema unavailable; affiliate click saved without visit linkage.");
          return;
        } catch (fallbackError) {
          if (fallbackClient) { try { await fallbackClient.query("ROLLBACK"); } catch {} }
          console.error("Legacy persistent affiliate click fallback failed:", fallbackError.message);
          throw fallbackError;
        } finally {
          if (fallbackClient) fallbackClient.release();
        }
      }
      console.error("Postgres click tracking failed; falling back to local storage:", err.message);
    } finally {
      if (client) client.release();
    }
  }
  const stats=readStats(); stats.total=(stats.total||0)+1; stats.countries=stats.countries||{}; stats.countries[country]=(stats.countries[country]||0)+1; stats.byCategory=stats.byCategory||{}; stats.byCategory[category]=(stats.byCategory[category]||0)+1; stats.byCountryCategory=stats.byCountryCategory||{}; stats.byCountryCategory[`${country}:${category}`]=(stats.byCountryCategory[`${country}:${category}`]||0)+1; stats.bySource=stats.bySource||{}; stats.bySource[source]=(stats.bySource[source]||0)+1; stats.byCampaign=stats.byCampaign||{}; stats.byCampaign[campaign]=(stats.byCampaign[campaign]||0)+1; stats.byCountrySource=stats.byCountrySource||{}; stats.byCountrySource[`${country}:${source}`]=(stats.byCountrySource[`${country}:${source}`]||0)+1; stats.byCountryCampaign=stats.byCountryCampaign||{}; stats.byCountryCampaign[`${country}:${campaign}`]=(stats.byCountryCampaign[`${country}:${campaign}`]||0)+1; stats.byPlacement=stats.byPlacement||{}; stats.byPlacement[`${platform}:${src}`]=(stats.byPlacement[`${platform}:${src}`]||0)+1; stats.byPlatform=stats.byPlatform||{}; stats.byPlatform[platform]=(stats.byPlatform[platform]||0)+1; stats.byMedium=stats.byMedium||{}; stats.byMedium[medium]=(stats.byMedium[medium]||0)+1; stats.byRoom=stats.byRoom||{}; const roomMatch=String(content||"").match(/(?:^|:)room-([a-z0-9_-]{1,64})(?::|$)/i); if(roomMatch) stats.byRoom[`${platform}:${roomMatch[1]}`]=(stats.byRoom[`${platform}:${roomMatch[1]}`]||0)+1; stats.byDevice=stats.byDevice||{}; stats.byDevice[device]=(stats.byDevice[device]||0)+1; stats.updatedAt=new Date().toISOString(); writeStats(stats);
}
async function statsFromDb() { if (!pgPool) return null; try { await ensureTrackingTable(); const q=async(sql,params=[]) => (await pgPool.query(sql,params)).rows; const countries={}; for(const r of await q("SELECT country, COUNT(*)::int AS count FROM affiliate_clicks GROUP BY country ORDER BY count DESC")) countries[r.country]=r.count; const byCountryCategory={}; for(const r of await q("SELECT country, category, COUNT(*)::int AS count FROM affiliate_clicks GROUP BY country, category ORDER BY count DESC")) byCountryCategory[`${r.country}:${r.category}`]=r.count; const byCountrySource={}; for(const r of await q("SELECT country, source, COUNT(*)::int AS count FROM affiliate_clicks GROUP BY country, source ORDER BY count DESC")) byCountrySource[`${r.country}:${r.source}`]=r.count; const byPlatform={}; for(const r of await q("SELECT platform, COUNT(*)::int AS count FROM affiliate_clicks GROUP BY platform ORDER BY count DESC")) byPlatform[r.platform]=r.count; const total=Number((await q("SELECT COUNT(*)::int AS count FROM affiliate_clicks"))[0]?.count||0); const updated=await q("SELECT MAX(clicked_at) AS updated_at FROM affiliate_clicks"); return {total,countries,byCountryCategory,byCountrySource,byPlatform,updatedAt:updated[0]?.updated_at||null,persistent:true}; } catch(err) { console.error("Postgres stats read failed:",err.message); return null; } }
function clientIp(req) { const fwd=String(req.headers["x-forwarded-for"]||"").split(",")[0].trim(); if (/^\d{1,3}(\.\d{1,3}){3}$/.test(fwd)||fwd.includes(":")) return fwd; return "8.8.8.8"; }
function normalizeChaturbateRoom(room) { return {id:"chaturbate:"+room.username,platform:"chaturbate",platformName:"Chaturbate",username:room.username,displayName:clean(room.display_name||room.username)||room.username,gender:normalizeRoomGender(room.gender),country:(room.country||"").toUpperCase(),countryName:NAMES[(room.country||"").toUpperCase()]||room.country||"",location:clean(room.location),viewerCount:Number(room.num_users||0),isHd:!!room.is_hd,isNew:!!room.is_new,image:room.image_url_360x270||room.image_url||"",roomSubject:clean(room.room_subject),languages:room.spoken_languages||"",href:room.chat_room_url_revshare||room.chat_room_url||""}; }
function bongaGender(value) { return normalizeRoomGender(value); }
function normalizeBongaRoom(room) { const username=clean(room.username||room.user_name||room.nickname||room.model||room.id); if(!username)return null; const rawImages=room.profile_images||room.images||{}; const images=typeof rawImages==="string"?{}:rawImages; const age=Number(room.display_age||room.age||0); const tags=normalizeTags(room.tags).join(" "); if(Number.isFinite(age)&&age>0&&age<18)return null; const country=normalizeBongaCountry(room); const viewers=Number(room.members_count??room.num_users??room.viewers??room.viewer_count??0)||0; const image=(typeof rawImages==="string"?rawImages:"")||resolveBongaRoomImage(room); return {id:"bongacams:"+username,platform:"bongacams",platformName:"BongaCams",username,displayName:clean(room.display_name||room.name||username)||username,gender:bongaGender(room.gender||room.sex),country:country.match(/^[A-Z]{2}$/)?.[0]||"",countryName:NAMES[country]||clean(country),location:clean(room.hometown||room.location||country),viewerCount:viewers,isHd:isBongaHd(room)||/\bhd\b/i.test(tags),isNew:!!room.is_new||!!room.new,image,roomSubject:clean(room.chat_topic||room.room_subject||room.topic||tags),languages:clean([room.primary_language,room.secondary_language,room.language].map(plainText).filter(Boolean).join(", ")),href:room.chat_url||room.direct_chat_url||room.room_url||room.url||""}; }
async function fetchChaturbateRegion(req,apiRegion) {
 const ip=encodeURIComponent(clientIp(req));
 const pages=await fetchPagedResults(async ({offset,limit})=>{
  const data=await fetchJson(`https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=${encodeURIComponent(CAMPAIGN)}&client_ip=${ip}&format=json&limit=${limit}&offset=${offset}&region=${encodeURIComponent(apiRegion)}`);
  if(!data||!Array.isArray(data.results))throw new TypeError("Chaturbate regional feed response did not contain a results array.");
  return data.results;
 },{pageSize:CHATURBATE_PAGE_SIZE,maxPages:CHATURBATE_REGION_MAX_PAGES,getKey:room=>room&&room.username});
 console.info("Chaturbate "+apiRegion+" feed pagination.",JSON.stringify({pagesFetched:pages.pagesFetched,receivedCount:pages.receivedCount,uniqueCount:pages.uniqueCount,duplicateCount:pages.duplicateCount,truncated:pages.truncated,maxPages:CHATURBATE_REGION_MAX_PAGES,stopReason:pages.stopReason}));
 return filterDisplayableRooms(pages.items.map(room=>({normalized:normalizeChaturbateRoom(room,apiRegion),rawText:[room.username,room.display_name,room.room_subject].filter(Boolean).join(" ")})));
}
async function fetchChaturbateRooms(req) {
 const results=await Promise.allSettled(CHATURBATE_API_REGIONS.map(apiRegion=>fetchChaturbateRegion(req,apiRegion)));
 const successful=results.filter(result=>result.status==="fulfilled");
 const failed=results.map((result,index)=>result.status==="rejected"?CHATURBATE_API_REGIONS[index]:null).filter(Boolean);
 if(!successful.length)throw new Error("All Chaturbate regional feeds failed.");
 const unique=new Map();
 for(const result of successful)for(const room of result.value)if(room&&room.id&&!unique.has(room.id))unique.set(room.id,room);
 return {rooms:[...unique.values()],notice:failed.length?"Some Chaturbate regional feeds are temporarily unavailable: "+failed.join(", "):""};
}
async function fetchBongaV1Rooms() {
 const params=new URLSearchParams({c:BONGA_CAMPAIGN,type:"api",api_v:"1",limit:String(BONGA_LIMIT),api_type:"json"});
 const data=await fetchJson(`${BONGA_API_BASE}?${params.toString()}`);
 const candidateRows=Array.isArray(data)?data:(data.results||data.rooms||data.data||data.models||[]);
 const rawRows=Array.isArray(candidateRows)?candidateRows:[];
 latestBongaRawDiagnostics={...summarizeBongaRawFields(rawRows),valueSummary:summarizeBongaFieldValues(rawRows),countryCoverage:summarizeBongaCountryCoverage(rawRows,normalizeBongaCountry)};
 return filterDisplayableRooms(rawRows.map(room => {
  const tagsText=typeof room.tags==="string"?room.tags:Array.isArray(room.tags)?room.tags.join(" "):"";
  return {normalized:normalizeBongaRoom(room),rawText:[room.username,room.user_name,room.nickname,room.display_name,room.name,room.chat_topic,room.room_subject,room.topic,tagsText].filter(Boolean).map(value=>plainText(value)).join(" ")};
 }));
}
async function fetchBongaV2Rooms(req) {
 if(!hasAuthenticatedOrigin(req,BONGA_ORIGIN_AUTH_SECRET))throw new Error("Cloudflare origin authentication failed; BongaCash V2 request was not sent.");
 const clientIp=resolveTrustedClientIpv4(req,BONGA_TRUSTED_CLIENT_IP_HEADER);
 if(!clientIp)throw new Error("No valid visitor IPv4 found in the configured trusted proxy header; BongaCash V2 request was not sent.");
 const pageSize=Math.min(100,BONGA_LIMIT);
 const maxPages=Math.max(1,Math.ceil(BONGA_LIMIT/pageSize));
 let providerMetadata=null;
 const pages=await fetchPagedResults(async ({offset,limit})=>{
  const requestUrl=buildModelsOnlineUrl({campaignId:BONGA_CAMPAIGN,clientIp,limit,offset});
  const response=parseModelsOnlineResponse(await fetchJson(requestUrl));
  if(offset===0)providerMetadata=response;
  return response.models;
 },{pageSize,maxPages,getKey:room=>room&&room.username});
 const rawRows=pages.items;
 latestBongaRawDiagnostics={...summarizeBongaRawFields(rawRows),valueSummary:summarizeBongaFieldValues(rawRows),countryCoverage:summarizeBongaCountryCoverage(rawRows,normalizeBongaCountry),providerOnlineModels:providerMetadata&&providerMetadata.onlineModels,hasRandomChatUrl:Boolean(providerMetadata&&providerMetadata.randomChatUrl),hasPopularChatUrl:Boolean(providerMetadata&&providerMetadata.popularChatUrl)};
 console.info("BongaCash V2 feed pagination.",JSON.stringify({providerOnlineModels:providerMetadata&&providerMetadata.onlineModels,pagesFetched:pages.pagesFetched,receivedCount:pages.receivedCount,uniqueCount:pages.uniqueCount,duplicateCount:pages.duplicateCount,truncated:pages.truncated,stopReason:pages.stopReason}));
 return filterDisplayableRooms(rawRows.map(room=>{
  const tagsText=typeof room.tags==="string"?room.tags:Array.isArray(room.tags)?room.tags.join(" "):"";
  return {normalized:normalizeBongaRoom(room),rawText:[room.username,room.display_name,room.chat_topic,room.room_subject,tagsText].filter(Boolean).map(value=>plainText(value)).join(" ")};
 }));
}
async function fetchBongaRooms(req) {
 if(!BONGA_ENABLED)return[];
 if(BONGA_API_VERSION==="2") {
  try {
   return await fetchBongaV2Rooms(req);
  } catch(error) {
   console.warn("BongaCash V2 feed failed; falling back to V1:",error.message);
  }
 }
 return fetchBongaV1Rooms();
}
async function rooms(req) {
 const visitor=visitorCountry(req);
 const cacheKey=visitor!=="UNKNOWN"?visitor:clientIp(req);
 const cached=roomCache.get(cacheKey);
 if(cached&&Date.now()-cached.at<20000&&cached.rooms.length)return cached;
 const results=await Promise.allSettled([fetchChaturbateRooms(req),fetchBongaRooms(req)]);
 const ch=results[0].status==="fulfilled"?results[0].value.rooms:[];
 const bc=results[1].status==="fulfilled"?results[1].value:[];
 const notices=[];
 if(results[0].status==="rejected")notices.push("Chaturbate regional feeds unavailable");
 else if(results[0].value.notice)notices.push(results[0].value.notice);
 if(results[1].status==="rejected"&&BONGA_ENABLED)notices.push("BongaCams feed unavailable");
 const combined=filterDisplayableRooms([...ch,...bc].map(normalized=>({normalized,rawText:""})));
 const entry={at:Date.now(),rooms:combined,notice:notices.length?notices.join(" · "):(combined.length?"":"Live rooms are temporarily unavailable. Please check again shortly.")};
 roomCache.set(cacheKey,entry);
 if(roomCache.size>50)roomCache.delete(roomCache.keys().next().value);
 return entry;
}
async function approvedCountryPlatformPreference(countryCode) {
  const country = String(countryCode || "").trim().toUpperCase();
  if (!pgPool || !["US", "GB", "CA", "AU", "DE", "FR", "NL"].includes(country)) return null;
  try {
    const result = await pgPool.query(
      "SELECT preferred_platform FROM country_platform_settings WHERE country_code = $1 AND status = 'approved' AND approved_at IS NOT NULL LIMIT 1",
      [country]
    );
    const platform = String(result.rows[0]?.preferred_platform || "").toLowerCase();
    return ["chaturbate", "bongacams"].includes(platform) ? platform : null;
  } catch (err) {
    // Migration 004 is separate from production startup. Missing settings schema
    // must never prevent room discovery or affiliate redirects.
    if (!/does not exist|undefined table|relation .* does not exist/i.test(String(err.message))) {
      console.warn("Country platform preference unavailable:", err.message);
    }
    return null;
  }
}
function langFor(country) { const iso=String(country||"").toUpperCase(); if(["FR","BE","LU","MC"].includes(iso))return"fr"; if(["DE","AT"].includes(iso))return"de"; if(iso==="CH")return"de"; if(iso==="NL")return"nl"; return"en"; }
function pageOrigin(req) { if(ORIGIN)return ORIGIN; const proto=req.headers["x-forwarded-proto"]||"https"; return proto+"://"+req.headers.host; }
function cookieValue(req, name) {
  const prefix = name + "=";
  const entry = String(req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!entry) return "";
  try { return decodeURIComponent(entry.slice(prefix.length)); } catch (_) { return ""; }
}
function visitCookieHeaders(req, pathname) {
  const currentVisitId = cookieValue(req, "ncf_visit_id");
  const visitId = /^[a-f0-9]{32}$/i.test(currentVisitId) ? currentVisitId : require("crypto").randomBytes(16).toString("hex");
  const currentLandingPath = cookieValue(req, "ncf_landing_path");
  const validLandingPath = value => typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && value.length <= 255 && !/[\r\n]/.test(value);
  const landingPath = validLandingPath(currentLandingPath) ? currentLandingPath : (validLandingPath(pathname) ? pathname : "/");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const secure = forwardedProto === "https" || Boolean(req.socket && req.socket.encrypted);
  const attributes = "; Path=/; SameSite=Lax" + (secure ? "; Secure" : "");
  const cookies = [];
  if (!/^[a-f0-9]{32}$/i.test(currentVisitId)) cookies.push("ncf_visit_id=" + encodeURIComponent(visitId) + attributes);
  if (!validLandingPath(currentLandingPath)) cookies.push("ncf_landing_path=" + encodeURIComponent(landingPath) + attributes);
  return cookies.length ? { "Set-Cookie": cookies } : {};
}
function send(res,status,body,type,extraHeaders={}) {
  res.writeHead(status,{"Content-Type":type,"X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY",...extraHeaders});
  res.end(body);
}
const LEGAL_PAGE_META = {
  "About NightCamFinds": { title: "About NightCamFinds | Independent Live Room Directory", description: "Learn how NightCamFinds helps adults discover public live rooms through an independent directory of partner-platform listings." },
  "Affiliate disclosure": { title: "Affiliate Disclosure | How NightCamFinds Earns", description: "Read how NightCamFinds uses affiliate links, tracks room referrals and may earn commissions from partner platforms." },
  "Privacy policy": { title: "Privacy Policy | NightCamFinds", description: "Read how NightCamFinds handles browser storage, visit identifiers, referral analytics, server logs and partner-platform links." },
  "Terms": { title: "Terms of Use | NightCamFinds", description: "Review the age requirements, acceptable use rules, external platform terms and limitations that apply to NightCamFinds." },
  "Contact": { title: "Contact NightCamFinds | Support and Privacy Requests", description: "Contact NightCamFinds about privacy, corrections, takedown requests, affiliate matters or questions about this directory." }
};
function legal(title,body) {
  const meta = LEGAL_PAGE_META[title] || { title: title + " | NightCamFinds", description: "Information about NightCamFinds, an independent adult live-room discovery directory." };
  const escapeAttr = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const slug = ({ "About NightCamFinds": "about", "Affiliate disclosure": "affiliate-disclosure", "Privacy policy": "privacy", "Terms": "terms", "Contact": "contact" })[title] || "";
  const origin = ORIGIN || "https://nightcamfinds.com";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${meta.title}</title><meta name="description" content="${escapeAttr(meta.description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${origin}/${slug}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"></head><body><main class="wrap legal"><h1>${title}</h1>${body}<p><a href="/">Back to rooms</a></p></main></body></html>`;
}
const pages={
  "/about":legal("About NightCamFinds",`<p>NightCamFinds is an independent directory for adults aged 18 and over who want to discover publicly listed live rooms. It brings together room information supplied by partner platforms and helps visitors browse by category, country, language, viewer activity and recency when those details are available.</p><p>NightCamFinds does not host or transmit live video, operate broadcaster accounts, provide chat or moderation, or process payments for partner-platform services. When you select a room, you leave this directory and continue to the platform that operates the room.</p><p>Room titles, thumbnails, viewer counts, category labels and country information come from external partner feeds. Feeds can be incomplete, delayed or inaccurate. A country label is a discovery aid, not independent verification of a person’s identity, residence or nationality. A room marked live may go offline before you open it.</p><p>We aim to make discovery clearer through useful filters, transparent room information and direct links to the platforms hosting each listing. We do not guarantee room availability, performer conduct, partner-platform features or results from using an external service.</p><p>Some links are affiliate links. See our <a href="/affiliate-disclosure">affiliate disclosure</a> for details. Questions and correction requests can be sent to <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`),
  "/affiliate-disclosure":legal("Affiliate disclosure",`<p>NightCamFinds participates in affiliate programs for adult live-cam platforms, including Chaturbate and BongaCams. Some room links and promotional links use tracking information so the partner can attribute a referral to this directory or to a particular placement.</p><p>If you register, make a purchase or complete another eligible action after following an affiliate link, NightCamFinds may receive a commission or referral payment from the partner. The amount and eligibility depend on the partner programme and its terms. We do not promise that every click, registration or purchase will generate a commission.</p><p>Affiliate compensation does not add a separate charge to the price shown by the partner platform. Any tokens, tips, private shows, subscriptions or other paid features are priced and charged by the partner platform, not by NightCamFinds.</p><p>Affiliate relationships do not mean that NightCamFinds owns, operates or endorses every listed room. Listings are supplied by partner feeds and may change. Room ordering can reflect availability, filters, viewer activity, platform preferences or other directory criteria; it should not be treated as an independent review or guarantee of quality.</p><p>Before registering or spending, review the partner platform’s own age requirements, privacy policy, community rules and payment terms. Questions about this disclosure can be sent to <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`),
  "/privacy":legal("Privacy policy",`<p><strong>Last updated 13 November 2026.</strong></p><p>NightCamFinds stores an age-notice flag in your browser’s localStorage after you confirm you are 18 or older. For affiliate analytics, it also uses a temporary first-party session cookie containing a random visit identifier so directory visits can be linked to affiliate redirects and basic engagement events. The identifier is not designed to identify you by name. The server keeps standard logs for security and debugging. The site records aggregate redirect clicks by visitor country, category, traffic label, and platform when a trusted CDN/proxy provides a country code. The site does not need to store a visitor’s name or exact location for this reporting.</p><p>Clicking a room sends you to a partner platform. Those sites set their own cookies and have their own privacy policies. NightCamFinds does not control their account, moderation or payment practices. Do not send passwords, payment-card details or sensitive account information to this site by email.</p><p>Browser settings can be used to manage or clear cookies and local storage. Disabling these technologies may affect visit attribution or some convenience features. For a privacy question or request relating to this directory, contact <a href="mailto:${CONTACT}">${CONTACT}</a>. For information held by a partner platform, contact that platform directly.</p><p>Privacy questions: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`),
  "/terms":legal("Terms",`<p><strong>Last updated 13 November 2026.</strong></p><p>You must be at least 18 years old, or the age of majority where you live if that is higher, to use NightCamFinds. Do not access or use this site if adult material is unlawful where you are. You are responsible for complying with the laws that apply to you.</p><p>NightCamFinds is a directory. Streams, chat, tips, and accounts belong to partner platforms. Do not scrape the site in a way that overloads it, attempt to access admin tools, or use the directory to find anyone under 18.</p><p>The directory is provided on an as-available basis. Information is offered for discovery and may change without notice. Nothing on this site guarantees a particular outcome, performer availability or partner-platform approval. NightCamFinds is not responsible for performer conduct, partner-platform services or charges.</p>`),
  "/contact":legal("Contact",`<p>For questions about NightCamFinds, email the site operator at <a href="mailto:${CONTACT}">${CONTACT}</a>.</p><p>You can use this address for privacy requests, correction requests, accessibility feedback, takedown notices and questions about affiliate links or directory listings. When reporting a listing problem, include the page address and the room or platform name so we can understand what you are referring to. Do not include passwords, payment-card details or other sensitive account information.</p><p>NightCamFinds is a directory and does not host partner video or control performer accounts. If your request concerns a stream, a partner-platform account, a payment or a moderation decision, contact that platform directly because it controls those services.</p><p>We review messages as we are able, but we do not promise a particular response time. Sending a message does not guarantee that a listing can be changed or removed.</p>`)
};
function sitemap(origin){const paths=["/","/live/","/female/","/male/","/trans/","/couples/","/hd/","/new/","/popular/","/countries/","/broadcast","/about","/affiliate-disclosure","/privacy","/terms","/contact",...MARKETS.map(([slug])=>`/country/${slug}/`)]; return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${origin}${p}</loc></url>`).join("")}</urlset>`;}
function withTrack(url,track){try{const next=new URL(url);next.searchParams.set("track",track);return next.toString();}catch{return `https://chaturbate.com/in/?tour=${encodeURIComponent(TOUR)}&campaign=${encodeURIComponent(CAMPAIGN)}&track=${encodeURIComponent(track)}`;}}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://localhost"); const pathname=url.pathname;
  if(pathname==="/robots.txt") return send(res,200,`User-agent: *\nAllow: /\nDisallow: /go/\nDisallow: /bgo/\nDisallow: /api/\nSitemap: ${pageOrigin(req)}/sitemap.xml\n`,"text/plain");
  if(pathname==="/sitemap.xml")return send(res,200,sitemap(pageOrigin(req)),"application/xml");
  if(pathname==="/broadcast"||pathname==="/broadcast/"){const html=fs.readFileSync(path.join(PUBLIC,"broadcast.html"),"utf8");return send(res,200,html,"text/html; charset=utf-8",visitCookieHeaders(req, pathname));}
  const countryMatch = pathname.match(/^\/country\/([a-z]{2})\/$/);
  if (countryMatch) {
    const countryHtml = getCountryPage(countryMatch[1], pageOrigin(req));
    if (countryHtml) return send(res, 200, countryHtml, "text/html; charset=utf-8", visitCookieHeaders(req, pathname));
  }
  if(pages[pathname])return send(res,200,pages[pathname],"text/html; charset=utf-8");
  if(pathname==="/visits"){if(!STATS_KEY||url.searchParams.get("key")!==STATS_KEY)return send(res,404,"Not found","text/plain");const stats=(await statsFromDb())||readStats();const countryRows=Object.entries(stats.countries||{}).sort((a,b)=>b[1]-a[1]).map(([iso,count])=>`<tr><td>${NAMES[iso]||iso}</td><td>${iso}</td><td>${count}</td></tr>`).join("");const categoryRows=Object.entries(stats.byCountryCategory||{}).sort((a,b)=>b[1]-a[1]).map(([key,count])=>{const[iso,category]=key.split(":");return `<tr><td>${NAMES[iso]||iso}</td><td>${category}</td><td>${count}</td></tr>`;}).join("");const sourceRows=Object.entries(stats.byCountrySource||{}).sort((a,b)=>b[1]-a[1]).map(([key,count])=>{const[iso,source]=key.split(":");return `<tr><td>${NAMES[iso]||iso}</td><td>${source}</td><td>${count}</td></tr>`;}).join("");const platformRows=Object.entries(stats.byPlatform||{}).sort((a,b)=>b[1]-a[1]).map(([platform,count])=>`<tr><td>${platform}</td><td>${count}</td></tr>`).join("");return send(res,200,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>NightCamFinds Click Stats</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 16px}table{border-collapse:collapse;width:100%;margin:12px 0 32px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}.muted{color:#666}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.kpi{padding:16px;border:1px solid #ddd;border-radius:10px}.kpi strong{font-size:1.7rem;display:block}</style></head><body><h1>NightCamFinds affiliate click stats</h1><p class="muted">Aggregate redirect clicks only. Country comes from a trusted CDN/proxy header when available.</p><div class="grid"><div class="kpi"><span>Total clicks</span><strong>${stats.total||0}</strong></div><div class="kpi"><span>Countries seen</span><strong>${Object.keys(stats.countries||{}).filter(k=>k!=="UNKNOWN").length}</strong></div><div class="kpi"><span>Last updated</span><strong>${stats.updatedAt?new Date(stats.updatedAt).toLocaleString():"Never"}</strong></div></div><h2>Clicks by platform</h2><table><thead><tr><th>Platform</th><th>Clicks</th></tr></thead><tbody>${platformRows||'<tr><td colspan="2">No clicks yet.</td></tr>'}</tbody></table><h2>Clicks by visitor country</h2><table><thead><tr><th>Country</th><th>ISO</th><th>Clicks</th></tr></thead><tbody>${countryRows||'<tr><td colspan="3">No clicks yet.</td></tr>'}</tbody></table><h2>Clicks by country and category</h2><table><thead><tr><th>Country</th><th>Category</th><th>Clicks</th></tr></thead><tbody>${categoryRows||'<tr><td colspan="3">No clicks yet.</td></tr>'}</tbody></table><h2>Clicks by country and traffic source</h2><table><thead><tr><th>Country</th><th>Source</th><th>Clicks</th></tr></thead><tbody>${sourceRows||'<tr><td colspan="3">No clicks yet.</td></tr>'}</tbody></table><p><a href="/api/stats?key=${encodeURIComponent(STATS_KEY)}">JSON export</a> · <a href="/api/stats.csv?key=${encodeURIComponent(STATS_KEY)}">CSV export</a></p></body></html>`,`text/html; charset=utf-8");}
  if(pathname==="/api/stats"){if(!STATS_KEY||url.searchParams.get("key")!==STATS_KEY)return send(res,404,"Not found","text/plain");return send(res,200,JSON.stringify((await statsFromDb())||readStats()),"application/json");}
  if(pathname==="/api/stats.csv"){if(!STATS_KEY||url.searchParams.get("key")!==STATS_KEY)return send(res,404,"Not found","text/plain");const stats=(await statsFromDb())||readStats();const rows=[["country","category","source","clicks"]];for(const[key,count]of Object.entries(stats.byCountryCategory||{})){const[country,category]=key.split(":");rows.push([country,category,"all",count]);}const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");res.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=nightcamfinds-clicks.csv","X-Content-Type-Options":"nosniff","Cache-Control":"no-store"});return res.end(csv);}
  if(pathname==="/api/rooms"){
  const feed=await rooms(req);
  const coverage=url.searchParams.get("coverage")==="1"?summarizeRoomCoverage(feed.rooms):null;
  const category=url.searchParams.get("category")||"all";
  const country=(url.searchParams.get("country")||"").toUpperCase();
  const region=(url.searchParams.get("region")||"").trim();
  const language=(url.searchParams.get("language")||"").trim().toLowerCase();
  const platform=(url.searchParams.get("platform")||"").toLowerCase();
  const q=(url.searchParams.get("q")||"").toLowerCase();
  const sort=url.searchParams.get("sort")||"recommended";
  const limit=Math.max(1,Math.min(60,Number.parseInt(url.searchParams.get("limit")||"60",10)||60));
  const offset=Math.max(0,Math.min(100000,Number.parseInt(url.searchParams.get("offset")||"0",10)||0));
  const preferredPlatform=sort==="recommended"?await approvedCountryPlatformPreference(visitorCountry(req)):null;
  const regionFor=room=>getDiscoveryRegion({country:room.country,partnerRegion:room.partnerRegion,apiRegion:room.apiRegion});
  const languagesFor=room=>String(room.languages||"").split(/[,;|]/).map(value=>value.trim()).filter(Boolean);
  let list=feed.rooms.slice();
  if(["female","male","trans","couples"].includes(category))list=list.filter(r=>r.gender===category);
  if(category==="hd")list=list.filter(r=>r.isHd);
  if(category==="new")list=list.filter(r=>r.isNew);
  if(country)list=list.filter(r=>r.country===country);
  if(region)list=list.filter(r=>(r.region||regionFor(r))===region);
  if(language)list=list.filter(r=>languagesFor(r).some(value=>value.toLowerCase()===language));
  if(["chaturbate","bongacams"].includes(platform))list=list.filter(r=>r.platform===platform);
  if(q)list=list.filter(r=>`${r.displayName} ${r.roomSubject} ${r.country} ${r.location} ${r.platformName} ${r.languages}`.toLowerCase().includes(q));
  list=rankRoomsByPreferredPlatform(list,preferredPlatform,sort);
  const countries=[...new Set(feed.rooms.map(r=>r.country).filter(Boolean))].sort();
  const platforms=[...new Set(feed.rooms.map(r=>r.platform).filter(Boolean))].sort();
  const regions=[...new Set(feed.rooms.map(r=>r.region||regionFor(r)))].sort((a,b)=>{const ai=REGION_ORDER.indexOf(a),bi=REGION_ORDER.indexOf(b);return (ai<0?REGION_ORDER.length:ai)-(bi<0?REGION_ORDER.length:bi)||a.localeCompare(b);});
  const languages=[...new Set(feed.rooms.flatMap(languagesFor))].sort((a,b)=>a.localeCompare(b));
  if (url.searchParams.get("summary") === "1") { const diagnostics = url.searchParams.get("diagnostics") === "1" ? { basis: "normalized_partner_feed_snapshot", rawProviderPayloadsAvailable: false, bongaRawFieldSchemaAvailable: Boolean(latestBongaRawDiagnostics), providers: summarizeProviderFeedQuality(feed.rooms), ...(latestBongaRawDiagnostics ? { bongaRawFieldSchema: latestBongaRawDiagnostics } : {}) } : null; return send(res,200,JSON.stringify({liveCount:list.length,platforms,regions,languages,notice:feed.notice,...(coverage?{coverage}:{}),...(diagnostics?{diagnostics}:{})}),"application/json"); }
  const page=list.slice(offset,offset+limit);
  const regionalRooms=buildRegionalRoomGroups(list,sort,8);
  const topChaturbateByCategory = {};
  for (const gender of ["female", "male", "trans", "couples"]) {
    topChaturbateByCategory[gender] = feed.rooms
      .filter(room => room.platform === "chaturbate" && room.gender === gender)
      .sort((a, b) => Number(b.viewerCount || 0) - Number(a.viewerCount || 0) || a.username.localeCompare(b.username))
      .slice(0, 8);
  }
  return send(res,200,JSON.stringify({rooms:page,regionalRooms,topChaturbateByCategory,liveCount:list.length,offset,limit,hasMore:offset+page.length<list.length,countries,platforms,regions,languages,notice:feed.notice,tier1:isPriorityMarket(visitorCountry(req)),preferredPlatform,alternativePlatform:preferredPlatform?(preferredPlatform==="chaturbate"?"bongacams":"chaturbate"):null,...(coverage?{coverage}:{})}),"application/json");
}
if(pathname==="/api/surprise"){const feed=await rooms(req);const room=feed.rooms[Math.floor(Math.random()*Math.min(feed.rooms.length,40))]||null;return send(res,room?200:503,JSON.stringify({room}),"application/json");}
  if (pathname.startsWith("/bgo/") || pathname.startsWith("/go/")) {
    const isBonga = pathname.startsWith("/bgo/");
    const id = decodeURIComponent(pathname.slice(isBonga ? 5 : 4));
    const username = id.split(":").pop();
    const platform = isBonga ? "bongacams" : "chaturbate";
    if (!username || ["directory", "featured"].includes(username.toLowerCase()) || username.length > 64 || !/^[a-z0-9_-]+$/i.test(username)) {
      return send(res, 404, "Room not found", "text/plain; charset=utf-8");
    }
    const src = cleanLabel(url.searchParams.get("src"), "cb-card", 80);
    const category = cleanLabel(url.searchParams.get("cat"), "unknown", 40);
    const source = cleanLabel(url.searchParams.get("utm_source") || url.searchParams.get("source"), "unknown", 40);
    // Ignore the client-controlled evidence parameter. This records only how the label reached this endpoint.
    // URL-supplied source labels remain self-reported and are not proof of the visitor's true origin.
    const sourceEvidence = source !== "unknown" ? "url_parameter" : "unknown";
    const medium = cleanLabel(url.searchParams.get("utm_medium") || url.searchParams.get("medium"), "unknown", 80);
    const campaign = cleanLabel(url.searchParams.get("utm_campaign") || url.searchParams.get("campaign"), "unknown", 80);
    const suppliedContent = cleanLabel(url.searchParams.get("utm_content") || url.searchParams.get("content"), "", 72);
    // Keep the room identifier first so long promo labels cannot truncate it.
    const content = cleanLabel(["room-" + username, suppliedContent].filter(Boolean).join(":"), "room-" + username, 120);
    const country = visitorCountry(req);
    const agent = String(req.headers["user-agent"] || "").toLowerCase();
    const device = /mobile|android|iphone|ipad/.test(agent) ? "mobile" : "desktop";
    const clickId = "ncf_" + Date.now().toString(36) + "_" + require("crypto").randomBytes(8).toString("hex");
    const queryVisitId = url.searchParams.get("vid") || "";
    const cookieVisitId = cookieValue(req, "ncf_visit_id") || "";
    const visitIdentity = resolveVisitIdentity({
      queryVisitId,
      cookieVisitId,
      createVisitId: () => require("crypto").randomBytes(16).toString("hex")
    });
    const visitId = visitIdentity.visitId;
    const visitIdOrigin = visitIdentity.origin;
    const isSafeLandingPath = value => typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && value.length <= 255 && !/[\r\n]/.test(value);
    const queryLandingPath = url.searchParams.get("lp") || "";
    const cookieLandingPath = cookieValue(req, "ncf_landing_path");
    const landingPath = isSafeLandingPath(queryLandingPath) ? queryLandingPath : isSafeLandingPath(cookieLandingPath) ? cookieLandingPath : pathname;
    const room = isBonga ? (await rooms(req)).rooms.find(r => r.platform === platform && r.username === username) : null;
    if (isBonga && !room) return send(res, 404, "Live room not found", "text/plain; charset=utf-8");
    await countClick({ src, country, category, source, sourceEvidence, campaign, medium, content, device, clickId, platform, visitId, landingPath, trafficClass: classifyUserAgent(agent) });
    // This diagnostic records provenance without treating a fallback ID as a
    // previously established browsing session or storing raw visitor data.
    console.info(JSON.stringify({
      event: "affiliate_redirect_visit_identity",
      clickId,
      platform,
      visitIdOrigin,
      landingPath
    }));
    let target;
    if (isBonga) {
      // Exact account-generated BongaCash Direct Link pattern: type, version,
      // campaign code, and models[] username. No unsupported click-ID macros.
      const destination = new URL("https://bngprm.com/promo.php");
      destination.searchParams.set("type", "direct_link");
      destination.searchParams.set("v", "2");
      destination.searchParams.set("c", BONGA_CAMPAIGN);
      destination.searchParams.set("models[]", username);
      target = destination.toString();
    } else {
      const built = buildChaturbateUrl({
        // Use the canonical affiliate entry point and bind the destination room
        // below. Feed URLs are deliberately not trusted as destination targets.
        roomUrl: "",
        campaign: CAMPAIGN,
        tour: TOUR,
        track: src,
        clickId,
        source,
        medium,
        utmCampaign: campaign
      });
      if (built.ok) {
        const destination = new URL(built.url);
        if (destination.pathname === "/in/") destination.searchParams.set("room", username);
        target = destination.toString();
      } else {
        target = "https://chaturbate.com/in/?tour=" + encodeURIComponent(TOUR)
          + "&campaign=" + encodeURIComponent(CAMPAIGN)
          + "&track=" + encodeURIComponent(src)
          + "&room=" + encodeURIComponent(username)
          + "&click_id=" + encodeURIComponent(clickId)
          + "&sid=" + encodeURIComponent(clickId)
          + "&source=" + encodeURIComponent(source)
          + "&utm_medium=" + encodeURIComponent(medium)
          + "&utm_campaign=" + encodeURIComponent(campaign);
      }
    }
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const secureCookies = forwardedProto === "https" || Boolean(req.socket && req.socket.encrypted);
    const setCookies = buildVisitCookieHeaders({
      existingVisitCookie: cookieVisitId,
      existingLandingCookie: cookieValue(req, "ncf_landing_path"),
      visitId,
      landingPath,
      secure: secureCookies
    });
    const redirectHeaders = { Location: target, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
    if (setCookies.length) redirectHeaders["Set-Cookie"] = setCookies;
    res.writeHead(302, redirectHeaders);
    return res.end();
  }
  const countryRoute = pathname.match(/^\/country\/([a-z]{2})\/$/i);
  if (countryRoute) {
    const feed = await rooms(req);
    const iso = countryRoute[1].toUpperCase();
    const countryRooms = rankRoomsByPreferredPlatform(feed.rooms.filter((room) => room.country === iso), null, "recommended").slice(0, 60);
    const roomMarkup = renderRoomCards(countryRooms, { category: "all", pagePath: pathname });
    const countryHtml = getCountryPage(countryRoute[1], pageOrigin(req), roomMarkup, countryRooms.length > 0);
    if (!countryHtml) return send(res, 404, "Country page not found", "text/plain; charset=utf-8");
    return send(res, 200, countryHtml, "text/html; charset=utf-8");
  }
  const file=pathname==="/"||pathname.endsWith("/")?"/index.html":pathname;const safe=path.normalize(file).replace(/^(\.\.[/\\])+/,"");const full=path.join(PUBLIC,safe);const market=pathname.match(/^\/country\/([a-z]{2})\/$/);const forced=market?MARKETS.find(([slug])=>slug===market[1]):null;if(pathname.endsWith("/")||forced){
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8")
    .replaceAll("__ORIGIN__",pageOrigin(req))
    .replace("__COUNTRY__",visitorCountry(req))
    .replace("__FORCE__",forced?forced[1]:"")
    .replace("__LANG__",langFor(forced?forced[1]:visitorCountry(req)));
  const feed = await rooms(req);
  const routeKey = pathname.replace(/^\/+|\/+$/g, "") || "all";
  const pageCopy = {
    all:["Independent discovery","Discover live cams right now","Explore live rooms, compare viewer counts, and open a room on Chaturbate or BongaCams. NightCamFinds does not stream video itself.","NightCamFinds — Live cam directory"],
    live:["Live now","Rooms that are live now","Currently online rooms from partner platforms. Counts and subjects come from the feed and can change every minute.","Live cams now — NightCamFinds"],
    female:["Female","Find live female cams","Browse public female rooms that are live now. Filter by country or viewer count, then continue to the room on its partner platform.","Female live cams — NightCamFinds"],
    male:["Male","Find live male cams","Browse public male rooms that are live now. Filter by country or viewer count, then continue to the room on its partner platform.","Male live cams — NightCamFinds"],
    trans:["Trans","Find live trans cams","Browse public trans rooms that are live now. Filter by country or viewer count, then continue to the room on its partner platform.","Trans live cams — NightCamFinds"],
    couples:["Couples","Find live couples cams","Browse public couples rooms that are live now. Filter by country or viewer count, then continue to the room on its partner platform.","Couples live cams — NightCamFinds"],
    hd:["HD","Find HD live cams","Browse rooms the feed marks as HD. Quality can change with the broadcaster's connection.","HD live cams — NightCamFinds"],
    new:["New","Find new live broadcasters","Browse rooms marked new in the live feed. Availability changes as broadcasters come online and offline.","New live cams — NightCamFinds"],
    popular:["Popular","Find the most watched live rooms","Browse rooms sorted by current viewer count and continue to the broadcaster's room on its partner platform.","Popular live cams — NightCamFinds"],
    countries:["Countries","Live cams by country","Pick a country to filter rooms that publish a country code. Not every room includes one.","Live cams by country — NightCamFinds"]
  };
  const category = Object.hasOwn(pageCopy, routeKey) ? routeKey : "all";
  let list = feed.rooms.slice();
  if(["female","male","trans","couples"].includes(category)) list=list.filter(room=>room.gender===category);
  if(category==="hd") list=list.filter(room=>room.isHd);
  if(category==="new") list=list.filter(room=>room.isNew);
  if(forced) list=list.filter(room=>room.country===forced[1]);
  if(category==="popular") list.sort((a,b)=>Number(b.viewerCount||0)-Number(a.viewerCount||0));
  list=rankRoomsByPreferredPlatform(list,null,category==="popular"?"viewers":"recommended").slice(0,60);
  const home = (category==="all"||category==="live") && !forced;
  const roomMarkup = renderRoomCards(list,{category,pagePath:pathname,home});
  const hasRooms = list.length > 0;
  const copy = forced
    ? ["Country directory",`Live cams in ${forced[2]}`,`Browse public rooms associated with ${forced[2]}. Compare categories and current activity before opening a room on its partner platform.`,`Live cams in ${forced[2]} — NightCamFinds`]
    : pageCopy[category];
  html=html.replace('<meta name="robots" content="index,follow">',`<meta name="robots" content="${hasRooms?"index,follow":"noindex,follow"}">`);
  html=html.replaceAll("__CANONICAL__", `${pageOrigin(req)}${pathname}`).replaceAll("__OG_URL__", `${pageOrigin(req)}${pathname}`);
  html=html.replace('<div id="grid" class="grid" aria-live="polite"></div>',`<div id="grid" class="grid" aria-live="polite">${roomMarkup}</div>`);
  html=html.replace('<p id="result-count" class="result-count" aria-live="polite"></p>',`<p id="result-count" class="result-count" aria-live="polite">${hasRooms?list.length+" live rooms":"No live rooms are available right now."}</p>`);
  html = renderHeroCopy(html, copy);
  return send(res,200,html,"text/html; charset=utf-8",visitCookieHeaders(req, pathname));
}
  if(!full.startsWith(PUBLIC)||!fs.existsSync(full)||fs.statSync(full).isDirectory())return send(res,404,"Not found","text/plain");const types={".html":"text/html",".css":"text/css",".js":"text/javascript",".svg":"image/svg+xml"};send(res,200,fs.readFileSync(full),types[path.extname(full)]||"application/octet-stream");
});
server.listen(PORT,()=>console.log(`NightCamFinds listening on ${PORT}`));
