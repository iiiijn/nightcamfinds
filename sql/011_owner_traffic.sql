-- Additive owner-traffic classification. Historical rows default to non-owner.
ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS is_owner_traffic BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE traffic_visits ADD COLUMN IF NOT EXISTS is_owner_traffic BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS affiliate_clicks_owner_clicked_at_idx ON affiliate_clicks (clicked_at DESC) WHERE is_owner_traffic IS TRUE;
CREATE INDEX IF NOT EXISTS traffic_visits_owner_first_seen_idx ON traffic_visits (first_seen_at DESC) WHERE is_owner_traffic IS TRUE;
