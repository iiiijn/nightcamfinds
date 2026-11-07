-- Add tracked click metadata to the canonical affiliate click ledger.
-- Migration 004 creates affiliate_clicks before this migration runs.
ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS medium TEXT;
ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS campaign TEXT;
