-- Add missing fields used by the click repository.
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS traffic_medium TEXT;
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS traffic_campaign TEXT;