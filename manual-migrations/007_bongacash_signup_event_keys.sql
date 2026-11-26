-- BongaCash signup events may omit a provider transaction ID.
-- Add stable event keys for callback idempotency while preserving existing rows.
-- Apply manually after review; never run automatically during service startup.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.bonga_conversions') IS NULL THEN
    RAISE EXCEPTION 'bonga_conversions table must exist before migration 007';
  END IF;
END $$;

ALTER TABLE public.bonga_conversions ALTER COLUMN transaction_id DROP NOT NULL;
ALTER TABLE public.bonga_conversions ADD COLUMN IF NOT EXISTS event_key VARCHAR(320);

UPDATE public.bonga_conversions
SET event_key = 'legacy:' || md5(COALESCE(transaction_id, '') || ':' || COALESCE(conversion_type, '') || ':' || id::text)
WHERE event_key IS NULL;

ALTER TABLE public.bonga_conversions ALTER COLUMN event_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bonga_conversions_event_key_uidx ON public.bonga_conversions(event_key);

COMMIT;
