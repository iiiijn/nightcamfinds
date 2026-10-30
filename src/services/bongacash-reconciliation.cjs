"use strict";

function isValidIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateDailyEntry(payload) {
  const date = String(payload?.date || "");
  const registrations = payload?.registrations;
  const purchases = payload?.purchases;
  const earnings = payload?.earnings;
  const notes = String(payload?.notes || "").trim();

  if (!isValidIsoDate(date)) return { error: "Choose a valid reporting date." };
  if (!Number.isSafeInteger(registrations) || registrations < 0 || registrations > 100000000) {
    return { error: "Registrations must be a non-negative whole number." };
  }
  if (!Number.isSafeInteger(purchases) || purchases < 0 || purchases > 100000000) {
    return { error: "Purchases must be a non-negative whole number." };
  }
  if (typeof earnings !== "number" || !Number.isFinite(earnings) || earnings < 0 || earnings > 1000000000000) {
    return { error: "Earnings must be a valid non-negative USD amount." };
  }
  if (notes.length > 500) return { error: "Notes must be 500 characters or fewer." };

  return { value: { date, registrations, purchases, earnings, notes } };
}

module.exports = { isValidIsoDate, validateDailyEntry };
