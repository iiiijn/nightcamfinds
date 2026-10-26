const fs = require("fs");
const path = "route.js";
let s = fs.readFileSync(path, "utf8");
const marker = "NIGHTCAMFINDS_RATE_LIMIT_V1";
if (s.includes(marker)) process.exit(0);

const anchor = "const originalCreateServer = http.createServer;";
if (!s.includes(anchor)) throw new Error("route.js createServer anchor not found");

const limiter = [
  "const rateBuckets = new Map();",
  "const RATE_WINDOW_MS = 60 * 1000;",
  "const AUTH_WINDOW_MS = 15 * 60 * 1000;",
  "const MAX_API_REQUESTS = 120;",
  "const MAX_AUTH_REQUESTS = 10;",
  "",
  "function rateLimitKey(req, pathname) {",
  "  const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();",
  "  const authPath = pathname.includes('/login') || pathname.includes('/auth');",
  "  return { key: (authPath ? 'auth:' : 'api:') + ip, authPath };",
  "}",
  "",
  "function rateLimitCheck(req) {",
  "  const pathname = String(req.url || '').split('?', 1)[0];",
  "  const protectedPath = pathname.startsWith('/api/') || pathname.startsWith('/dashboard') || pathname.startsWith('/admin');",
  "  if (!protectedPath) return null;",
  "  const info = rateLimitKey(req, pathname);",
  "  const now = Date.now();",
  "  const windowMs = info.authPath ? AUTH_WINDOW_MS : RATE_WINDOW_MS;",
  "  const limit = info.authPath ? MAX_AUTH_REQUESTS : MAX_API_REQUESTS;",
  "  let bucket = rateBuckets.get(info.key);",
  "  if (!bucket || now - bucket.startedAt >= windowMs) {",
  "    bucket = { startedAt: now, count: 0 };",
  "    rateBuckets.set(info.key, bucket);",
  "  }",
  "  bucket.count += 1;",
  "  if (rateBuckets.size > 5000 && Math.random() < 0.02) {",
  "    for (const [key, value] of rateBuckets) {",
  "      if (now - value.startedAt >= windowMs) rateBuckets.delete(key);",
  "    }",
  "  }",
  "  const remaining = Math.max(0, limit - bucket.count);",
  "  if (bucket.count > limit) {",
  "    return { limit, remaining: 0, retryAfter: Math.ceil((windowMs - (now - bucket.startedAt)) / 1000) };",
  "  }",
  "  return { limit, remaining, retryAfter: 0 };",
  "}",
  "",
  "function createRateLimitedServer(handler, options) {",
  "  return originalCreateServer(options, (req, res) => {",
  "    const rate = rateLimitCheck(req);",
  "    if (rate && rate.remaining === 0) {",
  "      res.writeHead(429, {",
  "        'Content-Type': 'application/json; charset=utf-8',",
  "        'Cache-Control': 'no-store',",
  "        'Retry-After': String(rate.retryAfter),",
  "        'X-RateLimit-Limit': String(rate.limit),",
  "        'X-RateLimit-Remaining': '0',",
  "        'X-Content-Type-Options': 'nosniff'",
  "      });",
  "      res.end(JSON.stringify({ ok: false, error: 'rate_limited', retryAfter: rate.retryAfter }));",
  "      return;",
  "    }",
  "    if (rate) {",
  "      res.setHeader('X-RateLimit-Limit', String(rate.limit));",
  "      res.setHeader('X-RateLimit-Remaining', String(rate.remaining));",
  "    }",
  "    handler(req, res);",
  "  });",
  "}",
  "",
  "// NIGHTCAMFINDS_RATE_LIMIT_V1",
  ""
].join("\n");

s = s.replace(anchor, anchor + "\n" + limiter);
s = s.replace(/originalCreateServer\\(options,\\s*\\(req\\s*,\\s*res\\)\\s*=>\\s*\\{/g, "createRateLimitedServer((req, res) => {");
fs.writeFileSync(path, s);
console.log("NightCamFinds production rate limiting patch applied");
