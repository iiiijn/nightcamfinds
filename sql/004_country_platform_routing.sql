-- Phase 1: additive attribution and country-level platform settings.
-- This file is intentionally not wired into production startup. Applying it to
-- the production database requires a separate explicit confirmation.

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id BIGSERIAL PRIMARY KEY,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  country VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
  category VARCHAR(40) NOT NULL DEFAULT 'unknown',
  source VARCHAR(40) NOT NULL DEFAULT 'direct',
  campaign VARCHAR(80) NOT NULL DEFAULT 'unknown',
  placement VARCHAR(80) NOT NULL DEFAULT 'unknown',
  platform VARCHAR(30) NOT NULL DEFAULT 'chaturbate',
  medium VARCHAR(80) NOT NULL DEFAULT 'unknown',
  content VARCHAR(120) NOT NULL DEFAULT '',
  device VARCHAR(32) NOT NULL DEFAULT 'unknown',
  click_id VARCHAR(128)
);

ALTER TABLE affiliate_clicks
  ADD COLUMN IF NOT EXISTS page_type VARCHAR(40) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS card_position INTEGER,
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS utm_source VARCHAR(120),
  ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(120),
  ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(160),
  ADD COLUMN IF NOT EXISTS utm_content VARCHAR(160),
  ADD COLUMN IF NOT EXISTS utm_term VARCHAR(160),
  ADD COLUMN IF NOT EXISTS landing_path TEXT,
  ADD COLUMN IF NOT EXISTS engaged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bot_reason VARCHAR(120);

CREATE INDEX IF NOT EXISTS affiliate_clicks_country_platform_time_idx
  ON affiliate_clicks(country, platform, clicked_at DESC);

CREATE INDEX IF NOT EXISTS affiliate_clicks_engaged_idx
  ON affiliate_clicks(engaged_at)
  WHERE engaged_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS country_platform_settings (
  country_code CHAR(2) PRIMARY KEY,
  preferred_platform VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'hypothesis'
    CHECK (status IN ('hypothesis', 'approved', 'evidence_review')),
  hypothesis TEXT,
  approved_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (preferred_platform IS NULL OR preferred_platform IN ('chaturbate', 'bongacams')),
  CHECK (status <> 'approved' OR (preferred_platform IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS routing_evidence_reviews (
  id BIGSERIAL PRIMARY KEY,
  country_code CHAR(2) NOT NULL,
  platform VARCHAR(30) NOT NULL CHECK (platform IN ('chaturbate', 'bongacams')),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  engaged_clicks INTEGER NOT NULL DEFAULT 0,
  verified_signups INTEGER NOT NULL DEFAULT 0,
  verified_payers INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(14, 4) NOT NULL DEFAULT 0,
  epc NUMERIC(14, 6),
  reviewed_at TIMESTAMPTZ,
  decision TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (window_end >= window_start),
  CHECK (clicks >= 0 AND engaged_clicks >= 0 AND verified_signups >= 0 AND verified_payers >= 0)
);

CREATE INDEX IF NOT EXISTS routing_evidence_country_platform_idx
  ON routing_evidence_reviews(country_code, platform, window_end DESC);
