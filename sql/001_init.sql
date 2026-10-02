-- NightCamFinds PostgreSQL schema (production source of truth).
-- Launch runtime uses a file store that mirrors these entities.
-- Apply with: psql "$DATABASE_URL" -f sql/001_init.sql

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  api_version TEXT,
  program TEXT,
  campaign TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES providers(id),
  name TEXT NOT NULL,
  program TEXT,
  external_campaign TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS affiliate_links (
  id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES providers(id),
  campaign TEXT,
  program TEXT,
  destination_type TEXT NOT NULL,
  url_template TEXT,
  affiliate_domain TEXT,
  status TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  reachability TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_username TEXT NOT NULL,
  display_name TEXT,
  gender TEXT,
  age INT,
  country TEXT,
  image TEXT,
  room_subject TEXT,
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  is_hd BOOLEAN NOT NULL DEFAULT FALSE,
  is_new BOOLEAN NOT NULL DEFAULT FALSE,
  viewer_count INT,
  tags JSONB NOT NULL DEFAULT '[]',
  languages JSONB NOT NULL DEFAULT '[]',
  room_url TEXT,
  freshness TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ,
  provider_metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE (provider, external_username)
);

CREATE TABLE IF NOT EXISTS clicks (
  click_id TEXT PRIMARY KEY,
  session_id TEXT,
  provider TEXT,
  campaign TEXT,
  program TEXT,
  room_id TEXT,
  page TEXT,
  category TEXT,
  country TEXT,
  language TEXT,
  traffic_source TEXT,
  device TEXT,
  destination TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS postbacks (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL,
  click_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,
  provider TEXT,
  program TEXT,
  campaign TEXT,
  click_id TEXT,
  transaction_id TEXT,
  amount NUMERIC,
  currency TEXT,
  event_type TEXT,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_provider ON rooms(provider);
CREATE INDEX IF NOT EXISTS idx_rooms_freshness ON rooms(freshness);
CREATE INDEX IF NOT EXISTS idx_clicks_created ON clicks(created_at);
CREATE INDEX IF NOT EXISTS idx_conversions_state ON conversions(state);
