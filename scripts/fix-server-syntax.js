const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "server.js");
let source = fs.readFileSync(file, "utf8");

const brokenVisitsRoute = /  if\(pathname===\"\/visits\"\)\{[\s\S]*?  if\(pathname===\"\/api\/stats\"\)\{/;

if (!brokenVisitsRoute.test(source)) {
  console.log("server.js visits route already clean or not present");
  process.exit(0);
}

const replacement = `  if(pathname==="/visits"){
    if(!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) return send(res,404,"Not found","text/plain");
    const stats = (await statsFromDb()) || readStats();
    return send(res,200,JSON.stringify({
      total: stats.total || 0,
      countries: stats.countries || {},
      byCountryCategory: stats.byCountryCategory || {},
      byCountrySource: stats.byCountrySource || {},
      byPlatform: stats.byPlatform || {},
      updatedAt: stats.updatedAt || null
    }),"application/json");
  }
  if(pathname==="/api/stats"){`;

source = source.replace(brokenVisitsRoute, replacement);
fs.writeFileSync(file, source);
console.log("NightCamFinds server.js syntax cleanup applied");
