-- Widen the event label column for the BongaCash banner/widget telemetry
-- already accepted by application validation and migration 007.
-- ALTER TYPE preserves existing event rows and the existing CHECK constraint.
ALTER TABLE traffic_engagement_events
  ALTER COLUMN event_type TYPE VARCHAR(48);
