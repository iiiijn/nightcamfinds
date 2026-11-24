-- Allow BongaCash banner telemetry while preserving core engagement semantics.
-- Safe to rerun: the existing named check constraint is replaced deterministically.
ALTER TABLE traffic_engagement_events
  DROP CONSTRAINT IF EXISTS traffic_engagement_events_event_type_check;

ALTER TABLE traffic_engagement_events
  ADD CONSTRAINT traffic_engagement_events_event_type_check
  CHECK (event_type IN (
    'active_10s',
    'scroll_50',
    'bonga_banner_loaded',
    'bonga_banner_viewable',
    'bonga_static_banner_loaded',
    'bonga_static_banner_viewable',
    'bonga_category_widget_loaded',
    'bonga_category_widget_viewable'
  ));
