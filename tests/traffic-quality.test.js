'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyUserAgent, normalizeVisitId, normalizeEvent, newVisitId, nairobiWeekBounds } = require('../src/services/traffic-quality.cjs');

test('classifies known crawlers separately from suspected automation', () => {
  assert.equal(classifyUserAgent('Googlebot/2.1'), 'known_bot');
  assert.equal(classifyUserAgent('curl/8.1'), 'suspected_bot');
  assert.equal(classifyUserAgent('Mozilla/5.0 Chrome/120 Safari/537.36'), 'unverified');
  assert.equal(classifyUserAgent(''), 'unverified');
});

test('creates and validates privacy-preserving random visit identifiers', () => {
  const id = newVisitId();
  assert.match(id, /^[a-f0-9]{32}$/);
  assert.equal(normalizeVisitId(id), id);
  assert.equal(normalizeVisitId('visitor-123'), null);
});

test('accepts only supported engagement events and safe local paths', () => {
  const visitId = 'a'.repeat(32);
  assert.deepEqual(normalizeEvent({ visitId, eventType: 'active_10s', pagePath: '/female/' }), {
    value: { visitId, eventType: 'active_10s', pagePath: '/female/' }
  });
  assert.equal(normalizeEvent({ visitId, eventType: 'page_view', pagePath: '/' }).error, 'Unsupported engagement event.');
  assert.equal(normalizeEvent({ visitId, eventType: 'scroll_50', pagePath: '//evil.test' }).error, 'Invalid page path.');
  assert.equal(normalizeEvent({ visitId: 'bad', eventType: 'scroll_50', pagePath: '/' }).error, 'Invalid visit identifier.');
});

test('uses Monday-to-Monday UTC boundaries for Nairobi calendar weeks', () => {
  const bounds = nairobiWeekBounds(new Date('2026-11-04T12:00:00.000Z')); // Wednesday, 15:00 EAT
  assert.equal(bounds.from, '2026-11-01T21:00:00.000Z'); // Monday 00:00 EAT
  assert.equal(bounds.toExclusive, '2026-11-08T21:00:00.000Z');
});

test('handles Nairobi week boundary exactly at Monday local midnight', () => {
  const bounds = nairobiWeekBounds(new Date('2026-11-01T21:00:00.000Z'));
  assert.equal(bounds.from, '2026-11-01T21:00:00.000Z');
  assert.equal(bounds.toExclusive, '2026-11-08T21:00:00.000Z');
});
