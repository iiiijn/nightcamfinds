'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeClickAttribution, resolvePageType } = require('../src/services/attribution-metadata.cjs');

test('keeps explicit source, medium and campaign labels', () => {
  assert.deepEqual(normalizeClickAttribution({
    source: 'reddit',
    medium: 'social',
    campaign: 'november-launch'
  }), { source: 'reddit', medium: 'social', campaign: 'november-launch' });
});

test('labels absent attribution as direct without claiming source evidence', () => {
  assert.deepEqual(normalizeClickAttribution({}), {
    source: 'direct', medium: 'none', campaign: 'none'
  });
});

test('does not replace missing medium or campaign when a source is supplied', () => {
  assert.deepEqual(normalizeClickAttribution({ source: 'newsletter' }), {
    source: 'newsletter', medium: 'unknown', campaign: 'unknown'
  });
});

test('classifies known landing page types', () => {
  assert.equal(resolvePageType('/'), 'home');
  assert.equal(resolvePageType('/female/'), 'category');
  assert.equal(resolvePageType('/country/us/'), 'country');
  assert.equal(resolvePageType('/countries/'), 'countries');
  assert.equal(resolvePageType('/broadcast'), 'broadcast');
  assert.equal(resolvePageType('/privacy'), 'content');
  assert.equal(resolvePageType('/unexpected/path/'), 'other');
});

test('does not treat affiliate redirect endpoints as landing pages', () => {
  assert.equal(resolvePageType('/go/example-model'), 'other');
  assert.equal(resolvePageType('/bgo/example-model'), 'other');
});
