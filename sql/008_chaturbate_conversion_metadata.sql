-- Ensure the conversion ledger exists before adding optional Chaturbate metadata.
-- Additive and safe to rerun. Existing conversion rows are not rewritten.
CREATE TABLE IF NOT EXISTS cb_conversions (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  click_id VARCHAR(128),
  transaction_id VARCHAR(255),
  conversion_type VARCHAR(100),
  payout NUMERIC(18,6) DEFAULT 0,
  currency VARCHAR(16),
  amount NUMERIC(18,6),
  country VARCHAR(16),
  track VARCHAR(255),
  source VARCHAR(255),
  campaign_id VARCHAR(255),
  program_id VARCHAR(255),
  user_id VARCHAR(255),
  event_timestamp VARCHAR(100),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched_click BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(transaction_id)
);

ALTER TABLE cb_conversions
  ADD COLUMN IF NOT EXISTS matched_click BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS event_time VARCHAR(32),
  ADD COLUMN IF NOT EXISTS device VARCHAR(32),
  ADD COLUMN IF NOT EXISTS language VARCHAR(32),
  ADD COLUMN IF NOT EXISTS token VARCHAR(80),
  ADD COLUMN IF NOT EXISTS program_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS referral TEXT,
  ADD COLUMN IF NOT EXISTS attempt VARCHAR(32),
  ADD COLUMN IF NOT EXISTS region VARCHAR(255);

CREATE INDEX IF NOT EXISTS cb_conversions_click_id_idx ON cb_conversions(click_id);
