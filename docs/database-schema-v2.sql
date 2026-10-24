-- NightCamFinds system v2 analytics foundation
-- PostgreSQL 14+

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id BIGSERIAL PRIMARY KEY,
  click_id VARCHAR(128) NOT NULL UNIQUE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform VARCHAR(30) NOT NULL,
  country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
  device VARCHAR(32) NOT NULL DEFAULT 'unknown',
  source VARCHAR(80) NOT NULL DEFAULT 'direct',
  medium VARCHAR(80) NOT NULL DEFAULT 'unknown',
  campaign VARCHAR(120) NOT NULL DEFAULT 'organic',
  content VARCHAR(120) NOT NULL DEFAULT '',
  landing_path VARCHAR(255) NOT NULL DEFAULT '/',
  category VARCHAR(80) NOT NULL DEFAULT 'all',
  placement VARCHAR(120) NOT NULL DEFAULT 'unknown',
  room_id VARCHAR(255),
  destination_domain VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS affiliate_clicks_clicked_at_idx
  ON affiliate_clicks (clicked_at);
CREATE INDEX IF NOT EXISTS affiliate_clicks_platform_idx
  ON affiliate_clicks (platform);
CREATE INDEX IF NOT EXISTS affiliate_clicks_country_idx
  ON affiliate_clicks (country);
CREATE INDEX IF NOT EXISTS affiliate_clicks_source_idx
  ON affiliate_clicks (source);
CREATE INDEX IF NOT EXISTS affiliate_clicks_campaign_idx
  ON affiliate_clicks (campaign);
CREATE INDEX IF NOT EXISTS affiliate_clicks_room_idx
  ON affiliate_clicks (room_id);

CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform VARCHAR(30) NOT NULL,
  click_id VARCHAR(128),
  transaction_id VARCHAR(255) NOT NULL,
  conversion_type VARCHAR(100) NOT NULL DEFAULT 'unknown',
  payout NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  amount NUMERIC(18,6),
  country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
  event_timestamp TIMESTAMPTZ,
  matched_click BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (platform, transaction_id)
);

CREATE INDEX IF NOT EXISTS affiliate_conversions_click_idx
  ON affiliate_conversions (click_id);
CREATE INDEX IF NOT EXISTS affiliate_conversions_received_at_idx
  ON affiliate_conversions (received_at);
CREATE INDEX IF NOT EXISTS affiliate_conversions_platform_idx
  ON affiliate_conversions (platform);

CREATE TABLE IF NOT EXISTS affiliate_rooms_cache (
  provider VARCHAR(30) PRIMARY KEY,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  room_count INTEGER NOT NULL DEFAULT 0,
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS affiliate_programs (
  id BIGSERIAL PRIMARY KEY,
  platform VARCHAR(30) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  campaign_id VARCHAR(255),
  program_id VARCHAR(255),
  api_base TEXT,
  affiliate_base TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO affiliate_programs (platform, enabled, campaign_id, program_id)
VALUES
  ('chaturbate', TRUE, 'C6yxN', NULL),
  ('bongacams', TRUE, '840970', 'RevShare')
ON CONFLICT (platform) DO NOTHING;
