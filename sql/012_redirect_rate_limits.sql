-- Persistent, privacy-preserving counters for affiliate redirect abuse protection.
-- Only keyed HMAC digests and timestamps are stored. Raw IP addresses and visit IDs
-- are never written to this table. Rows expire logically after one hour and are
-- opportunistically pruned after two hours.
CREATE TABLE IF NOT EXISTS affiliate_redirect_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  key_hash CHAR(64) NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS affiliate_redirect_rate_limits_key_time_idx
  ON affiliate_redirect_rate_limits (key_hash, requested_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_redirect_rate_limits_requested_at_idx
  ON affiliate_redirect_rate_limits (requested_at);
