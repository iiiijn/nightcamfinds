-- Add tracked click metadata to existing databases. Safe for both fresh and existing installs.
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS traffic_medium TEXT;
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS traffic_campaign TEXT;
