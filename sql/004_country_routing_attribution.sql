-- Phase 1 additive schema. Do not apply to production without explicit approval.
CREATE TABLE IF NOT EXISTS country_platform_settings (
  country CHAR(2) PRIMARY KEY,
  preferred_platform TEXT,
  status TEXT NOT NULL DEFAULT 'unassigned'
    CHECK (status IN ('unassigned', 'hypothesis', 'approved')),
  hypothesis TEXT NOT NULL DEFAULT '',
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  CHECK (preferred_platform IS NULL OR preferred_platform IN ('chaturbate', 'bongacams')),
  CHECK (
    (status = 'approved' AND preferred_platform IS NOT NULL AND approved_at IS NOT NULL)
    OR status <> 'approved'
  )
);

CREATE TABLE IF NOT EXISTS click_attribution_events (
  id BIGSERIAL PRIMARY KEY,
  click_id VARCHAR(128) NOT NULL UNIQUE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  country CHAR(2) NOT NULL DEFAULT 'UN',
  page_type VARCHAR(40) NOT NULL DEFAULT 'unknown',
  category VARCHAR(40) NOT NULL DEFAULT 'unknown',
  platform VARCHAR(30) NOT NULL DEFAULT 'unknown',
  card_position INTEGER,
  device VARCHAR(16) NOT NULL DEFAULT 'unknown',
  referrer_host VARCHAR(255) NOT NULL DEFAULT '',
  utm_source VARCHAR(100) NOT NULL DEFAULT '',
  utm_medium VARCHAR(100) NOT NULL DEFAULT '',
  utm_campaign VARCHAR(150) NOT NULL DEFAULT '',
  utm_content VARCHAR(150) NOT NULL DEFAULT '',
  sub_id VARCHAR(128) NOT NULL DEFAULT '',
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  engaged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (card_position IS NULL OR card_position BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS click_attribution_country_platform_date_idx
  ON click_attribution_events(country, platform, clicked_at DESC);
CREATE INDEX IF NOT EXISTS click_attribution_click_id_idx
  ON click_attribution_events(click_id);
CREATE INDEX IF NOT EXISTS click_attribution_campaign_idx
  ON click_attribution_events(utm_campaign, utm_source);
