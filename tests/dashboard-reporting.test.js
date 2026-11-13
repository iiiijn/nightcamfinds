'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validDate, parseUtcDateRange, buildTimestampFilter } = require('../src/services/dashboard-reporting.cjs');
test('validates real calendar dates', () => {
 assert.equal(validDate('2026-11-13'), true);
 assert.equal(validDate('2026-02-29'), false);
 assert.equal(validDate('2026-13-01'), false);
});
test('uses inclusive date selection with exclusive UTC end', () => {
 assert.deepEqual(parseUtcDateRange('2026-11-07','2026-11-13'), {value:{from:'2026-11-07T00:00:00.000Z',toExclusive:'2026-11-14T00:00:00.000Z'}});
});
test('supports open boundaries and all-time', () => {
 assert.deepEqual(parseUtcDateRange(null,null),{value:{from:null,toExclusive:null}});
 assert.equal(parseUtcDateRange('2026-11-07',null).value.from,'2026-11-07T00:00:00.000Z');
 assert.equal(parseUtcDateRange(null,'2026-11-13').value.toExclusive,'2026-11-14T00:00:00.000Z');
});
test('rejects invalid and reversed dates', () => {
 assert.match(parseUtcDateRange('2026-02-30',null).error,/Invalid start date/);
 assert.match(parseUtcDateRange(null,'13-11-2026').error,/Invalid end date/);
 assert.match(parseUtcDateRange('2026-11-14','2026-11-13').error,/on or before/);
});
test('builds parameterized timestamp filters with exclusive end', () => {
 assert.deepEqual(buildTimestampFilter('received_at',{from:'2026-11-07T00:00:00.000Z',toExclusive:'2026-11-14T00:00:00.000Z'}),{sql:'received_at >= $1::timestamptz AND received_at < $2::timestamptz',params:['2026-11-07T00:00:00.000Z','2026-11-14T00:00:00.000Z']});
 assert.throws(()=>buildTimestampFilter('received_at; DROP TABLE users',{}),/Invalid timestamp column/);
});
test('dashboard provider conversion queries share the selected date range', () => {
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../start.js'),'utf8');
 assert.match(source,/FROM cb_conversions[\s\S]*?\$\{conversionWhere\}/);
 assert.match(source,/FROM bonga_conversions WHERE 1=1 \$\{conversionWhere\}/);
});
