-- Preserve purchase and reversal events that share a provider transaction ID.
-- Repeated delivery of the same transaction/event type remains idempotent.
-- Apply as a reviewed database migration; do not run automatically at startup.

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  IF to_regclass('public.bonga_conversions') IS NULL THEN
    RAISE EXCEPTION 'bonga_conversions table must exist before migration 006';
  END IF;

  FOR constraint_record IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.bonga_conversions'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM unnest(c.conkey) AS key_column(attnum)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = key_column.attnum
      ) = ARRAY['transaction_id']::name[]
  LOOP
    EXECUTE format('ALTER TABLE public.bonga_conversions DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bonga_conversions'::regclass
      AND conname = 'bonga_conversions_transaction_event_key'
  ) THEN
    ALTER TABLE public.bonga_conversions
      ADD CONSTRAINT bonga_conversions_transaction_event_key
      UNIQUE (transaction_id, conversion_type);
  END IF;
END $$;
