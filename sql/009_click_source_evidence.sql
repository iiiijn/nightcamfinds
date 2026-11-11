-- Preserve historical rows as legacy while recording the capture method for new redirects.
ALTER TABLE IF EXISTS public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS source_evidence VARCHAR(32) NOT NULL DEFAULT 'legacy';

-- New records without a supplied source must not be assumed to be direct traffic.
ALTER TABLE IF EXISTS public.affiliate_clicks
  ALTER COLUMN source SET DEFAULT 'unknown';

ALTER TABLE IF EXISTS public.affiliate_clicks
  ADD CONSTRAINT affiliate_clicks_source_evidence_check
  CHECK (source_evidence IN ('url_parameter', 'browser_referrer', 'stored_attribution', 'unknown', 'legacy'));
