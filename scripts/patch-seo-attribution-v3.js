const fs = require('fs');

const file = 'public/app.js';
const marker = 'NIGHTCAMFINDS_SEO_ATTRIBUTION_CLIENT_V3';
let s = fs.readFileSync(file, 'utf8');

if (s.includes(marker)) {
  console.log(`${marker} already applied`);
  process.exit(0);
}

// v2 may already have converted the simple pathname attribution into the
// attribution-aware expression in the same CI run. Treat both states as valid
// so the verification workflow remains idempotent.
const old = 'lp: location.pathname.slice(0, 255) || "/"';
const v2 = 'lp: String((attributionFresh ? savedAttribution.landingPath : "") || location.pathname || "/").slice(0, 255)';

if (s.includes(v2)) {
  s += `\n// ${marker}\n`;
  fs.writeFileSync(file, s);
  console.log(`v2 attribution expression already present; applied ${marker}`);
  process.exit(0);
}

if (!s.includes(old)) {
  throw new Error('SEO attribution v3 client anchor not found');
}

s = s.replace(old, v2);
s += `\n// ${marker}\n`;
fs.writeFileSync(file, s);
console.log(`Applied ${marker} to ${file}`);
