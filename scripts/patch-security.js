const fs = require('fs');
const path = 'start.js';
let s = fs.readFileSync(path, 'utf8');
const marker = 'NIGHTCAMFINDS_SECURITY_HEADERS_V1';
if (s.includes(marker)) process.exit(0);

const anchor = 'const originalCreateServer = http.createServer;';
const patch = `// ${marker}\n// Baseline response hardening. Individual routes can still add/override headers where needed.\nconst originalWriteHead = http.ServerResponse.prototype.writeHead;\nhttp.ServerResponse.prototype.writeHead = function(statusCode, reasonPhrase, headers) {\n  if (!this.hasHeader('X-Content-Type-Options')) this.setHeader('X-Content-Type-Options', 'nosniff');\n  if (!this.hasHeader('Referrer-Policy')) this.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');\n  if (!this.hasHeader('Permissions-Policy')) this.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');\n  if (!this.hasHeader('X-DNS-Prefetch-Control')) this.setHeader('X-DNS-Prefetch-Control', 'off');\n  if (!this.hasHeader('X-Permitted-Cross-Domain-Policies')) this.setHeader('X-Permitted-Cross-Domain-Policies', 'none');\n  if (!this.hasHeader('Strict-Transport-Security') && process.env.NODE_ENV === 'production') this.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');\n  return originalWriteHead.apply(this, arguments);\n};\n\n`;
if (!s.includes(anchor)) throw new Error('start.js HTTP server anchor not found');
s = s.replace(anchor, patch + anchor);
fs.writeFileSync(path, s);
console.log('NightCamFinds security headers patch applied');
