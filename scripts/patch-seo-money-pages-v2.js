const fs = require('fs');
const path = require('path');
const marker = 'NIGHTCAMFINDS_SEO_MONEY_PAGES_V2';
const file = path.join(__dirname, '..', 'public', 'app.js');
let s = fs.readFileSync(file, 'utf8');
if (s.includes(marker)) process.exit(0);
const anchor = 'const NCF_SEO_MONEY_PAGES = {';
if (!s.includes(anchor)) throw new Error('SEO money-page map not found');
const extra = {
  '/canada-male-live-cams/': ['CA','male','Canada Male Live Cams'],
  '/germany-male-live-cams/': ['DE','male','Germany Male Live Cams'],
  '/france-female-live-cams/': ['FR','female','France Female Live Cams'],
  '/australia-female-live-cams/': ['AU','female','Australia Female Live Cams'],
  '/netherlands-female-live-cams/': ['NL','female','Netherlands Female Live Cams'],
  '/france-male-live-cams/': ['FR','male','France Male Live Cams'],
  '/australia-male-live-cams/': ['AU','male','Australia Male Live Cams'],
  '/netherlands-male-live-cams/': ['NL','male','Netherlands Male Live Cams'],
  '/canada-trans-live-cams/': ['CA','trans','Canada Trans Live Cams'],
  '/germany-trans-live-cams/': ['DE','trans','Germany Trans Live Cams'],
  '/france-trans-live-cams/': ['FR','trans','France Trans Live Cams'],
  '/australia-trans-live-cams/': ['AU','trans','Australia Trans Live Cams'],
  '/netherlands-trans-live-cams/': ['NL','trans','Netherlands Trans Live Cams']
};
const insertion = `Object.assign(NCF_SEO_MONEY_PAGES, ${JSON.stringify(extra)});\nconst ncfMoneySchema = document.createElement('script');\nncfMoneySchema.type = 'application/ld+json';\nncfMoneySchema.textContent = JSON.stringify({ '@context':'https://schema.org', '@type':'CollectionPage', name: document.title, description: document.querySelector('meta[name="description"]')?.content || '', url: location.href });\ndocument.head.appendChild(ncfMoneySchema);\n// ${marker}\n`;
s = s.replace(anchor, insertion + anchor);
fs.writeFileSync(file, s);
console.log('Applied ' + marker + ' to public/app.js');
