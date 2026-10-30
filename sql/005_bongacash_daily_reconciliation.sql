-- Daily manual BongaCash reconciliation figures.
-- This migration is intentionally not wired into automatic production startup.
-- Apply only after separate explicit approval for the production database.

CREATE TABLE IF NOT EXISTS bongacash_daily_reconciliation (
  report_date DATE PRIMARY KEY,
  registrations INTEGER NOT NULL DEFAULT 0 CHECK (registrations >= 0),
  purchases INTEGER NOT NULL DEFAULT 0 CHECK (purchases >= 0),
  earnings NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (earnings >= 0),
  notes VARCHAR(500) NOT NULL DEFAULT '',
  updated_by VARCHAR(120) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bongacash_daily_reconciliation_updated_idx
  ON bongacash_daily_reconciliation(updated_at DESC);
