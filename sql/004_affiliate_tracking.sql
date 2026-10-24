-- Affiliate tracking attribution fields.
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS traffic_medium TEXT;
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS traffic_campaign TEXT;
CREATE INDEX IF NOT EXISTS idx_clicks_provider_campaign ON clicks(provider, campaign);
CREATE INDEX IF NOT EXISTS idx_clicks_traffic_source ON clicks(traffic_source);
CREATE INDEX IF NOT EXISTS idx_postbacks_click_id ON postbacks(click_id);
CREATE INDEX IF NOT EXISTS idx_conversions_click_id ON conversions(click_id);
