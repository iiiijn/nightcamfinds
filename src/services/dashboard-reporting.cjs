'use strict';
function validDate(value) {
  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function parseUtcDateRange(from, to) {
  const start = from == null || from === '' ? null : String(from);
  const end = to == null || to === '' ? null : String(to);
  if (start && !validDate(start)) return { error: 'Invalid start date. Use YYYY-MM-DD.' };
  if (end && !validDate(end)) return { error: 'Invalid end date. Use YYYY-MM-DD.' };
  if (start && end && start > end) return { error: 'Start date must be on or before end date.' };
  return { value: { from: start ? `${start}T00:00:00.000Z` : null, toExclusive: end ? new Date(Date.parse(`${end}T00:00:00.000Z`) + 86400000).toISOString() : null } };
}
function buildTimestampFilter(column, range, startIndex = 1) {
  if (!/^[a-z_][a-z0-9_.]*$/i.test(String(column))) throw new Error('Invalid timestamp column.');
  const clauses = [], params = [];
  if (range?.from) { params.push(range.from); clauses.push(`${column} >= $${startIndex + params.length - 1}::timestamptz`); }
  if (range?.toExclusive) { params.push(range.toExclusive); clauses.push(`${column} < $${startIndex + params.length - 1}::timestamptz`); }
  return { sql: clauses.join(' AND '), params };
}
module.exports = { validDate, parseUtcDateRange, buildTimestampFilter };
