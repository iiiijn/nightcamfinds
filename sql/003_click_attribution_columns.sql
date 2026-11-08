-- Legacy attribution columns are only relevant to installations that still
-- have the retired `clicks` table. Current installations use affiliate_clicks,
-- which already stores medium and campaign. Do not fail startup when the
-- legacy table is absent.
ALTER TABLE IF EXISTS public.clicks
  ADD COLUMN IF NOT EXISTS traffic_medium TEXT;
ALTER TABLE IF EXISTS public.clicks
  ADD COLUMN IF NOT EXISTS traffic_campaign TEXT;
