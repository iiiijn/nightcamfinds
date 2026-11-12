-- Record how a click obtained its visit identifier without treating either source as proof of a human session.
ALTER TABLE IF EXISTS public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS visit_id_source VARCHAR(24) NOT NULL DEFAULT 'legacy';

ALTER TABLE IF EXISTS public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS visit_id_conflict BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS public.affiliate_clicks
  DROP CONSTRAINT IF EXISTS affiliate_clicks_visit_id_source_check;

ALTER TABLE IF EXISTS public.affiliate_clicks
  ADD CONSTRAINT affiliate_clicks_visit_id_source_check
  CHECK (visit_id_source IN ('first_party_cookie','query_parameter','none','legacy'));

-- Bonga category-widget event names exceed the original VARCHAR(24) column width.
ALTER TABLE IF EXISTS public.traffic_engagement_events
  ALTER COLUMN event_type TYPE VARCHAR(48);
