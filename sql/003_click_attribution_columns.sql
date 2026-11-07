-- Legacy attribution columns are only relevant to installations that still
-- have the retired `clicks` table. Current installations use affiliate_clicks,
-- which already stores medium and campaign. Do not fail startup when the
-- legacy table is absent.
DO $$
BEGIN
  IF to_regclass('public.clicks') IS NOT NULL THEN
    ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS traffic_medium TEXT;
    ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS traffic_campaign TEXT;
  END IF;
END
$$;
