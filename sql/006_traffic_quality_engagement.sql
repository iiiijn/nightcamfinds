-- Add privacy-conscious visit and engagement records.
-- This migration is intentionally NOT registered in the production startup runner.
-- Apply only after separate production database approval.
CREATE TABLE IF NOT EXISTS traffic_visits (
  visit_id CHAR(32) PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
  platform VARCHAR(30) NOT NULL DEFAULT 'unknown',
  source VARCHAR(40) NOT NULL DEFAULT 'direct',
  medium VARCHAR(80) NOT NULL DEFAULT 'unknown',
  campaign VARCHAR(80) NOT NULL DEFAULT 'unknown',
  content VARCHAR(120) NOT NULL DEFAULT '',
  placement VARCHAR(80) NOT NULL DEFAULT 'unknown',
  landing_path VARCHAR(255) NOT NULL DEFAULT '/',
  traffic_class VARCHAR(24) NOT NULL DEFAULT 'unverified'
    CHECK (traffic_class IN ('known_bot','suspected_bot','unverified'))
);

CREATE TABLE IF NOT EXISTS traffic_engagement_events (
  event_id BIGSERIAL PRIMARY KEY,
  visit_id CHAR(32) NOT NULL REFERENCES traffic_visits(visit_id) ON DELETE CASCADE,
  event_type VARCHAR(24) NOT NULL
    CHECK (event_type IN ('active_10s','scroll_50')),
  page_path VARCHAR(255) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visit_id, event_type, page_path)
);

ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS visit_id CHAR(32);
ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS landing_path VARCHAR(255) NOT NULL DEFAULT '/';
CREATE INDEX IF NOT EXISTS affiliate_clicks_visit_id_idx ON affiliate_clicks(visit_id);

CREATE INDEX IF NOT EXISTS traffic_visits_first_seen_idx ON traffic_visits(first_seen_at);
CREATE INDEX IF NOT EXISTS traffic_visits_country_idx ON traffic_visits(country);
CREATE INDEX IF NOT EXISTS traffic_visits_class_idx ON traffic_visits(traffic_class);
CREATE INDEX IF NOT EXISTS traffic_events_occurred_idx ON traffic_engagement_events(occurred_at);
