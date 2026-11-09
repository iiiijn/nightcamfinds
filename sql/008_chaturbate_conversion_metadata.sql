-- Persist the full documented Chaturbate dynamic-postback metadata.
-- Additive and safe to rerun. Existing conversion rows are not rewritten.
ALTER TABLE cb_conversions
  ADD COLUMN IF NOT EXISTS device VARCHAR(32),
  ADD COLUMN IF NOT EXISTS language VARCHAR(32),
  ADD COLUMN IF NOT EXISTS token VARCHAR(80),
  ADD COLUMN IF NOT EXISTS program_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS referral TEXT,
  ADD COLUMN IF NOT EXISTS attempt VARCHAR(32),
  ADD COLUMN IF NOT EXISTS region VARCHAR(255);
