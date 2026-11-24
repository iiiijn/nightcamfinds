import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const promo = readFileSync(new URL('../public/promo.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('Chaturbate live promotion mount matches the selector used by promo.js', () => {
  assert.match(html, /id="chaturbate-live-promo"/);
  assert.match(promo, /querySelector\('#chaturbate-live-promo'\)/);
  assert.doesNotMatch(html, /id="chatubate-live-promo"/);
});

test('Chaturbate category promotion mount is present and responsive', () => {
  assert.match(html, /id="chaturbate-category-promo"/);
  assert.match(promo, /querySelector\('#chaturbate-category-promo'\)/);
  for (const category of ['female', 'male', 'trans', 'couples']) {
    assert.match(promo, new RegExp("id: '" + category + "'"));
  }
  assert.match(styles, /\.cb-category-links\s*\{[^}]*grid-template-columns:repeat\(4/);
  assert.match(styles, /@media\(max-width:640px\)[\s\S]*?\.cb-category-links\s*\{[^}]*grid-template-columns:repeat\(2/);
});

test('category promotion preserves platform, placement and optional country targeting', () => {
  assert.match(promo, /ncf_platform: 'chaturbate'/);
  assert.match(promo, /ncf_category: category\.id/);
  assert.match(promo, /ncf_placement: 'cb-category-' \+ category\.id/);
  assert.match(promo, /params\.set\('ncf_country', metaCountry\)/);
});

test('category promotion engagement is measured separately from affiliate clicks', () => {
  assert.match(promo, /chaturbate_category_promo_viewable/);
  assert.match(promo, /chaturbate_category_click/);
  assert.match(promo, /renderStrip\(cbPromo, cb, 'Live on Chaturbate', 'Chaturbate'\)/);
});
