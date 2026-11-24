const fs = require('fs');
const path = 'start.js';
let s = fs.readFileSync(path, 'utf8');
const marker = 'NIGHTCAMFINDS_HEALTH_ROUTE_V1';
if (s.includes(marker)) process.exit(0);

const anchor = 'if (incoming.pathname === "/api/chaturbate/postback"';
const health = `if (incoming.pathname === "/health" && req.method === "GET") {
      const dbConfigured = Boolean(pool);
      if (!dbConfigured) {
        res.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        res.end(JSON.stringify({ ok: false, service: "nightcamfinds", database: "not_configured" }));
        return;
      }
      try {
        await pool.query("SELECT 1");
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        res.end(JSON.stringify({ ok: true, service: "nightcamfinds", database: "ok" }));
      } catch (err) {
        res.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        res.end(JSON.stringify({ ok: false, service: "nightcamfinds", database: "error" }));
      }
      return;
    }
    // ${marker}
    `;

if (!s.includes(anchor)) throw new Error('start.js Chaturbate route anchor not found');
s = s.replace(anchor, health + anchor);
fs.writeFileSync(path, s);
console.log('NightCamFinds health route patch applied');
