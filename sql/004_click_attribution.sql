-- Add marketing attribution fields used by the repository click ledger.
-- Additive and safe for existing PostgreSQL / PGlite installations.
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS traffic_medium TEXT;
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS traffic_campaign TEXT;
