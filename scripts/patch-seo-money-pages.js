const fs = require('fs');
const path = require('path');
const marker = 'NIGHTCAMFINDS_SEO_MONEY_PAGES_V1';
const file = path.join(__dirname, '..', 'public', 'app.js');
let s = fs.readFileSync(file, 'utf8');
if (s.includes(marker)) process.exit(0);
const anchor = 'const quick = document.querySelector("#quick");';
if (!s.includes(anchor)) throw new Error('app.js SEO money-page anchor not found');
const code = `
const NCF_SEO_MONEY_PAGES = {
  '/us-female-live-cams/': ['US','female','US Female Live Cams'],
  '/uk-female-live-cams/': ['GB','female','UK Female Live Cams'],
  '/canada-female-live-cams/': ['CA','female','Canada Female Live Cams'],
  '/germany-female-live-cams/': ['DE','female','Germany Female Live Cams'],
  '/us-male-live-cams/': ['US','male','US Male Live Cams'],
  '/uk-male-live-cams/': ['GB','male','UK Male Live Cams'],
  '/us-trans-live-cams/': ['US','trans','US Trans Live Cams'],
  '/uk-trans-live-cams/': ['GB','trans','UK Trans Live Cams']
};
const ncfSeoMoneyPage = NCF_SEO_MONEY_PAGES[location.pathname.replace(/\\/+$/, '/')];
if (ncfSeoMoneyPage) {
  const [market, pageCategory, heading] = ncfSeoMoneyPage;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = `Browse ${heading.toLowerCase()} on NightCamFinds. Compare current rooms, viewer activity and live availability.`;
  document.title = `${heading} — NightCamFinds`;
  const h1 = document.querySelector('#page-title');
  if (h1) h1.textContent = heading;
  const intro = document.querySelector('#page-intro');
  if (intro) intro.textContent = `Discover currently listed ${pageCategory} live cam rooms associated with this Tier-1 market. Compare activity and open a room through the partner platform.`;
  const country = document.querySelector('#country');
  const setCountry = () => { if (country) { country.value = market; country.dispatchEvent(new Event('change', {bubbles:true})); } };
  setCountry(); setTimeout(setCountry, 700);
  const seo = document.querySelector('.seo-content');
  if (seo && !seo.querySelector('.seo-money-copy')) {
    const section = document.createElement('section');
    section.className = 'seo-money-copy';
    section.innerHTML = `<h2>Find ${heading.toLowerCase()} online</h2><p>NightCamFinds is an independent discovery directory. Room availability and viewer counts can change throughout the day, so use the live filters to compare current listings. Video and chat are provided by the partner platform after you choose a room.</p><p><a href="/live/">Browse all live cams</a> · <a href="/countries/">Browse by country</a> · <a href="/female/">Female live cams</a> · <a href="/male/">Male live cams</a> · <a href="/trans/">Trans live cams</a> · <a href="/guides/best-live-cam-sites.html">Best live cam sites guide</a></p>`;
    seo.appendChild(section);
  }
}
// ${marker}
`;
s = s.replace(anchor, code + '\n' + anchor);
fs.writeFileSync(file, s);
console.log('Applied ' + marker + ' to public/app.js');
