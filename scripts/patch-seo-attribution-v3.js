const fs = require('fs');

const file = 'public/app.js';
const marker = 'NIGHTCAMFINDS_SEO_ATTRIBUTION_CLIENT_V3';
let s = fs.readFileSync(file, 'utf8');
if (!s.includes(marker)) {
  const old = 'lp: location.pathname.slice(0, 255) || "/"';
  const replacement = 'lp: String((attributionFresh ? savedAttribution.landingPath : "") || location.pathname || "/").slice(0, 255)';
  if (!s.includes(old)) throw new Error('SEO attribution v3 client anchor not found');
  s = s.replace(old, replacement);
  s += `\n// ${marker}\n`;
  fs.writeFileSync(file, s);
  console.log(`Applied ${marker} to ${file}`);
} else {
  console.log(`${marker} already applied`);
}
